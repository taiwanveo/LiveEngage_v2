/** Ideas 參與者預覽（工作台右欄，預覽模式）。 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantPreviewFrame } from "@liveengage/ui";
import { listIdeas } from "../../../lib/sprint9Api";
import type { InteractionSummary } from "../../../lib/pollTypes";

interface Props {
  item: InteractionSummary;
}

export function WorkbenchIdeasPreview({ item }: Props): React.JSX.Element {
  const ideasQuery = useQuery({
    queryKey: ["ideas", item.id],
    queryFn: () => listIdeas(item.id),
    refetchInterval: 4_000,
  });

  const ideas = (ideasQuery.data?.items ?? []).filter((idea) => !idea.is_hidden);

  return (
    <ParticipantPreviewFrame stats={<p className="text-[10px] text-muted">預覽模式</p>}>
      {item.status !== "active" && item.status !== "locked" ? (
        <div className="le-card border-dashed p-6 text-center text-xs text-muted">
          等待點子牆開放
        </div>
      ) : (
        <div className="space-y-3 p-1">
          <div className="flex gap-2 opacity-60">
            <input
              disabled
              placeholder="分享你的點子…"
              className="le-input flex-1 !text-xs"
            />
            <button type="button" disabled className="le-btn-primary !text-xs">
              送出
            </button>
          </div>
          <ul className="space-y-2">
            {ideas.length === 0 ? (
              <li className="text-center text-xs text-muted">尚無點子</li>
            ) : (
              ideas.slice(0, 8).map((idea) => (
                <li key={idea.id} className="le-card p-3">
                  <p className="text-xs text-foreground">{idea.content}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    {idea.author_display ?? "匿名"} · 👍 {idea.reaction_total}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </ParticipantPreviewFrame>
  );
}
