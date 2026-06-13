import * as React from "react";
import { useState } from "react";
import { PollShell } from "../PollShell";
import { WordCloudDisplay } from "../present/WordCloudDisplay";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readNumber } from "../utils";

export function WordCloudPoll({
  mode,
  poll,
  results,
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

  const handleSubmit = (): void => {
    if (!onSubmit || chips.length === 0) return;
    onSubmit({ words: chips });
    setChips([]);
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" && poll.result_visible && results?.word_counts);

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
            disabled={chips.length === 0}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {showResults && results?.word_counts ? (
        <WordCloudDisplay words={results.word_counts} large={mode === "present"} />
      ) : mode === "preview" ? (
        <p className="text-sm text-slate-500">參與者將輸入關鍵字詞</p>
      ) : interactive && answerable ? (
        <div className="space-y-3">
          <div className="flex gap-2">
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
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addWord}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              加入
            </button>
          </div>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-800"
                >
                  {w}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">目前無法提交詞彙</p>
      )}
    </PollShell>
  );
}
