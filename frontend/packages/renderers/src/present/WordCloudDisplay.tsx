import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { WordCount } from "../types";

interface WordCloudDisplayProps {
  words: WordCount[];
  large?: boolean | undefined;
  enableDragDrop?: boolean | undefined;
  onManualMerge?: ((sourceWord: string, targetWord: string) => void | Promise<void>) | undefined;
  onManualSplit?: ((clusterWord: string, variantWord: string) => void | Promise<void>) | undefined;
}

const SCROLL_FALLBACK_MIN_WORDS = 48;

/** 依詞數與字長估算投影字級，回應越多字越小。 */
function presentDensityScale(words: WordCount[]): number {
  if (words.length === 0) return 1;
  const count = words.length;
  const longest = Math.max(...words.map((w) => w.word.length), 1);
  const countFactor = Math.max(0.38, 1.35 / Math.pow(count, 0.42));
  const lenFactor = Math.min(1, 12 / longest);
  return Math.min(countFactor, lenFactor, 1.25);
}

export function WordCloudDisplay({
  words,
  large = false,
  enableDragDrop = false,
  onManualMerge,
  onManualSplit,
}: WordCloudDisplayProps): React.JSX.Element {
  const [selectedWord, setSelectedWord] = useState<WordCount | null>(null);
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [dragOverWord, setDragOverWord] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (!selectedWord) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setSelectedWord(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedWord]);

  const max = Math.max(1, ...words.map((w) => w.count));
  const density = large ? presentDensityScale(words) : 1;
  const compact = large && density < 0.72;
  const useScroll = large && words.length >= SCROLL_FALLBACK_MIN_WORDS;

  const isAnyClustered = useMemo(
    () =>
      words.some(
        (w) => w.is_ai_clustered || (w.variants && w.variants.length > 1)
      ),
    [words]
  );

  const sorted = useMemo(
    () =>
      [...words].sort(
        (a, b) => b.count - a.count || a.word.localeCompare(b.word)
      ),
    [words]
  );

  if (words.length === 0) {
    return (
      <p
        className={
          large
            ? "text-center text-lg text-muted"
            : "text-sm text-muted"
        }
      >
        尚無詞彙
      </p>
    );
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      {isAnyClustered && (
        <div className="mb-2 flex items-center justify-between text-xs text-accent">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-block animate-pulse">✨</span>
            AI 語意聚合已啟用
          </span>
          <span className="text-muted opacity-80">
            共 {sorted.length} 個主題詞群
          </span>
        </div>
      )}

      {enableDragDrop && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-primary-500/20 bg-primary-500/5 px-3 py-1.5 text-xs text-muted">
          <span className="text-primary-500">💡</span>
          <span>按住詞彙拖曳至另一詞彙即可手動合併；點擊詞彙可查看原始表達明細或解除特定合併詞。</span>
        </div>
      )}

      <div
        className={
          large
            ? `flex min-h-0 flex-1 flex-wrap content-center justify-center gap-x-3 gap-y-2 ${
                useScroll
                  ? "max-h-[min(72vh,calc(100dvh-12rem))] overflow-y-auto pr-1"
                  : "overflow-hidden"
              }`
            : "flex flex-wrap gap-3"
        }
        aria-label="文字雲"
      >
        {sorted.map((w) => {
          const freqScale = 0.72 + (w.count / max) * 0.55;
          const baseRem = large ? 1.75 : 1;
          const fontSize = `${freqScale * density * baseRem}rem`;
          const hasVariants = Boolean(w.variants && w.variants.length > 0);
          const isManual = Boolean(w.is_manual);
          const isDragging = draggedWord === w.word;
          const isTarget = dragOverWord === w.word;

          let btnClass = "";
          if (large) {
            const sizeClass = compact ? "rounded-md px-2.5 py-1" : "rounded-lg px-4 py-2";
            if (isTarget) {
              btnClass = `group relative ${sizeClass} font-semibold text-foreground shadow-lg ring-2 ring-primary-500 bg-primary-500/20 scale-110 z-10 transition-all`;
            } else if (isDragging) {
              btnClass = `group relative ${sizeClass} font-semibold text-foreground shadow-sm opacity-40 scale-95 transition-all border border-dashed border-primary-500`;
            } else if (isManual) {
              btnClass = `group relative ${sizeClass} font-semibold text-foreground shadow-sm transition-all hover:scale-105 active:scale-95 border border-purple-400/50 dark:border-purple-400/40 bg-purple-500/10 dark:bg-purple-950/30 text-purple-950 dark:text-purple-100 ring-1 ring-purple-400/30`;
            } else {
              btnClass = `group relative ${sizeClass} font-semibold text-foreground shadow-sm transition-all hover:scale-105 hover:bg-surface-elevated active:scale-95 border border-border/60 bg-surface-elevated/80`;
            }
          } else {
            if (isTarget) {
              btnClass = "group relative rounded-lg px-3 py-1.5 font-medium shadow-lg ring-2 ring-primary-500 bg-primary-500/20 scale-110 z-10 transition-all text-primary-600 dark:text-primary-300";
            } else if (isDragging) {
              btnClass = "group relative rounded-lg px-3 py-1.5 font-medium shadow-sm opacity-40 scale-95 transition-all border border-dashed border-primary-500 text-muted";
            } else if (isManual) {
              btnClass = "group relative rounded-lg px-3 py-1.5 font-medium transition-all hover:shadow active:scale-95 border border-purple-400/50 dark:border-purple-400/40 bg-purple-500/10 text-purple-800 dark:text-purple-200 ring-1 ring-purple-400/30";
            } else {
              btnClass = "group relative rounded-lg bg-accent-muted px-3 py-1.5 font-medium text-accent transition-all hover:bg-accent/20 hover:shadow active:scale-95";
            }
          }

          return (
            <button
              type="button"
              key={w.word}
              draggable={enableDragDrop && !isActionLoading}
              onDragStart={(e) => {
                if (!enableDragDrop || isActionLoading) return;
                e.dataTransfer.setData("text/plain", w.word);
                e.dataTransfer.effectAllowed = "move";
                setDraggedWord(w.word);
              }}
              onDragEnd={() => {
                setDraggedWord(null);
                setDragOverWord(null);
              }}
              onDragOver={(e) => {
                if (!enableDragDrop || isActionLoading || !draggedWord || draggedWord === w.word) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverWord !== w.word) {
                  setDragOverWord(w.word);
                }
              }}
              onDragLeave={() => {
                if (dragOverWord === w.word) {
                  setDragOverWord(null);
                }
              }}
              onDrop={async (e) => {
                if (!enableDragDrop || isActionLoading) return;
                e.preventDefault();
                const source = e.dataTransfer.getData("text/plain") || draggedWord;
                const target = w.word;
                setDraggedWord(null);
                setDragOverWord(null);
                if (source && target && source !== target && onManualMerge) {
                  setIsActionLoading(true);
                  try {
                    await onManualMerge(source, target);
                  } finally {
                    setIsActionLoading(false);
                  }
                }
              }}
              onClick={() => setSelectedWord(w)}
              className={btnClass}
              style={{ fontSize, lineHeight: 1.25, cursor: enableDragDrop ? "grab" : undefined }}
              title={
                hasVariants
                  ? isManual
                    ? "點擊查看原始詞彙（含主持人手動合併）"
                    : "點擊查看原始詞彙明細"
                  : enableDragDrop
                  ? "可拖曳至其他詞彙進行合併"
                  : undefined
              }
            >
              {isManual ? (
                <span className="mr-1 inline-flex items-center gap-0.5 text-[0.75em] text-purple-600 dark:text-purple-400 drop-shadow-sm" title="主持人手動聚合">
                  <span className="text-[0.85em]">👤</span>✨
                </span>
              ) : hasVariants ? (
                <span className="mr-1 inline-block text-[0.75em] text-amber-500 dark:text-amber-300 drop-shadow-sm">
                  ✨
                </span>
              ) : null}
              <span>{w.word}</span>
              <span className="ml-1.5 font-normal text-[0.65em] opacity-75">
                ({w.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* 點擊詞彙展開的聚合明細 Modal */}
      {selectedWord &&
        (() => {
          const modalNode = (
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setSelectedWord(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-border pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={selectedWord.is_manual ? "text-purple-500 text-base" : "text-amber-500 dark:text-amber-400 text-base"}>
                        {selectedWord.is_manual ? "👤✨" : "✨"}
                      </span>
                      <h3 className="text-lg font-bold text-foreground">
                        {selectedWord.word}
                      </h3>
                      {selectedWord.is_manual && (
                        <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                          含主持人手動聚合
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      語意聚合總計{" "}
                      <span className="font-bold text-accent">
                        {selectedWord.count}
                      </span>{" "}
                      票
                      {selectedWord.variants?.length
                        ? `（涵蓋 ${selectedWord.variants.length} 種表達）`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWord(null)}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                    aria-label="關閉"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                  {selectedWord.variants && selectedWord.variants.length > 0 ? (
                    selectedWord.variants.map((v, idx) => {
                      const pct = Math.round((v.count / selectedWord.count) * 100);
                      const canSplit = Boolean(onManualSplit && selectedWord.variants && selectedWord.variants.length > 1);
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-3 ${
                            v.is_manual
                              ? "border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/20"
                              : "border-border bg-surface-elevated/70"
                          }`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {v.word}
                              </span>
                              {v.is_manual && (
                                <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                                  👤 主持人合併
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-accent">
                                {v.count} 票
                              </span>
                              <span className="font-mono text-xs text-muted">
                                {pct}%
                              </span>
                              {canSplit && (
                                <button
                                  type="button"
                                  disabled={isActionLoading}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isActionLoading || !onManualSplit) return;
                                    setIsActionLoading(true);
                                    try {
                                      await onManualSplit(selectedWord.word, v.word);
                                      setSelectedWord(null);
                                    } finally {
                                      setIsActionLoading(false);
                                    }
                                  }}
                                  className="ml-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/20 active:scale-95 disabled:opacity-50 dark:text-rose-400"
                                  title="解除此詞彙聚合"
                                >
                                  ✕ 解除
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                v.is_manual ? "bg-purple-500 dark:bg-purple-400" : "bg-accent"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-border bg-surface-elevated/70 p-3 text-sm text-foreground">
                      <div className="flex items-center justify-between">
                        <span>原始輸入：{selectedWord.word}</span>
                        <span className="font-semibold text-accent">
                          {selectedWord.count} 票
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedWord(null)}
                    className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>
          );

          return typeof document !== "undefined"
            ? createPortal(modalNode, document.body)
            : modalNode;
        })()}
    </div>
  );
}


