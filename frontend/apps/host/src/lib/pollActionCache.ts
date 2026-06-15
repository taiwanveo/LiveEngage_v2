/** Host 控場：減少 refetch、WS 與 mutation 去重。 */

import type { QueryClient } from "@tanstack/react-query";
import type { PollDetail, PollResults } from "@liveengage/renderers";
import {
  POLL_LOCKED,
  POLL_RESPONSE_SUBMITTED,
  POLL_RESULT_HIDDEN,
  POLL_RESULT_REVEALED,
  POLL_STARTED,
  POLL_STOPPED,
  POLL_UNLOCKED,
  type WsEvent,
} from "@liveengage/realtime";
import type { InteractionStatus, PollAction, PollActionResponse } from "./pollTypes";

const SELF_ACTION_MS = 2500;

/** WS 斷線時 poll-results 備援輪詢間隔（毫秒）。 */
export const POLL_RESULTS_BACKUP_REFETCH_MS = 10_000;

const HOST_CONTROL_POLL_EVENTS = new Set([
  POLL_STARTED,
  POLL_STOPPED,
  POLL_LOCKED,
  POLL_UNLOCKED,
  POLL_RESULT_REVEALED,
  POLL_RESULT_HIDDEN,
]);

export function createSelfPollActionGuard(): {
  mark: (pollId: string) => void;
  shouldSkip: (pollId: string) => boolean;
} {
  const until = new Map<string, number>();
  return {
    mark(pollId: string): void {
      until.set(pollId, Date.now() + SELF_ACTION_MS);
    },
    shouldSkip(pollId: string): boolean {
      const deadline = until.get(pollId) ?? 0;
      if (deadline > Date.now()) return true;
      if (deadline > 0) until.delete(pollId);
      return false;
    },
  };
}

function patchPollDetail(
  qc: QueryClient,
  pollId: string,
  patch: Partial<Pick<PollDetail, "status" | "result_visible">>
): void {
  qc.setQueryData(["poll", pollId], (prev: PollDetail | undefined) =>
    prev ? { ...prev, ...patch } : prev
  );
}

/** mutation 成功：樂觀更新快取，避免多餘 GET。 */
export function applyHostPollActionSuccess(
  qc: QueryClient,
  opts: {
    roomId: string;
    pollId: string;
    action: PollAction;
    data: PollActionResponse;
  }
): void {
  const { roomId, pollId, action, data } = opts;

  patchPollDetail(qc, pollId, {
    status: data.status,
    result_visible: data.result_visible,
  });

  if (action === "reveal" && data.results) {
    qc.setQueryData(["poll-results", pollId], data.results);
  } else if (action === "reset" && data.results) {
    qc.setQueryData(["poll-results", pollId], data.results);
  } else if (action === "reset") {
    qc.setQueryData(
      ["poll-results", pollId],
      (prev: PollResults | undefined) =>
        prev
          ? {
              ...prev,
              response_count: 0,
              option_counts: prev.option_counts?.map((c) => ({ ...c, count: 0 })) ?? null,
              word_counts: [],
              entries: [],
              average: null,
              distribution: null,
            }
          : prev
    );
  }

  if (action === "start" || action === "stop" || action === "reset") {
    void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
  }
}

function wsStatusFromPayload(payload: Record<string, unknown>): InteractionStatus | null {
  const raw = payload.status;
  if (
    raw === "idle" ||
    raw === "active" ||
    raw === "locked" ||
    raw === "stopped"
  ) {
    return raw;
  }
  return null;
}

