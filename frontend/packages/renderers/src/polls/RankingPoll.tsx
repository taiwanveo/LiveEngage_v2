import * as React from "react";
import { useMemo, useState } from "react";
import { PollShell } from "../PollShell";
import { ResultBars } from "../present/ResultBars";
import { ResultBarChart } from "../present/ResultBarChart";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readNumber } from "../utils";

export function RankingPoll({
  mode,
  poll,
  results,
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

  const [ranks, setRanks] = useState<(string | "")[]>(
    () => Array.from({ length: required }, () => "")
  );

  const setRank = (index: number, optionId: string): void => {
    setRanks((prev) => {
      const next = [...prev];
      next[index] = optionId;
      return next;
    });
  };

  const usedIds = new Set(ranks.filter(Boolean));
  const complete = ranks.every((r) => r !== "") && usedIds.size === required;

  const handleSubmit = (): void => {
    if (!onSubmit || !complete) return;
    onSubmit({ ranked_option_ids: ranks as string[] });
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" && poll.result_visible && results?.option_counts);

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
            disabled={!complete}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {showResults && results?.option_counts ? (
        mode === "present" ? (
          <ResultBarChart
            options={sortedOptions}
            counts={results.option_counts}
            large
          />
        ) : (
          <ResultBars
            options={sortedOptions}
            counts={results.option_counts}
            large={false}
          />
        )
      ) : (
        <ol className="space-y-3">
          {ranks.map((rank, index) => (
            <li key={index} className="flex items-center gap-3">
              <span className="w-8 text-sm font-semibold text-slate-500">
                #{index + 1}
              </span>
              <select
                value={rank}
                disabled={!answerable && mode !== "preview"}
                onChange={(e) => setRank(index, e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">選擇選項…</option>
                {sortedOptions.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={usedIds.has(opt.id) && rank !== opt.id}
                  >
                    {opt.text}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ol>
      )}
    </PollShell>
  );
}
