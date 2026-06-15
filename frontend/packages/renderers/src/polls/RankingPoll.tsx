import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { PollShell } from "../PollShell";
import { ResultRankingOrders } from "../present/ResultRankingOrders";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readNumber, shouldShowParticipantResults } from "../utils";
import { RankingSortableList } from "./RankingSortableList";

export function RankingPoll({
  mode,
  poll,
  results,
  hostWorkbenchPreview = false,
  onSubmit,
  submitting = false,
  submitError,
}: PollRendererProps): React.JSX.Element {
  const topN = readNumber(poll.settings_public, "top_n", poll.options.length);
  const required = topN > 0 ? topN : poll.options.length;
  const interactive = mode === "answer";
  const answerable = interactive && canAnswer(poll.status, poll.my_submitted, false);

  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.order_no - b.order_no),
    [poll.options]
  );

  const optionsById = useMemo(
    () => new Map(sortedOptions.map((o) => [o.id, o])),
    [sortedOptions]
  );

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    sortedOptions.map((o) => o.id)
  );

  useEffect(() => {
    setOrderedIds(sortedOptions.map((o) => o.id));
  }, [poll.id, sortedOptions]);

  const handleSubmit = (): void => {
    if (!onSubmit) return;
    onSubmit({ ranked_option_ids: orderedIds.slice(0, required) });
  };

  const rankingOrders = results?.ranking_order_counts ?? null;
  const hasRankingResults = Boolean(rankingOrders && rankingOrders.length > 0);

  const showResults =
    mode === "present" ||
    (mode === "answer" &&
      shouldShowParticipantResults(
        poll,
        hasRankingResults || results?.option_counts != null,
        { hostWorkbenchPreview }
      ));

  const displayOrders = hasRankingResults
    ? rankingOrders!.filter((o) => o.count > 0)
    : null;

  return (
    <PollShell
      mode={mode}
      status={poll.status}
      title={poll.title}
      description={poll.description}
      footer={
        interactive && answerable ? (
          <SubmitFooter
            onSubmit={handleSubmit}
            submitting={submitting}
            disabled={orderedIds.length < required}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {interactive && !answerable && !showResults ? (
        <p className="text-sm text-slate-500">
          {poll.status !== "active" ? "目前無法作答" : "您已提交過排序"}
        </p>
      ) : null}

      {showResults && displayOrders && displayOrders.length > 0 ? (
        <ResultRankingOrders orders={displayOrders} large={mode === "present"} />
      ) : showResults ? (
        <p className="text-sm text-slate-500">尚無排序結果</p>
      ) : (
        <RankingSortableList
          orderedIds={orderedIds}
          optionsById={optionsById}
          disabled={!answerable && mode !== "preview"}
          rankedCount={required}
          onChange={setOrderedIds}
        />
      )}
    </PollShell>
  );
}
