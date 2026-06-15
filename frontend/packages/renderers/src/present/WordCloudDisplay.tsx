import * as React from "react";
import { useMemo } from "react";
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
  const max = Math.max(1, ...words.map((w) => w.count));
  const density = large ? presentDensityScale(words) : 1;
  const compact = large && density < 0.72;
  const useScroll = large && words.length >= SCROLL_FALLBACK_MIN_WORDS;

  const sorted = useMemo(
    () => [...words].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)),
    [words]
  );

  if (words.length === 0) {
    return (
      <p className={large ? "text-center text-lg text-slate-500" : "text-sm text-slate-500"}>
        尚無詞彙
      </p>
    );
  }

  return (
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
        return (
          <span
            key={w.word}
            className={
              large
                ? compact
                  ? "rounded-md bg-white/10 px-2.5 py-1 font-semibold text-white"
                  : "rounded-lg bg-white/10 px-4 py-2 font-semibold text-white"
                : "rounded-lg bg-primary-50 px-3 py-1.5 font-medium text-primary-800"
            }
            style={{ fontSize, lineHeight: 1.25 }}
          >
            {w.word}
            <span className="ml-1.5 text-[0.65em] opacity-70">({w.count})</span>
          </span>
        );
      })}
    </div>
  );
}
