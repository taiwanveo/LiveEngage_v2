import * as React from "react";
import type { WordCount } from "../types";

interface WordCloudDisplayProps {
  words: WordCount[];
  large?: boolean;
}

export function WordCloudDisplay({
  words,
  large = false,
}: WordCloudDisplayProps): React.JSX.Element {
  const max = Math.max(1, ...words.map((w) => w.count));

  return (
    <div className="flex flex-wrap gap-3">
      {words.map((w) => {
        const scale = 0.85 + (w.count / max) * 0.85;
        return (
          <span
            key={w.word}
            className={
              large
                ? "rounded-lg bg-white/10 px-4 py-2 font-semibold text-white"
                : "rounded-lg bg-primary-50 px-3 py-1.5 font-medium text-primary-800"
            }
            style={{ fontSize: `${scale}rem` }}
          >
            {w.word}
            <span className="ml-2 text-xs opacity-70">({w.count})</span>
          </span>
        );
      })}
    </div>
  );
}
