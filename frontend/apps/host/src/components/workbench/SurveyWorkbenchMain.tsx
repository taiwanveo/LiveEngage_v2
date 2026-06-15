/** Survey 工作台中欄：新增題目與結果摘要。 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { addSurveyQuestion, getSurveyResults } from "../../lib/sprint9Api";
import {
  interactionMetaLine,
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { Sprint9ActivateBanner } from "./Sprint9ActivateBanner";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

export function SurveyWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError } = useSystemNotice();
  const interactionId = item.id;

  const surveyResultsQuery = useQuery({
    queryKey: ["survey-results", interactionId],
    queryFn: () => getSurveyResults(interactionId),
    refetchInterval: 8_000,
  });

  const addSurveyQMutation = useMutation({
    mutationFn: () =>
      addSurveyQuestion(interactionId, {
        title: "滿意度（1–5）",
        question_type: "rating",
        required: true,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["survey-results", interactionId] }),
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {item.title ?? "問卷"}
        </h2>
        <p className="mt-1 text-sm text-muted">{interactionMetaLine(item.type, item.status)}</p>
      </div>

      <Sprint9ActivateBanner roomId={roomId} item={item} />

      <button
        type="button"
        onClick={() => addSurveyQMutation.mutate()}
        className="le-btn-primary !text-sm"
      >
        新增評分題
      </button>

      <section className="le-card p-4">
        <p className="text-sm text-foreground">
          提交數：{surveyResultsQuery.data?.submission_count ?? 0}
        </p>
      </section>
    </div>
  );
}
