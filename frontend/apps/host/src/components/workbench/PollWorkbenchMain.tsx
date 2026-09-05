/** Poll 工作台中欄：標題、編輯、刪除、投影預覽、AI 語意聚合控管。 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PollRenderer,
  type PollDetail,
  type PollResults,
} from "@liveengage/renderers";
import { pollTypeLabel } from "../../lib/pollTypes";
import {
  toggleAiCluster,
  manualMergeCluster,
  manualSplitCluster,
} from "../../lib/pollApi";
import { WorkbenchInteractionStatusBadge } from "./WorkbenchInteractionStatusBadge";
import { WorkbenchInteractionTitle } from "./WorkbenchInteractionTitle";

interface Props {
  roomId: string;
  poll: PollDetail;
  results: PollResults | null;
}

export function PollWorkbenchMain({
  roomId,
  poll,
  results,
}: Props): React.JSX.Element {
  const qc = useQueryClient();

  const isWordCloud = poll.type === "word_cloud";
  const isClustered = Boolean(
    results?.is_ai_clustered || poll.settings_public?.ai_cluster
  );

  const clusterMutation = useMutation({
    mutationFn: ({
      enabled,
      forceRefresh,
    }: {
      enabled: boolean;
      forceRefresh?: boolean;
    }) => toggleAiCluster(poll.id, enabled, Boolean(forceRefresh)),
    onSuccess: (updatedResults) => {
      qc.setQueryData(["poll-results", poll.id], updatedResults);
      void qc.invalidateQueries({ queryKey: ["poll-results", poll.id] });
      void qc.invalidateQueries({ queryKey: ["poll", poll.id] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: ({
      sourceWord,
      targetWord,
    }: {
      sourceWord: string;
      targetWord: string;
    }) => manualMergeCluster(poll.id, sourceWord, targetWord),
    onSuccess: (updatedResults) => {
      qc.setQueryData(["poll-results", poll.id], updatedResults);
      void qc.invalidateQueries({ queryKey: ["poll-results", poll.id] });
      void qc.invalidateQueries({ queryKey: ["poll", poll.id] });
    },
  });

  const splitMutation = useMutation({
    mutationFn: ({
      clusterWord,
      variantWord,
    }: {
      clusterWord: string;
      variantWord: string;
    }) => manualSplitCluster(poll.id, clusterWord, variantWord),
    onSuccess: (updatedResults) => {
      qc.setQueryData(["poll-results", poll.id], updatedResults);
      void qc.invalidateQueries({ queryKey: ["poll-results", poll.id] });
      void qc.invalidateQueries({ queryKey: ["poll", poll.id] });
    },
  });

  const isPending =
    clusterMutation.isPending ||
    mergeMutation.isPending ||
    splitMutation.isPending;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">
            {pollTypeLabel(poll.type)}
          </p>
          <WorkbenchInteractionTitle
            roomId={roomId}
            interactionId={poll.id}
            title={poll.title}
            placeholder="未命名題目"
          />
          {poll.result_visible ? (
            <p className="mt-1 text-xs text-muted">結果已揭示</p>
          ) : null}
        </div>
        <WorkbenchInteractionStatusBadge status={poll.status} />
      </div>

      {isWordCloud && (
        <div className="le-card flex flex-wrap items-center justify-between gap-3 border-primary-500/20 bg-gradient-to-r from-primary-500/5 via-primary-500/10 to-transparent p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15 text-lg">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">
                  AI 語意聚合
                </h4>
                {isClustered && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    已生效
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                自動將同義、相似或碎片化的字詞彙整為代表性主題詞群，大螢幕一眼看清共識。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isClustered ? (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    clusterMutation.mutate({
                      enabled: true,
                      forceRefresh: true,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-surface-hover active:scale-95 disabled:opacity-50"
                  title="重新執行 AI 分群計算最新收到的詞彙"
                >
                  <span className={isPending ? "animate-spin" : ""}>🔄</span>
                  {isPending ? "運算中…" : "重新聚合"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    clusterMutation.mutate({ enabled: false })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-all hover:bg-surface-hover hover:text-foreground active:scale-95 disabled:opacity-50"
                >
                  🔤 顯示原始詞彙
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  clusterMutation.mutate({ enabled: true })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-primary-500 active:scale-95 disabled:opacity-50"
              >
                <span>✨</span>
                {isPending ? "分析運算中…" : "啟用 AI 語意聚合"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="le-card overflow-hidden p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">投影預覽</h3>
          {isWordCloud && isClustered && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-primary-500 font-medium">
                <span>✨</span> AI 聚合模式
              </span>
              {results?.word_counts?.some((w) => w.is_manual) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                  <span>👤</span> 含人工手動聚合
                </span>
              )}
            </div>
          )}
        </div>
        <PollRenderer
          mode="present"
          poll={poll}
          results={results}
          enableDragDrop={isWordCloud}
          onManualMerge={async (source, target) => {
            await mergeMutation.mutateAsync({
              sourceWord: source,
              targetWord: target,
            });
          }}
          onManualSplit={async (cluster, variant) => {
            await splitMutation.mutateAsync({
              clusterWord: cluster,
              variantWord: variant,
            });
          }}
        />
      </div>
    </>
  );
}

