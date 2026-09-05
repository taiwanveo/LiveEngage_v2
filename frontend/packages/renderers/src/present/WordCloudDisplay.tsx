import * as React from "react";
import { useMemo, useState } from "react";
import type { WordCount } from "../types";

interface WordCloudDisplayProps {
  words: WordCount[];
  large?: boolean;
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
}: WordCloudDisplayProps): React.JSX.Element {
  const [selectedWord, setSelectedWord] = useState<WordCount | null>(null);

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
            AI 語意聚合已啟用（點擊詞彙查看原始輸入）
          </span>
          <span className="text-muted opacity-80">
            共 {sorted.length} 個主題詞群
          </span>
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

          return (
            <button
              type="button"
              key={w.word}
              onClick={() => setSelectedWord(w)}
              className={
                large
                  ? compact
                    ? "group relative rounded-md border border-border/60 bg-surface-elevated/80 px-2.5 py-1 font-semibold text-foreground shadow-sm transition-all hover:scale-105 hover:bg-surface-elevated active:scale-95"
                    : "group relative rounded-lg border border-border/60 bg-surface-elevated/80 px-4 py-2 font-semibold text-foreground shadow-sm transition-all hover:scale-105 hover:bg-surface-elevated active:scale-95"
                  : "group relative rounded-lg bg-accent-muted px-3 py-1.5 font-medium text-accent transition-all hover:bg-accent/20 hover:shadow active:scale-95"
              }
              style={{ fontSize, lineHeight: 1.25 }}
              title={hasVariants ? "點擊查看原始詞彙明細" : undefined}
            >
              {hasVariants && (
                <span className="mr-1 inline-block text-[0.75em] text-amber-500 dark:text-amber-300 drop-shadow-sm">
                  ✨
                </span>
              )}
              <span>{w.word}</span>
              <span className="ml-1.5 font-normal text-[0.65em] opacity-75">
                ({w.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* 點擊詞彙展開的聚合明細 Modal */}
      {selectedWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedWord(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-500 dark:text-amber-400">✨</span>
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedWord.word}
                  </h3>
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
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-border bg-surface-elevated/70 p-3"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {v.word}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-accent">
                            {v.count} 票
                          </span>
                          <span className="font-mono text-xs text-muted">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
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
      )}
    </div>
  );
}

