/** 參與者 Q&A：提問與瀏覽已核准問題。 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, useSystemNotice } from "@liveengage/ui";
import { ApiException } from "../lib/api";
import { listQuestions, submitQuestion, voteQuestion } from "../lib/qaApi";

interface Props {
  roomId: string;
}

export function RoomQaPanel({ roomId }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const [content, setContent] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [submitOk, setSubmitOk] = React.useState(false);

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
      setSubmitOk(true);
      void qc.invalidateQueries({ queryKey: ["qa-public", roomId] });
    },
    onError: (err: unknown) => {
      setSubmitOk(false);
      showError(
        err instanceof ApiException ? err.error.message : "提交失敗"
      );
    },
  });

  const voteMutation = useMutation({
    mutationFn: (questionId: string) => voteQuestion(questionId, "up"),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["qa-public", roomId] }),
    onError: (err: unknown) => {
      showError(err instanceof ApiException ? err.error.message : "按讚失敗");
    },
  });

  const items = questionsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="le-card p-5">
        <h2 className="text-lg font-semibold text-foreground">向主持人提問</h2>
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
            className="le-input min-h-[88px] resize-y"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            匿名提問
          </label>
          <Modal
            open={submitOk}
            onClose={() => setSubmitOk(false)}
            title="已送出"
            size="sm"
          >
            <p className="text-sm text-muted">
              待主持人審核後會顯示在列表中。
            </p>
          </Modal>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="le-btn-primary !min-h-[42px] disabled:opacity-50"
          >
            {submitMutation.isPending ? "送出中…" : "送出問題"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">熱門問題</h2>
        {questionsQuery.isLoading ? (
          <p className="text-sm text-muted">載入中…</p>
        ) : items.length === 0 ? (
          <p className="le-card border-dashed p-8 text-center text-sm text-muted">
            尚無已核准問題，成為第一個發問的人吧！
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((q) => (
              <li key={q.id} className="le-card p-4">
                <div className="flex items-start gap-2">
                  {q.highlighted ? (
                    <span
                      className="mt-0.5 shrink-0 text-base leading-none text-amber-500"
                      title="這個問題已被活動主持人標記"
                      aria-label="這個問題已被活動主持人標記"
                      role="img"
                    >
                      ★
                    </span>
                  ) : null}
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-foreground">
                    {q.content}
                  </p>
                </div>
                {q.status === "answered" ? (
                  <span className="mt-1 inline-block rounded bg-success/15 px-2 py-0.5 text-xs text-success">
                    已回答
                  </span>
                ) : null}
                {(q.replies ?? []).length > 0 ? (
                  <div className="mt-2 space-y-1 border-l-2 border-accent/30 pl-3">
                    {(q.replies ?? []).map((r) => (
                      <p key={r.id} className="text-xs text-muted">
                        <span className="font-medium text-accent">主持人回覆：</span>
                        {r.content}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{q.is_anonymous ? "匿名" : q.author_display ?? "—"}</span>
                  <span>讚 {q.upvote_count}</span>
                  <button
                    type="button"
                    disabled={voteMutation.isPending || q.my_vote === "up"}
                    onClick={() => voteMutation.mutate(q.id)}
                    className="le-btn-secondary !min-h-0 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {q.my_vote === "up" ? "已按讚" : "按讚"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {systemNoticeModal}
    </div>
  );
}
