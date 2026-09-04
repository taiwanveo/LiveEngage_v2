/** AI Q&A 語意去重與同義題合併控制列（AI-002：智慧偵測、同義群組預覽、票數累計合併）。 */

import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  dedupRoomQuestions,
  mergeDuplicateQuestions,
  type AiQuestionCluster,
} from "../../lib/qaApi";

interface Props {
  roomId: string;
  onMerged?: () => void;
}

export function QaAiDedupBar({ roomId, onMerged }: Props): React.JSX.Element {
  const queryClient = useQueryClient();

  const [scanning, setScanning] = useState(false);
  const [mergingClusterId, setMergingClusterId] = useState<string | null>(null);
  const [clusters, setClusters] = useState<AiQuestionCluster[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await dedupRoomQuestions(roomId);
      setClusters(res.clusters || []);
      setHasScanned(true);
      if ((res.clusters || []).length === 0) {
        setSuccessMsg("掃描完畢，目前未發現同義或重複提問，問題清單非常健康！");
      }
    } catch (err: unknown) {
      setError(formatUserFacingError(err, "AI 語意去重掃描失敗，請稍後再試。"));
    } finally {
      setScanning(false);
    }
  };

  const handleMerge = async (cluster: AiQuestionCluster) => {
    setMergingClusterId(cluster.cluster_id);
    setError(null);
    try {
      const res = await mergeDuplicateQuestions(roomId, {
        primary_question_id: cluster.primary_question.id,
        duplicate_question_ids: cluster.duplicate_questions.map((d) => d.id),
      });

      setSuccessMsg(res.message);
      // 從目前列表中移除已合併的 cluster
      setClusters((prev) => prev.filter((c) => c.cluster_id !== cluster.cluster_id));

      await queryClient.invalidateQueries({ queryKey: ["moderation", roomId] });
      if (onMerged) {
        onMerged();
      }
    } catch (err: unknown) {
      setError(formatUserFacingError(err, "合併提問失敗，請稍後重試。"));
    } finally {
      setMergingClusterId(null);
    }
  };

  const handleDismissCluster = (clusterId: string) => {
    setClusters((prev) => prev.filter((c) => c.cluster_id !== clusterId));
  };

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface shadow-sm overflow-hidden transition-all">
      {/* Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-surface-raised px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white text-xs shadow-sm">
            ✨
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-foreground">
                AI Q&A 語意去重與同義題合併
              </h2>
              <span className="rounded-full bg-purple-500/15 px-2 py-0.2 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                AI-002
              </span>
              {clusters.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 animate-pulse">
                  發現 {clusters.length} 組相似題
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted">
              自動分析同義提問意圖，一鍵合併重複題並全數累計按讚票數，避免好問題票數分散
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clusters.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted hover:text-foreground"
            >
              {isExpanded ? "收起推薦" : "展開推薦"}
            </button>
          )}
          <button
            type="button"
            disabled={scanning}
            onClick={handleScan}
            className="le-btn-primary flex items-center gap-1.5 !px-3 !py-1.5 !text-xs shadow-sm"
          >
            {scanning ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>AI 正在比對語意…</span>
              </>
            ) : (
              <>
                <span>🔍 AI 掃描重複提問</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="border-b border-danger/20 bg-danger/10 px-4 py-2 text-xs text-danger">
          ⚠️ {error}
        </div>
      )}
      {successMsg && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          ✅ {successMsg}
        </div>
      )}

      {/* Detected Clusters Panel */}
      {isExpanded && clusters.length > 0 && (
        <div className="p-3 space-y-3 bg-surface-raised/30">
          {clusters.map((cluster, idx) => {
            const isMerging = mergingClusterId === cluster.cluster_id;
            const extraVotes =
              cluster.combined_upvotes - cluster.primary_question.upvote_count;

            return (
              <div
                key={cluster.cluster_id}
                className="rounded-xl border border-border bg-surface p-3.5 shadow-sm transition hover:border-purple-500/40"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Content Column */}
                  <div className="flex-1 space-y-2.5">
                    {/* Similarity reason tag */}
                    <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-300">
                      <span>💡</span>
                      <span className="font-semibold">AI 辨識同義原因：</span>
                      <span>{cluster.similarity_reason}</span>
                    </div>

                    {/* Primary Question */}
                    <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="inline-flex items-center gap-1 font-bold text-accent">
                          <span>👑</span>
                          <span>代表主提問（保留）</span>
                        </span>
                        <span className="font-semibold text-foreground">
                          👍 {cluster.primary_question.upvote_count} 票 ·{" "}
                          {cluster.primary_question.author_display ?? "匿名"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground">
                        {cluster.primary_question.content}
                      </p>
                    </div>

                    {/* Duplicate Questions List */}
                    <div className="space-y-1.5 pl-2 border-l-2 border-border/80">
                      <label className="text-[11px] font-semibold text-muted block">
                        🔗 建議合併的同義題目（{cluster.duplicate_questions.length} 題）：
                      </label>
                      {cluster.duplicate_questions.map((dup) => (
                        <div
                          key={dup.id}
                          className="flex items-start justify-between rounded bg-surface-raised/70 px-2.5 py-1.5 text-xs"
                        >
                          <span className="text-foreground/90 flex-1 mr-2">
                            • {dup.content}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted">
                            👍 {dup.upvote_count} 票 · {dup.author_display ?? "匿名"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Column */}
                  <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-start gap-2 pt-1 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-muted block">合併後預估總票數</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {cluster.combined_upvotes} 票
                        {extraVotes > 0 && (
                          <span className="ml-1 text-xs font-normal text-muted">
                            (+{extraVotes} 票)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDismissCluster(cluster.cluster_id)}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
                      >
                        忽略
                      </button>
                      <button
                        type="button"
                        disabled={isMerging}
                        onClick={() => handleMerge(cluster)}
                        className="le-btn-primary flex items-center gap-1 !px-3 !py-1.5 !text-xs font-semibold shadow-sm"
                      >
                        {isMerging ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>合併中…</span>
                          </>
                        ) : (
                          <>
                            <span>🔗 一鍵合併</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
