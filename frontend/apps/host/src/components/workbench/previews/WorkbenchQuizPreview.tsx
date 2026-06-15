/** Quiz 參與者預覽（工作台右欄，預覽模式）。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantPreviewFrame } from "@liveengage/ui";
import { listQuizQuestions } from "../../../lib/sprint9Api";
import type { InteractionSummary } from "../../../lib/pollTypes";

interface Props {
  item: InteractionSummary;
}

export function WorkbenchQuizPreview({ item }: Props): React.JSX.Element {
  const questionsQuery = useQuery({
    queryKey: ["quiz-questions", item.id],
    queryFn: () => listQuizQuestions(item.id),
    refetchInterval: 5_000,
  });

  const active = questionsQuery.data?.find((q) => q.state === "active");

  return (
    <ParticipantPreviewFrame
      stats={
        <p className="text-[10px] text-muted">預覽模式 · 無法提交</p>
      }
    >
      {item.status !== "active" && item.status !== "locked" ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          等待 Quiz 開放
        </div>
      ) : !active ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          等待主持人開始子題
        </div>
      ) : (
        <div className="le-card p-4">
          <p className="mb-1 text-[10px] text-muted">作答 · 進行中</p>
          <h2 className="font-display text-sm font-semibold text-foreground">
            {active.title}
          </h2>
          <ul className="mt-3 space-y-2">
            {active.options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled
                  className="le-btn-secondary w-full !justify-start !text-xs opacity-70"
                >
                  {opt.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ParticipantPreviewFrame>
  );
}
