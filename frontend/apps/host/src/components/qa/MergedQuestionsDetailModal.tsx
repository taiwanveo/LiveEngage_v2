/** Q&A 已合併提問明細 Modal（AI-002：檢視原始題目、顯示 AI / 手動標記、支援解除合併）。 */

import * as React from "react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import { unmergeQuestion } from "../../lib/qaApi";
import type { QuestionPublic, MergedQuestionItem } from "../../types";

interface Props {
  roomId: string;
  question: QuestionPublic | null;
  onClose: () => void;
}

export function MergedQuestionsDetailModal({
  roomId,
  question,
  onClose,
}: Props): React.JSX.Element | null {
  const queryClient = useQueryClient();
  const [unmergingId, setUnmergingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 本地維護子清單以即時反應移除操作
  const [mergedList, setMergedList] = useState<MergedQuestionItem[]>(
    question?.merged_questions ?? []
  );

  React.useEffect(() => {
    setMergedList(question?.merged_questions ?? []);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [question]);

  const unmergeMutation = useMutation({
    mutationFn: (targetQuestionId: string) =>
      unmergeQuestion(roomId, targetQuestionId),
    onSuccess: (data, targetQuestionId) => {
      setSuccessMsg(data.message);
      setMergedList((prev) => prev.filter((item) => item.id !== targetQuestionId));
      void queryClient.invalidateQueries({ queryKey: ["moderation", roomId] });
      void queryClient.invalidateQueries({ queryKey: ["qa-screen", roomId] });
    },
    onError: (err) => {
      setErrorMsg(formatUserFacingError(err, "解除合併失敗，請重試。"));
    },
    onSettled: () => {
      setUnmergingId(null);
    },
  });

  if (!question) return null;

  const handleUnmerge = (targetQuestionId: string) => {
    setUnmergingId(targetQuestionId);
    setErrorMsg(null);
    setSuccessMsg(null);
    unmergeMutation.mutate(targetQuestionId);
  };

  const isManual = question.is_manual_merge;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={isManual ? "text-purple-600 text-lg" : "text-amber-500 text-lg"}>
                {isManual ? "👤✨" : "✨"}
              </span>
              <h3 className="text-base font-bold text-foreground">
                {isManual ? "手動聚合提問明細" : "AI 語意聚合提問明細"}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isManual
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                }`}
              >
                {isManual ? "主持人拖曳" : "AI 智慧歸併"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              檢視此主題包含的原始個別問題，票數已全數累計至主提問中。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-foreground transition"
            title="關閉"
          >
            ✕
          </button>
        </div>

        {/* 主提問 */}
        <div className="rounded-xl border border-primary-200 bg-primary-50/40 dark:border-primary-900/50 dark:bg-primary-950/20 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              📌 代表主提問
            </span>
            <span className="font-bold text-foreground">
              累計總讚數：👍 {question.upvote_count}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
            {question.content}
          </p>
          <div className="text-[11px] text-muted">
            發問者：{question.is_anonymous ? "匿名" : question.author_display || "未署名"}
          </div>
        </div>

        {/* 提示訊息 */}
        {errorMsg && (
          <div className="rounded-lg bg-danger-muted/30 border border-danger/30 p-2.5 text-xs text-danger">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg bg-success-muted/30 border border-success/30 p-2.5 text-xs text-success">
            {successMsg}
          </div>
        )}

        {/* 被合併的原始個別問題清單 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-muted px-1">
            <span>包含的原始提問 ({mergedList.length})</span>
            <span>可單獨解除合併</span>
          </div>

          {mergedList.length === 0 ? (
            <p className="text-center py-6 text-xs text-muted">
              目前無其他合併子問題（可能已全數解除）。
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {mergedList.map((item) => {
                const isPending = unmergingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-raised p-3 text-xs transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${
                            item.is_manual
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          }`}
                        >
                          {item.is_manual ? "👤 手動" : "✨ AI"}
                        </span>
                        <span className="text-muted text-[11px]">
                          {item.is_anonymous ? "匿名" : item.author_display || "未署名"}
                        </span>
                        <span className="text-muted text-[11px]">
                          • 原獲得 👍 {item.upvote_count} 票
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed">
                        {item.content}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isPending || unmergeMutation.isPending}
                      onClick={() => handleUnmerge(item.id)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted hover:border-danger hover:bg-danger-muted/20 hover:text-danger active:scale-95 transition disabled:opacity-50"
                      title="解除合併此問題，將其還原為獨立提問並自總票數扣除"
                    >
                      {isPending ? "處理中…" : "移出 / 解除"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="le-btn-secondary !text-xs !py-1.5 !px-4"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
