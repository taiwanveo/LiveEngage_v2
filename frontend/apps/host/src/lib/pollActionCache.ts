/** Host 控場：減少 refetch、WS 與 mutation 去重。 */

import type { QueryClient } from "@tanstack/react-query";
import type { PollDetail, PollResults } from "@liveengage/renderers";
import {
  POLL_LOCKED,
  POLL_RESULT_HIDDEN,
  POLL_RESULT_REVEALED,
  POLL_STARTED,
  POLL_STOPPED,
  POLL_UNLOCKED,
  type WsEvent,
} from "@liveengage/realtime";
import type { InteractionStatus, PollAction, PollActionResponse } from "./pollTypes";

const SELF_ACTION_MS = 2500;

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
  if (guard.shouldSkip(eventPollId)) return;

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
