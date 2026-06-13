import * as React from "react";
import type { TextEntry } from "../types";

interface OpenTextListProps {
  entries: TextEntry[];
  large?: boolean;
}

export function OpenTextList({
  entries,
  large = false,
}: OpenTextListProps): React.JSX.Element {
  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={
            large
              ? "rounded-xl border border-white/10 bg-white/5 p-4"
              : "rounded-lg border border-slate-200 bg-slate-50 p-4"
          }
        >
          <p className={large ? "text-xl text-white" : "text-base text-slate-800"}>
            {entry.text}
          </p>
          {entry.author_display ? (
            <p className={large ? "mt-2 text-sm text-slate-400" : "mt-2 text-xs text-slate-500"}>
              — {entry.author_display}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