/** 套用 poll_response_submitted WS payload（絕對值聚合，鐵律 2）。 */
function applyPollResponseSubmitted(
  qc: QueryClient,
  pollId: string,
  payload: Record<string, unknown>
): void {
  const rawCount = payload.response_count;
  const responseCount =
    typeof rawCount === "number"
      ? rawCount
      : typeof rawCount === "string" && /^\d+$/.test(rawCount)
        ? Number(rawCount)
        : undefined;

  const pollType =
    qc.getQueryData<PollDetail>(["poll", pollId])?.type ??
    qc.getQueryData<PollResults>(["poll-results", pollId])?.type;

  if (pollType === "open_text") {
    if (responseCount !== undefined) {
      qc.setQueryData(["poll-results", pollId], (prev: PollResults | undefined) =>
        prev ? { ...prev, response_count: responseCount } : prev
      );
    }
    void qc.invalidateQueries({ queryKey: ["poll-results", pollId] });
    return;
  }

  const aggregates = payload.aggregates as Record<string, unknown> | undefined;
  if (!pollType && !aggregates) {
    void qc.invalidateQueries({ queryKey: ["poll-results", pollId] });
    return;
  }

  qc.setQueryData(["poll-results", pollId], (prev: PollResults | undefined) => {
    const base: PollResults =
      prev ??
      ({
        interaction_id: pollId,
        type: pollType ?? "multiple_choice",
        status: "active",
        response_count: responseCount ?? 0,
      } as PollResults);

    const next: PollResults = { ...base };
    if (responseCount !== undefined) next.response_count = responseCount;

    const optionCounts = aggregates?.option_counts;
    if (Array.isArray(optionCounts)) {
      next.option_counts = optionCounts.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          option_id: String(r.option_id ?? ""),
          count: Number(r.count ?? 0),
        };
      });
    }

    const rankingOrders = aggregates?.ranking_order_counts;
    if (Array.isArray(rankingOrders)) {
      next.ranking_order_counts = rankingOrders.map((row) => {
        const r = row as Record<string, unknown>;
        const labels = r.order_labels;
        return {
          order_key: String(r.order_key ?? ""),
          order_labels: Array.isArray(labels)
            ? labels.map((l) => String(l))
            : [],
          count: Number(r.count ?? 0),
          percentage: Number(r.percentage ?? 0),
        };
      });
    }

    const wordCounts = aggregates?.word_counts;
    if (Array.isArray(wordCounts)) {
      next.word_counts = wordCounts.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          word: String(r.word ?? ""),
          count: Number(r.count ?? 0),
        };
      });
    }

    if (aggregates?.average !== undefined && aggregates.average !== null) {
      next.average = Number(aggregates.average);
    }
    if (aggregates?.distribution && typeof aggregates.distribution === "object") {
      next.distribution = aggregates.distribution as Record<string, number>;
    }

    return next;
  });
}

/** 非本人觸發的 WS 事件才更新快取（協同主持人／其他分頁）。 */
export function handleHostPollWsEvent(
  qc: QueryClient,
  opts: {
    event: WsEvent;
    pollId: string;
    roomId: string;
    guard: ReturnType<typeof createSelfPollActionGuard>;
  }
): void {
  const { event, pollId, roomId, guard } = opts;
  const eventPollId = String(event.payload.poll_id ?? "");
  if (!eventPollId || eventPollId !== pollId) return;

  if (event.type === POLL_RESPONSE_SUBMITTED) {
    applyPollResponseSubmitted(qc, pollId, event.payload);
    return;
  }

  if (HOST_CONTROL_POLL_EVENTS.has(event.type) && guard.shouldSkip(eventPollId)) return;

  if (event.type === POLL_RESULT_REVEALED) {
    patchPollDetail(qc, pollId, { result_visible: true });
    void qc.invalidateQueries({ queryKey: ["poll-results", pollId] });
    return;
  }
  if (event.type === POLL_RESULT_HIDDEN) {
    patchPollDetail(qc, pollId, { result_visible: false });
    return;
  }

  const status = wsStatusFromPayload(event.payload);
  if (status) {
    patchPollDetail(qc, pollId, { status });
  }

  if (
    event.type === POLL_STARTED ||
    event.type === POLL_STOPPED ||
    event.type === POLL_LOCKED ||
    event.type === POLL_UNLOCKED
  ) {
    void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
  }
}
