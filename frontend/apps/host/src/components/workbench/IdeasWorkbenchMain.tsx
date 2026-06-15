/** Ideas 工作台中欄：點子列表與隱藏／顯示切換。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { useSystemNotice } from "@liveengage/ui";
import { listIdeas, setIdeaHidden, type IdeaPublic } from "../../lib/sprint9Api";
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

export function IdeasWorkbenchMain({ roomId, item }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError } = useSystemNotice();
  const interactionId = item.id;
  const [pendingIdeaId, setPendingIdeaId] = useState<string | null>(null);

  const ideasQuery = useQuery({
    queryKey: ["ideas", interactionId],
    queryFn: () => listIdeas(interactionId),
    refetchInterval: 4_000,
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ ideaId, hidden }: { ideaId: string; hidden: boolean }) =>
      setIdeaHidden(ideaId, hidden),
    onMutate: ({ ideaId }) => setPendingIdeaId(ideaId),
    onSuccess: (data) => {
      qc.setQueryData<{ items: IdeaPublic[] }>(
        ["ideas", interactionId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((row) =>
              row.id === data.id
                ? { ...row, is_hidden: Boolean(data.is_hidden) }
                : row
            ),
          };
        }
      );
      void qc.invalidateQueries({ queryKey: ["ideas", interactionId] });
    },
    onError: (err: unknown) => showError(formatUserFacingError(err)),
    onSettled: () => setPendingIdeaId(null),
  });

  const ideas = ideasQuery.data?.items ?? [];

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

      <section id={WORKBENCH_S9_EDIT_ID} className="le-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">點子列表</h3>
        <ul className="space-y-3">
          {ideas.length === 0 ? (
            <p className="text-sm text-muted">尚無點子。</p>
          ) : null}
          {ideas.map((idea) => {
            const hidden = Boolean(idea.is_hidden);
            const pending =
              visibilityMutation.isPending && pendingIdeaId === idea.id;

            return (
              <li
                key={idea.id}
                className={`rounded-lg border p-3 ${
                  hidden
                    ? "border-border/60 bg-surface-elevated/50"
                    : "border-border bg-surface-elevated"
                }`}
              >
                <p className={hidden ? "text-muted" : "text-foreground"}>{idea.content}</p>
                <p className={`mt-1 text-xs ${hidden ? "text-muted/80" : "text-muted"}`}>
                  {idea.author_display ?? "匿名"} · 👍 {idea.reaction_total}
                  {hidden ? " · 已隱藏（參與者不可見）" : null}
                </p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    visibilityMutation.mutate({ ideaId: idea.id, hidden: !hidden })
                  }
                  className="mt-2 text-xs text-foreground hover:underline disabled:opacity-40"
                >
                  {pending ? "處理中…" : hidden ? "顯示" : "隱藏"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
