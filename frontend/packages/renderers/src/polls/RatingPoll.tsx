import * as React from "react";
import { useState } from "react";
import { PollShell } from "../PollShell";
import { RatingDisplay } from "../present/RatingDisplay";
import { RatingBarChart } from "../present/RatingBarChart";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readNumber } from "../utils";

export function RatingPoll({
  mode,
  poll,
  results,
  onSubmit,
  submitting = false,
  submitError,
}: PollRendererProps): React.JSX.Element {
  const min = readNumber(poll.settings_public, "min_value", 1);
  const max = readNumber(poll.settings_public, "max_value", 5);
  const interactive = mode === "answer";
  const answerable = interactive && canAnswer(poll.status, poll.my_submitted, false);

  const [value, setValue] = useState<number | null>(null);

  const handleSubmit = (): void => {
    if (!onSubmit || value == null) return;
    onSubmit({ value });
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" && poll.result_visible && results != null);

  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

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
            disabled={value == null}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {showResults ? (
        mode === "present" ? (
          <RatingBarChart
            average={results?.average}
            distribution={results?.distribution ?? undefined}
            min={min}
            max={max}
            large
          />
        ) : (
          <RatingDisplay
            average={results?.average}
            distribution={results?.distribution ?? undefined}
            min={min}
            max={max}
            large={false}
          />
        )
      ) : (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="評分">
          {values.map((v) => {
            const selected = value === v;
            const disabled = !answerable && mode !== "preview";
            return (
              <button
                key={v}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (answerable || mode === "preview") setValue(v);
                }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold transition ${
                  selected
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                } disabled:opacity-50`}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}
    </PollShell>
  );
}
