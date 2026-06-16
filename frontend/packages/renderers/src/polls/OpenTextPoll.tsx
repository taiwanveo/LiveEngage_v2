import * as React from "react";
import { useState } from "react";
import { PollShell } from "../PollShell";
import { OpenTextList } from "../present/OpenTextList";
import { SubmitFooter } from "../SubmitFooter";
import type { PollRendererProps } from "../types";
import { canAnswer, readBool, readNumber, shouldShowParticipantResults } from "../utils";

export function OpenTextPoll({
  mode,
  poll,
  results,
  hostWorkbenchPreview = false,
  onSubmit,
  submitting = false,
  submitError,
}: PollRendererProps): React.JSX.Element {
  const settings = poll.settings_public;
  const maxLength = readNumber(settings, "max_length", 200);
  const multiline = readBool(settings, "multiline");
  const allowMultiple = readBool(settings, "allow_multiple");
  const interactive = mode === "answer";
  const answerable =
    interactive && canAnswer(poll.status, poll.my_submitted, allowMultiple);

  const [text, setText] = useState("");

  const handleSubmit = (): void => {
    const trimmed = text.trim();
    if (!onSubmit || !trimmed) return;
    onSubmit({ text: trimmed });
    setText("");
  };

  const showResults =
    mode === "present" ||
    (mode === "answer" &&
      shouldShowParticipantResults(poll, Boolean(results?.entries?.length), {
        hostWorkbenchPreview,
      }));

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
            disabled={text.trim().length === 0}
            submitError={submitError}
          />
        ) : undefined
      }
    >
      {showResults ? (
        <OpenTextList entries={results?.entries ?? []} large={mode === "present"} />
      ) : mode === "preview" ? (
        multiline ? (
          <div className="h-24 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
        ) : (
          <div className="h-10 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
        )
      ) : interactive && answerable ? (
        multiline ? (
          <textarea
            value={text}
            maxLength={maxLength}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="輸入您的回答…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        ) : (
          <input
            type="text"
            value={text}
            maxLength={maxLength}
            onChange={(e) => setText(e.target.value)}
            placeholder="輸入您的回答…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        )
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
