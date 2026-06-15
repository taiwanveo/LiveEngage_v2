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
  const revealed = questionsQuery.data?.find(
    (q) => q.state === "revealed" && q.result_visible
  );
  const current = active ?? revealed;

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
      ) : !current ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          等待主持人開始子題
        </div>
      ) : (
        <div className="le-card p-4">
          <p className="mb-1 text-[10px] text-muted">
            {current.state === "revealed" ? "已揭曉答案" : "作答 · 進行中"}
          </p>
          <h2 className="font-display text-sm font-semibold text-foreground">
            {current.title}
          </h2>
          <ul className="mt-3 space-y-2">
            {current.options.map((opt) => {
              const isCorrect = current.state === "revealed" && opt.is_correct;
              return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled
                  className={`le-btn-secondary w-full !justify-start !text-xs opacity-70 ${
                    isCorrect ? "ring-2 ring-emerald-500" : ""
                  }`}
                >
                  {opt.text}
                  {isCorrect ? " ✓" : ""}
                </button>
              </li>
            );
            })}
          </ul>
          {current.state === "revealed" && current.explanation ? (
            <p className="mt-3 text-xs text-muted">{current.explanation}</p>
          ) : null}
        </div>
      )}
    </ParticipantPreviewFrame>
  );
}
