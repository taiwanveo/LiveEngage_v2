/** Survey 工作台中欄：新增評分題、題目清單與結果摘要。 */

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
} from "../../lib/sprint9Api";
import {
  interactionMetaLine,
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { Sprint9ActivateBanner } from "./Sprint9ActivateBanner";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

const DEFAULT_RATING_TITLE = "滿意度（1–5）";

export function SurveyWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const editable = canEditHostContent();
  const interactionId = item.id;
  const [questionTitle, setQuestionTitle] = useState(DEFAULT_RATING_TITLE);

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

  const addSurveyQMutation = useMutation({
    mutationFn: () =>
      addSurveyQuestion(interactionId, {
        title: questionTitle.trim() || DEFAULT_RATING_TITLE,
        question_type: "rating",
        required: true,
      }),
    onSuccess: () => {
      showSuccess("評分題已新增");
      setQuestionTitle(DEFAULT_RATING_TITLE);
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
      <div>
        <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
        <WorkbenchInteractionTitle
          roomId={roomId}
          interactionId={item.id}
          title={item.title}
          placeholder="問卷"
        />
        <p className="mt-1 text-sm text-muted">{interactionMetaLine(item.type, item.status)}</p>
      </div>

      <Sprint9ActivateBanner roomId={roomId} item={item} />

      {editable ? (
        <section className="le-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">新增評分題</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={questionTitle}
              onChange={(e) => setQuestionTitle(e.target.value)}
              placeholder="題目文字"
              maxLength={500}
              className="le-input min-w-[200px] flex-1"
            />
            <button
              type="button"
              onClick={() => addSurveyQMutation.mutate()}
              disabled={addSurveyQMutation.isPending}
              className="le-btn-primary !text-sm"
            >
              {addSurveyQMutation.isPending ? "新增中…" : "新增評分題"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">問卷題目</h3>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-muted">載入中…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted">尚無題目，請使用上方表單新增評分題。</p>
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
                    <p className="mt-0.5 text-xs text-muted">
                      評分題（1–5）{q.required ? " · 必填" : ""}
                    </p>
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
