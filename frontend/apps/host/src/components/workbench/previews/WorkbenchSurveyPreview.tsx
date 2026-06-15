/** Survey 參與者預覽（工作台右欄，預覽模式）。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantPreviewFrame } from "@liveengage/ui";
import { listSurveyQuestions } from "../../../lib/sprint9Api";
import type { InteractionSummary } from "../../../lib/pollTypes";

interface Props {
  item: InteractionSummary;
}

export function WorkbenchSurveyPreview({ item }: Props): React.JSX.Element {
  const questionsQuery = useQuery({
    queryKey: ["survey-questions", item.id],
    queryFn: () => listSurveyQuestions(item.id),
    refetchInterval: 15_000,
  });

  const questions = questionsQuery.data ?? [];

  return (
    <ParticipantPreviewFrame stats={<p className="text-[10px] text-muted">預覽模式</p>}>
      {item.status !== "active" && item.status !== "locked" ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          問卷尚未開放
        </div>
      ) : questions.length === 0 ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          尚無題目，請在中欄新增
        </div>
      ) : (
        <form className="space-y-4 p-1" onSubmit={(e) => e.preventDefault()}>
          {questions.map((q) => (
            <section key={q.child_interaction_id} className="le-card p-4">
              <p className="mb-2 text-xs font-medium text-foreground">
                {q.title ?? "（無標題）"}
              </p>
              {q.question_type === "rating" ? (
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-border text-xs opacity-70"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  disabled
                  rows={2}
                  placeholder="輸入你的回答…"
                  className="le-input w-full !text-xs opacity-70"
                />
              )}
            </section>
          ))}
          <button type="button" disabled className="le-btn-primary w-full !text-xs opacity-70">
            提交問卷
          </button>
        </form>
      )}
    </ParticipantPreviewFrame>
  );
}
