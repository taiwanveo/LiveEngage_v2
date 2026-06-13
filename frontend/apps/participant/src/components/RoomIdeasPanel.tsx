/** 參與者 Ideas 點子牆（FE-013）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiException } from "../lib/api";
import { listBoardIdeas, reactIdea, submitIdea } from "../lib/sprint9Api";

interface Props {
  boardId: string;
}

export function RoomIdeasPanel({ boardId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ideasQuery = useQuery({
    queryKey: ["ideas-board", boardId],
    queryFn: () => listBoardIdeas(boardId),
    refetchInterval: 5_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => submitIdea(boardId, content.trim()),
    onSuccess: () => {
      setContent("");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["ideas-board", boardId] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiException ? err.error.message : "提交失敗");
    },
  });

  const reactMutation = useMutation({
    mutationFn: (ideaId: string) => reactIdea(ideaId, "👍"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ideas-board", boardId] }),
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
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          送出
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {(ideasQuery.data?.items ?? []).map((idea) => (
          <li key={idea.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-slate-900">{idea.content}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{idea.author_display ?? "匿名"}</span>
              <button
                type="button"
                onClick={() => reactMutation.mutate(idea.id)}
                className="rounded-full bg-slate-100 px-2 py-1 hover:bg-slate-200"
              >
                👍 {idea.reaction_total}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
