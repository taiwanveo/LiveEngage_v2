/** Ideas 工作台中欄：點子列表與隱藏。 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { hideIdea, listIdeas } from "../../lib/sprint9Api";
import {
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import { Sprint9ActivateBanner } from "./Sprint9ActivateBanner";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";

interface Props {
  roomId: string;
  item: InteractionSummary;
}

export function IdeasWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError } = useSystemNotice();
  const interactionId = item.id;

  const ideasQuery = useQuery({
    queryKey: ["ideas", interactionId],
    queryFn: () => listIdeas(interactionId),
    refetchInterval: 4_000,
  });

  const hideMutation = useMutation({
    mutationFn: hideIdea,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas", interactionId] }),
    onError: (err: unknown) => showError(formatUserFacingError(err)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{interactionTypeLabel(item.type)}</p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={item.id}
            title={item.title}
            placeholder="點子牆"
          />
        </div>
        <WorkbenchInteractionStatusBadge status={item.status} />
      </div>

      <Sprint9ActivateBanner roomId={roomId} item={item} />

      <section className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">點子列表</h3>
        <ul className="space-y-3">
          {(ideasQuery.data?.items ?? []).map((idea) => (
            <li key={idea.id} className="rounded-lg border border-border bg-surface-elevated p-3">
              <p className="text-foreground">{idea.content}</p>
              <p className="mt-1 text-xs text-muted">
                {idea.author_display ?? "匿名"} · 👍 {idea.reaction_total}
              </p>
              <button
                type="button"
                onClick={() => hideMutation.mutate(idea.id)}
                className="mt-2 text-xs text-red-600 hover:underline"
              >
                隱藏
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
