import * as React from "react";
import { useState } from "react";
import { PollShell } from "../PollShell";
import { RatingDisplay } from "../present/RatingDisplay";
import { RatingBarChart } from "../present/RatingBarChart";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import {
  canAnswer,
  isRatingValueInRange,
  ratingInputMode,
  readNumber,
  shouldShowParticipantResults,
} from "../utils";

function RatingInput({
  min,
  max,
  value,
  onChange,
  disabled,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled: boolean;
}): React.JSX.Element {
  const mode = ratingInputMode(max);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  if (mode === "select") {
    return (
      <label className="block text-sm">
        <span className="font-medium text-foreground">選擇評分</span>
        <select
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number.parseInt(raw, 10));
          }}
          className="le-input mt-2 w-full max-w-xs"
          aria-label="評分"
        >
          <option value="">請選擇分數</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {v} 分
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (mode === "number") {
    return (
      <label className="block text-sm">
        <span className="font-medium text-foreground">輸入評分</span>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number.parseInt(raw, 10);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="le-input mt-2 w-full max-w-xs"
          aria-label="評分"
        />
        <span className="mt-1 block text-xs text-muted">
          請輸入 {min} 到 {max} 的分數
        </span>
      </label>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="評分">
      {values.map((v) => {
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg font-semibold transition-all ${
              selected
                ? "border-accent bg-accent-muted text-accent ring-2 ring-accent/30 shadow-sm"
                : "border-border bg-surface text-foreground hover:border-accent/40"
            } disabled:opacity-50`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

export function RatingPoll({
  mode,
  poll,
  results,
  hostWorkbenchPreview = false,
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
    if (!onSubmit || !isRatingValueInRange(value, min, max)) return;
    onSubmit({ value: value! });
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" &&
      shouldShowParticipantResults(poll, results != null, { hostWorkbenchPreview }));

  const inputDisabled = !answerable && mode !== "preview";
  const canSubmit = isRatingValueInRange(value, min, max);

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
            disabled={!canSubmit}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {interactive && !answerable && !showResults ? (
        <p className="rounded-lg bg-success/15 border border-success/30 px-4 py-3 text-sm font-medium text-success">
          ✓ 您已完成評分，感謝參與！
        </p>
      ) : null}
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
        <RatingInput
          min={min}
          max={max}
          value={value}
          onChange={(next) => {
            if (answerable || mode === "preview") setValue(next);
          }}
          disabled={inputDisabled}
        />
      )}
    </PollShell>
  );
}
