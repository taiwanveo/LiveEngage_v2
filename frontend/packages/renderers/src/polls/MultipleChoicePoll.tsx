import * as React from "react";
import { useMemo, useState } from "react";
import { PollShell } from "../PollShell";
import { ResultBars } from "../present/ResultBars";
import { ResultBarChart } from "../present/ResultBarChart";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readBool, shouldShowParticipantResults } from "../utils";

export function MultipleChoicePoll({
  mode,
  poll,
  results,
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
      shouldShowParticipantResults(poll, results?.option_counts != null));

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
      {interactive && !answerable ? (
        <p className="text-sm text-slate-500">
          {poll.status !== "active"
            ? "目前無法作答"
            : "您已提交過答案"}
        </p>
      ) : null}

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
                      : `flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                          isOn
                            ? "border-primary-500 bg-primary-50"
                            : "border-slate-200 hover:border-slate-300"
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
                      className="h-4 w-4 text-primary-600"
                    />
                  ) : null}
                  <span>{opt.text}</span>
                  {opt.is_correct ? (
                    <span className="ml-auto text-xs text-emerald-600">正解</span>
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
