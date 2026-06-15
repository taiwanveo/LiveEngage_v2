/** 參與者 Survey 問卷作答。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { Modal, useSystemNotice } from "@liveengage/ui";
import {
  listSurveyQuestions,
  submitSurveyAnswers,
  type SurveyParticipantQuestion,
} from "../lib/sprint9Api";

interface Props {
  surveyId: string;
}

export function RoomSurveyPanel({ surveyId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitOk, setSubmitOk] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: () => listSurveyQuestions(surveyId),
    refetchInterval: 15_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitSurveyAnswers(surveyId, answers),
    onSuccess: () => {
      setSubmitOk(true);
      void qc.invalidateQueries({ queryKey: ["survey-questions", surveyId] });
    },
    onError: (err: unknown) => {
      setSubmitOk(false);
      showError(formatUserFacingError(err, "提交失敗"));
    },
  });

  const questions = questionsQuery.data ?? [];

  const setAnswer = (childId: string, value: unknown): void => {
    setAnswers((prev) => ({ ...prev, [childId]: value }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.required) continue;
      const ans = answers[q.child_interaction_id];
      if (ans === undefined || ans === null || ans === "") {
        showError(`請完成必填題目：${q.title ?? "（無標題）"}`);
        return;
      }
    }
    submitMutation.mutate();
  };

  if (questionsQuery.isLoading) {
    return <p className="text-sm text-muted">載入問卷…</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="le-card border-dashed p-8 text-center text-sm text-muted">
        問卷尚未開放或尚無題目，請稍候。
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {questions.map((q) => (
        <SurveyQuestionField
          key={q.child_interaction_id}
          question={q}
          value={answers[q.child_interaction_id]}
          onChange={(v) => setAnswer(q.child_interaction_id, v)}
        />
      ))}
      <button
        type="submit"
        disabled={submitMutation.isPending}
        className="le-btn-primary w-full disabled:opacity-50"
      >
        {submitMutation.isPending ? "提交中…" : "提交問卷"}
      </button>
      <Modal
        open={submitOk}
        onClose={() => setSubmitOk(false)}
        title="已提交"
        size="sm"
      >
        <p className="text-sm text-muted">感謝填寫問卷！</p>
      </Modal>
      {systemNoticeModal}
    </form>
  );
}

function SurveyQuestionField(props: {
  question: SurveyParticipantQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.JSX.Element {
  const q = props.question;
  const label = (
    <span className="font-medium text-foreground">
      {q.title ?? "（無標題）"}
      {q.required ? <span className="text-destructive"> *</span> : null}
    </span>
  );

  if (q.question_type === "multiple_choice") {
    const selected =
      typeof props.value === "object" &&
      props.value !== null &&
      "option_ids" in (props.value as object)
        ? ((props.value as { option_ids: string[] }).option_ids[0] ?? null)
        : null;
    return (
      <section className="le-card p-5">
        <p className="mb-3 text-sm">{label}</p>
        <ul className="space-y-2">
          {q.options.map((opt) => (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-accent/40">
                <input
                  type="radio"
                  name={q.child_interaction_id}
                  checked={selected === opt.id}
                  onChange={() =>
                    props.onChange({ option_ids: [opt.id] })
                  }
                  className="accent-accent"
                />
                {opt.text}
              </label>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (q.question_type === "rating") {
    const rating =
      typeof props.value === "object" &&
      props.value !== null &&
      "value" in (props.value as object)
        ? Number((props.value as { value: number }).value)
        : null;
    return (
      <section className="le-card p-5">
        <p className="mb-3 text-sm">{label}</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => props.onChange({ value: n })}
              className={`min-h-[40px] min-w-[40px] rounded-lg border text-sm font-medium transition-colors ${
                rating === n
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface text-foreground hover:border-accent/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const text = typeof props.value === "string" ? props.value : "";
  return (
    <section className="le-card p-5">
      <label className="block space-y-2 text-sm">
        {label}
        <textarea
          rows={3}
          value={text}
          onChange={(e) => props.onChange(e.target.value)}
          className="le-input min-h-[88px] resize-y"
          placeholder="輸入你的回答…"
        />
      </label>
    </section>
  );
}
