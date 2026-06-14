/** 參與者 Ideas 點子牆（FE-013）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSystemNotice } from "@liveengage/ui";
import { ApiException } from "../lib/api";
import { listBoardIdeas, reactIdea, submitIdea } from "../lib/sprint9Api";

interface Props {
  boardId: string;
}

export function RoomIdeasPanel({ boardId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [content, setContent] = useState("");

  const ideasQuery = useQuery({
    queryKey: ["ideas-board", boardId],
    queryFn: () => listBoardIdeas(boardId),
    refetchInterval: 5_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitIdea(boardId, content.trim()),
    onSuccess: () => {
      setContent("");
      void qc.invalidateQueries({ queryKey: ["ideas-board", boardId] });
    },
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "提交失敗");
    },
  });

  const reactMutation = useMutation({
    mutationFn: (ideaId: string) => reactIdea(ideaId, "👍"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas-board", boardId] }),
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "反應失敗");
    },
  });

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          submitMutation.mutate();
        }}
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享你的點子…"
          className="le-input flex-1"
        />
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="le-btn-primary !min-h-[42px] disabled:opacity-50"
        >
          送出
        </button>
      </form>
      <ul className="space-y-3">
        {(ideasQuery.data?.items ?? []).map((idea) => (
          <li key={idea.id} className="le-card p-4">
            <p className="text-foreground">{idea.content}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{idea.author_display ?? "匿名"}</span>
              <button
                type="button"
                disabled={reactMutation.isPending}
                onClick={() => reactMutation.mutate(idea.id)}
                className="le-btn-secondary !min-h-0 rounded-full px-2 py-1 text-xs disabled:opacity-50"
              >
                👍 {idea.reaction_total}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {systemNoticeModal}
    </div>
  );
}
