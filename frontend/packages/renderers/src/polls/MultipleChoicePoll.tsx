import * as React from "react";
import { useMemo, useState } from "react";
import { PollShell } from "../PollShell";
import { ResultBars } from "../present/ResultBars";
import { ResultBarChart } from "../present/ResultBarChart";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readBool, shouldShowCorrectAnswer, shouldShowParticipantResults } from "../utils";

export function MultipleChoicePoll({
  mode,
  poll,
  results,
  hostWorkbenchPreview = false,
  onSubmit,
  submitting = false,
  submitError,
}: PollRendererProps): React.JSX.Element {
  const settings = poll.settings_public;
  const multiSelect = readBool(settings, "multi_select");
  const allowChange = readBool(settings, "allow_change");
  const interactive = mode === "answer";
  const preview = mode === "preview";
  const answerable = interactive && canAnswer(poll.status, poll.my_submitted, allowChange);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortedOptions = useMemo(
    () => [...poll.options].sort((a, b) => a.order_no - b.order_no),
    [poll.options]
  );

  const toggle = (id: string): void => {
    if (!answerable && !preview) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = (): void => {
    if (!onSubmit || selected.size === 0) return;
    onSubmit({ option_ids: [...selected] });
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" &&
      shouldShowParticipantResults(poll, results?.option_counts != null, {
        hostWorkbenchPreview,
      }));

  const optionCounts =
    results?.option_counts ??
    (hostWorkbenchPreview && poll.result_visible
      ? sortedOptions.map((o) => ({ option_id: o.id, count: 0 }))
      : null);

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
            disabled={selected.size === 0}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {interactive && !answerable && !showResults ? (
        <p className="rounded-lg bg-success/15 border border-success/30 px-4 py-3 text-sm font-medium text-success">
          {poll.status !== "active"
            ? "✓ 此題目目前不開放作答"
            : "✓ 您已作答完成，感謝參與！"}
        </p>
      ) : null}

      {showResults && optionCounts ? (
        mode === "present" ? (
          <ResultBarChart
            options={sortedOptions}
            counts={optionCounts ?? []}
            large
            showCorrectAnswer={shouldShowCorrectAnswer(mode, poll)}
          />
        ) : (
          <ResultBars
            options={sortedOptions}
            counts={optionCounts}
            large={false}
            showCorrectAnswer={shouldShowCorrectAnswer(mode, poll)}
          />
        )
      ) : (
        <ul className="space-y-2" role={multiSelect ? "group" : "radiogroup"}>
          {sortedOptions.map((opt) => {
            const isOn = selected.has(opt.id);
            const inputType = multiSelect ? "checkbox" : "radio";
            return (
              <li key={opt.id}>
                <label
                  className={
                    mode === "present"
                      ? "flex items-center gap-3 rounded-lg px-2 py-2 text-2xl"
                      : `flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                          isOn
                            ? "border-accent bg-accent-muted text-accent font-medium shadow-sm"
                            : "border-border bg-surface text-foreground hover:border-accent/40"
                        } ${preview ? "opacity-80" : ""}`
                  }
                >
                  {!preview && mode !== "present" ? (
                    <input
                      type={inputType}
                      name={`poll-${poll.id}`}
                      checked={isOn}
                      disabled={!answerable && !preview}
                      onChange={() => toggle(opt.id)}
                      className="h-4 w-4 accent-accent text-accent"
                    />
                  ) : null}
                  <span>{opt.text}</span>
                  {shouldShowCorrectAnswer(mode, poll) && opt.is_correct ? (
                    <span className="ml-auto text-xs font-semibold text-success">正解</span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </PollShell>
  );
}
