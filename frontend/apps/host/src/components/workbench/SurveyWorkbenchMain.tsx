/** Survey 工作台中欄：新增子題（評分／選擇／開放文字）、題目清單與結果摘要。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { canEditHostContent } from "../../lib/auth";
import {
  addSurveyQuestion,
  getSurveyResults,
  listSurveyQuestions,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "../../lib/sprint9Api";
import {
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";
import { WORKBENCH_S9_EDIT_ID } from "./WorkbenchInteractionActions";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

const SURVEY_QUESTION_TYPES: {
  value: SurveyQuestionType;
  label: string;
  defaultTitle: string;
  addLabel: string;
}[] = [
  {
    value: "rating",
    label: "評分題",
    defaultTitle: "滿意度（1–5）",
    addLabel: "新增評分題",
  },
  {
    value: "multiple_choice",
    label: "選擇題",
    defaultTitle: "請選擇一項",
    addLabel: "新增選擇題",
  },
  {
    value: "open_text",
    label: "開放文字",
    defaultTitle: "請分享你的想法",
    addLabel: "新增開放文字題",
  },
];

function defaultTitleForType(type: SurveyQuestionType): string {
  return SURVEY_QUESTION_TYPES.find((t) => t.value === type)?.defaultTitle ?? "";
}

function addLabelForType(type: SurveyQuestionType): string {
  return SURVEY_QUESTION_TYPES.find((t) => t.value === type)?.addLabel ?? "新增題目";
}

function surveyQuestionMeta(q: SurveyQuestion): string {
  const label = interactionTypeLabel(q.question_type);
  let detail = "";
  if (q.question_type === "rating") {
    detail = "（1–5）";
  } else if (q.question_type === "multiple_choice") {
    const n = q.options?.length ?? 0;
    detail = n > 0 ? `（${n} 個選項）` : "";
  }
  return `${label}${detail}${q.required ? " · 必填" : ""}`;
}

export function SurveyWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const editable = canEditHostContent();
  const interactionId = item.id;

  const [questionType, setQuestionType] = useState<SurveyQuestionType>("rating");
  const [questionTitle, setQuestionTitle] = useState(defaultTitleForType("rating"));
  const [required, setRequired] = useState(true);
  const [mcOptions, setMcOptions] = useState(["選項 A", "選項 B"]);

  const questionsQuery = useQuery({
    queryKey: ["survey-questions", interactionId],
    queryFn: () => listSurveyQuestions(interactionId),
    refetchInterval: 8_000,
  });

  const surveyResultsQuery = useQuery({
    queryKey: ["survey-results", interactionId],
    queryFn: () => getSurveyResults(interactionId),
    refetchInterval: 8_000,
  });

  const handleTypeChange = (type: SurveyQuestionType): void => {
    setQuestionType(type);
    setQuestionTitle(defaultTitleForType(type));
    if (type === "multiple_choice" && mcOptions.length < 2) {
      setMcOptions(["選項 A", "選項 B"]);
    }
  };

  const canAddQuestion = (): boolean => {
    if (!questionTitle.trim()) return false;
    if (questionType === "multiple_choice") {
      const filled = mcOptions.map((o) => o.trim()).filter(Boolean);
      return filled.length >= 2;
    }
    return true;
  };

  const addSurveyQMutation = useMutation({
    mutationFn: () => {
      const title = questionTitle.trim() || defaultTitleForType(questionType);
      const payload: Parameters<typeof addSurveyQuestion>[1] = {
        title,
        question_type: questionType,
        required,
      };
      if (questionType === "multiple_choice") {
        payload.options = mcOptions
          .map((text, i) => ({ text: text.trim(), order_no: i, is_correct: false }))
          .filter((o) => o.text.length > 0);
      }
      return addSurveyQuestion(interactionId, payload);
    },
    onSuccess: () => {
      showSuccess(`${addLabelForType(questionType).replace("新增", "")}已新增`);
      setQuestionTitle(defaultTitleForType(questionType));
      if (questionType === "multiple_choice") {
        setMcOptions(["選項 A", "選項 B"]);
      }
      void qc.invalidateQueries({ queryKey: ["survey-questions", interactionId] });
      void qc.invalidateQueries({ queryKey: ["survey-results", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err, "新增失敗")),
  });

  const questions = questionsQuery.data ?? [];
  const resultByChildId = new Map(
    (surveyResultsQuery.data?.questions ?? []).map((q) => [q.child_interaction_id, q])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={item.id}
            title={item.title}
            placeholder="問卷"
          />
        </div>
        <WorkbenchInteractionStatusBadge status={item.status} />
      </div>

      {editable ? (
        <section id={WORKBENCH_S9_EDIT_ID} className="le-card space-y-4 p-4">
          <h3 className="text-sm font-semibold text-foreground">新增問卷題目</h3>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">題型</span>
            <select
              value={questionType}
              onChange={(e) => handleTypeChange(e.target.value as SurveyQuestionType)}
              className="le-input w-full max-w-xs"
            >
              {SURVEY_QUESTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">題目</span>
            <input
              type="text"
              value={questionTitle}
              onChange={(e) => setQuestionTitle(e.target.value)}
              placeholder="題目文字"
              maxLength={500}
              className="le-input w-full"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            必填
          </label>

          {questionType === "multiple_choice" ? (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">選項</p>
              <ul className="space-y-2">
                {mcOptions.map((opt, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <input
                      className="le-input flex-1"
                      value={opt}
                      onChange={(e) =>
                        setMcOptions((prev) =>
                          prev.map((o, i) => (i === idx ? e.target.value : o))
                        )
                      }
                      placeholder={`選項 ${idx + 1}`}
                    />
                    <button
                      type="button"
                      className="text-xs text-danger disabled:opacity-40"
                      disabled={mcOptions.length <= 2}
                      onClick={() =>
                        setMcOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      移除
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs text-accent hover:underline disabled:opacity-40"
                disabled={mcOptions.length >= 10}
                onClick={() =>
                  setMcOptions((prev) => [...prev, `選項 ${String.fromCharCode(65 + prev.length)}`])
                }
              >
                + 新增選項
              </button>
            </div>
          ) : null}

          {questionType === "rating" ? (
            <p className="text-xs text-muted">參與者以 1–5 分評分作答。</p>
          ) : null}

          {questionType === "open_text" ? (
            <p className="text-xs text-muted">參與者以文字自由作答。</p>
          ) : null}

          <button
            type="button"
            onClick={() => addSurveyQMutation.mutate()}
            disabled={addSurveyQMutation.isPending || !canAddQuestion()}
            className="le-btn-primary !text-sm"
          >
            {addSurveyQMutation.isPending ? "新增中…" : addLabelForType(questionType)}
          </button>
        </section>
      ) : null}

      <section className="le-card p-4" id={editable ? undefined : WORKBENCH_S9_EDIT_ID}>
        <h3 className="mb-3 text-sm font-semibold text-foreground">問卷題目</h3>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-muted">載入中…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted">尚無題目，請使用上方表單新增。</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q, index) => {
              const stats = resultByChildId.get(q.child_interaction_id);
              return (
                <li
                  key={q.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {index + 1}. {q.title ?? "（無標題）"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{surveyQuestionMeta(q)}</p>
                    {q.question_type === "multiple_choice" && q.options?.length ? (
                      <ul className="mt-1.5 list-inside list-disc text-xs text-muted">
                        {q.options.map((o) => (
                          <li key={o.id}>{o.text}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs text-muted">
                    回應 {stats?.response_count ?? 0}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="le-card p-4">
        <p className="text-sm text-foreground">
          提交數：{surveyResultsQuery.data?.submission_count ?? 0}
        </p>
      </section>

      {systemNoticeModal}
    </div>
  );
}
