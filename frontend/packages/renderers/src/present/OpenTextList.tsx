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
              ? "rounded-xl border border-border bg-surface-elevated/70 p-4"
              : "rounded-lg border border-border bg-surface-elevated/60 p-4"
          }
        >
          <p className={large ? "text-xl text-foreground font-medium" : "text-base text-foreground"}>
            {entry.text}
          </p>
          {entry.author_display ? (
            <p className={large ? "mt-2 text-sm text-muted" : "mt-2 text-xs text-muted"}>
              — {entry.author_display}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
