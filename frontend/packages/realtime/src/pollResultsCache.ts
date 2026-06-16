/** poll_response_submitted WS → React Query 快取（鐵律 2：絕對值聚合）。 */

import type { PollDetail, PollResults } from "@liveengage/renderers";

/** 與 TanStack QueryClient 相容的最小表面，避免 realtime 套件硬依賴 react-query。 */
export interface PollResultsQueryClient {
  getQueryData<T>(queryKey: readonly unknown[]): T | undefined;
  setQueryData<T>(
    queryKey: readonly unknown[],
    updater: T | ((prev: T | undefined) => T | undefined)
  ): void;
  invalidateQueries(filters: { queryKey: readonly unknown[] }): void | Promise<void>;
}

/** 套用 poll_response_submitted payload 至 poll-results 快取。 */
export function applyPollResponseSubmitted(
  qc: PollResultsQueryClient,
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
