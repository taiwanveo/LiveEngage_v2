import * as React from "react";
import { useState } from "react";
import { PollShell } from "../PollShell";
import { WordCloudDisplay } from "../present/WordCloudDisplay";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readNumber, shouldShowParticipantResults } from "../utils";

export function WordCloudPoll({
  mode,
  poll,
  results,
  hostWorkbenchPreview = false,
  onSubmit,
  submitting = false,
  submitError,
}: PollRendererProps): React.JSX.Element {
  const maxLen = readNumber(poll.settings_public, "max_word_length", 25);
  const interactive = mode === "answer";
  const answerable = interactive && canAnswer(poll.status, poll.my_submitted, true);

  const [word, setWord] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  const addWord = (): void => {
    const trimmed = word.trim();
    if (!trimmed || trimmed.length > maxLen) return;
    setChips((prev) => [...prev, trimmed]);
    setWord("");
  };

  const removeWord = (indexToRemove: number): void => {
    setChips((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearWords = (): void => {
    setChips([]);
  };

  const handleSubmit = (): void => {
    if (!onSubmit || chips.length === 0) return;
    onSubmit({ words: chips });
    setChips([]);
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" &&
      shouldShowParticipantResults(poll, Boolean(results?.word_counts?.length), {
        hostWorkbenchPreview,
      }));

  const clearButton =
    interactive && answerable && chips.length > 0 ? (
      <button
        type="button"
        onClick={clearWords}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-rose-600 shadow-sm transition-colors hover:bg-slate-100 hover:border-slate-400 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 dark:hover:border-slate-600"
      >
        清除已加入詞彙
      </button>
    ) : undefined;

  return (
    <PollShell
      mode={mode}
      status={poll.status}
      title={poll.title}
      description={poll.description}
      headerAction={clearButton}
      footer={
        interactive && answerable ? (
          <div className="space-y-2">
            <SubmitFooter
              onSubmit={handleSubmit}
              submitting={submitting}
              disabled={chips.length === 0}
              submitError={submitError}
            />
            {chips.length > 0 ? (
              <p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                請記得按下提交按鈕才算正式送出。
              </p>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {showResults ? (
        <div className={mode === "present" ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <WordCloudDisplay words={results?.word_counts ?? []} large={mode === "present"} />
        </div>
      ) : mode === "preview" ? (
        <p className="text-sm text-slate-500">參與者將輸入關鍵字詞</p>
      ) : interactive && answerable ? (
        <div className="w-full min-w-0 space-y-3">
          <input
            type="text"
            value={word}
            maxLength={maxLen}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addWord();
              }
            }}
            placeholder={`輸入詞彙（最多 ${maxLen} 字）`}
            className="box-border w-full min-w-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={addWord}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-medium text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            加入
          </button>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="relative inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 px-3 py-1 text-sm font-medium text-primary-800 dark:text-primary-200"
                >
                  <span>{w}</span>
                  <button
                    type="button"
                    onClick={() => removeWord(i)}
                    className="flex h-4 w-4 items-center justify-center rounded-full text-primary-600 hover:bg-primary-200/70 hover:text-primary-900 transition-colors"
                    title={`取消加入「${w}」`}
                    aria-label={`取消加入「${w}」`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : interactive && !answerable ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {poll.status !== "active"
            ? "✓ 此題目目前不開放作答"
            : "✓ 您已作答完成，感謝參與！"}
        </p>
      ) : null}
    </PollShell>
  );
}
