/** 熱門問題列表：FLIP 重排 + 按讚互動。 */

import * as React from "react";
import { useRef, useState } from "react";
import type { QuestionPublic } from "../lib/qaApi";
import { useAutoFlipList } from "../hooks/useAutoFlipList";

interface Props {
  items: QuestionPublic[];
  votingId: string | null;
  onVote: (questionId: string) => void;
}

export function QaQuestionList({
  items,
  votingId,
  onVote,
}: Props): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const [bumpId, setBumpId] = useState<string | null>(null);

  const orderSignature = items.map((q) => `${q.id}:${q.score}:${q.upvote_count}`).join("|");
  useAutoFlipList(listRef, orderSignature);

  const handleVote = (questionId: string): void => {
    setBumpId(questionId);
    window.setTimeout(() => setBumpId((id) => (id === questionId ? null : id)), 300);
    onVote(questionId);
  };

  return (
    <ul ref={listRef} className="qa-flip-list space-y-3">
      {items.map((q) => (
        <li key={q.id} data-flip-id={q.id} className="le-card p-4">
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
            <span
              className={bumpId === q.id ? "qa-vote-count--bump inline-block tabular-nums" : "tabular-nums"}
            >
              讚 {q.upvote_count}
            </span>
            <button
              type="button"
              disabled={votingId === q.id || q.my_vote === "up"}
              onClick={() => handleVote(q.id)}
              className="le-btn-secondary !min-h-0 px-2 py-1 text-xs disabled:opacity-50"
            >
              {q.my_vote === "up" ? "已按讚" : votingId === q.id ? "送出中…" : "按讚"}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
