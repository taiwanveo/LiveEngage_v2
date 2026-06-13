/** 參與者 Q&A：提問與瀏覽已核准問題。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiException } from "../lib/api";
import { listQuestions, submitQuestion, voteQuestion } from "../lib/qaApi";

interface Props {
  roomId: string;
}

export function RoomQaPanel({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  const questionsQuery = useQuery({
    queryKey: ["qa-public", roomId],
    queryFn: () => listQuestions(roomId, "top"),
    refetchInterval: 8_000,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitQuestion(roomId, { content: content.trim(), is_anonymous: anonymous }),
    onSuccess: () => {
      setContent("");
      setFormError(null);
      setSubmitOk(true);
      void qc.invalidateQueries({ queryKey: ["qa-public", roomId] });
    },
    onError: (err: unknown) => {
      setSubmitOk(false);
      setFormError(
        err instanceof ApiException ? err.error.message : "提交失敗"
      );
    },
  });

  const voteMutation = useMutation({
    mutationFn: (questionId: string) => voteQuestion(questionId, "up"),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["qa-public", roomId] }),
  });

  const items = questionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">向主持人提問</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitOk(false);
            if (!content.trim()) return;
            submitMutation.mutate();
          }}
        >
          <textarea
            required
            maxLength={1000}
            rows={3}
            placeholder="輸入你的問題…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            匿名提問
          </label>
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          {submitOk ? (
            <p className="text-sm text-emerald-700">
              已送出，待主持人審核後會顯示在列表中。
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:bg-slate-400"
          >
            {submitMutation.isPending ? "送出中…" : "送出問題"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">熱門問題</h2>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-slate-500">載入中…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            尚無已核准問題，成為第一個發問的人吧！
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-sm text-slate-900 whitespace-pre-wrap">
                  {q.content}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{q.is_anonymous ? "匿名" : q.author_display ?? "—"}</span>
                  <span>讚 {q.upvote_count}</span>
                  <button
                    type="button"
                    disabled={voteMutation.isPending || q.my_vote === "up"}
                    onClick={() => voteMutation.mutate(q.id)}
                    className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    {q.my_vote === "up" ? "已按讚" : "按讚"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
