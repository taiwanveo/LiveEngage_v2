/** 熱門問題列表：FLIP 重排 + 👍／👎 投票。 */

import * as React from "react";
import { useRef, useState } from "react";
import type { QuestionPublic } from "../lib/qaApi";
import { useAutoFlipList } from "../hooks/useAutoFlipList";

interface Props {
  items: QuestionPublic[];
  votingId: string | null;
  downvoteEnabled: boolean;
  onVote: (questionId: string, direction: "up" | "down") => void;
}

const voteBtnClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated/60 px-2.5 py-1 text-sm transition-[background-color,border-color,box-shadow] hover:bg-surface-elevated disabled:opacity-50";

function voteBtnActiveClass(direction: "up" | "down", active: boolean): string {
  if (!active) return "";
  return direction === "up"
    ? " !border-emerald-500/40 !bg-emerald-500/10"
    : " !border-rose-500/40 !bg-rose-500/10";
}

function voteEmojiClass(active: boolean): string {
  return active
    ? "text-base leading-none transition-[filter,opacity,transform] duration-150"
    : "text-base leading-none opacity-45 grayscale transition-[filter,opacity,transform] duration-150";
}

export function QaQuestionList({
  items,
  votingId,
  downvoteEnabled,
  onVote,
}: Props): React.JSX.Element {
  const listRef = useRef<HTMLUListElement>(null);
  const [bumpId, setBumpId] = useState<string | null>(null);
  const [bumpDir, setBumpDir] = useState<"up" | "down" | null>(null);

  const orderSignature = items
    .map((q) => `${q.id}:${q.score}:${q.upvote_count}:${q.downvote_count}`)
    .join("|");
  useAutoFlipList(listRef, orderSignature);

  const handleVote = (questionId: string, direction: "up" | "down"): void => {
    setBumpId(questionId);
    setBumpDir(direction);
    window.setTimeout(() => {
      setBumpId((id) => (id === questionId ? null : id));
      setBumpDir((dir) => (dir === direction ? null : dir));
    }, 300);
    onVote(questionId, direction);
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">
              {q.is_anonymous ? "匿名" : q.author_display ?? "—"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={votingId === q.id}
                aria-label={q.my_vote === "up" ? "已按讚，再按可取消" : "按讚"}
                aria-pressed={q.my_vote === "up"}
                onClick={() => handleVote(q.id, "up")}
                className={`${voteBtnClass}${voteBtnActiveClass("up", q.my_vote === "up")}`}
              >
                <span aria-hidden className={voteEmojiClass(q.my_vote === "up")}>
                  👍
                </span>
                <span
                  className={
                    bumpId === q.id && bumpDir === "up"
                      ? "qa-vote-count--bump tabular-nums"
                      : "tabular-nums"
                  }
                >
                  {q.upvote_count}
                </span>
              </button>
              {downvoteEnabled ? (
                <button
                  type="button"
                  disabled={votingId === q.id}
                  aria-label={q.my_vote === "down" ? "已按倒讚，再按可取消" : "按倒讚"}
                  aria-pressed={q.my_vote === "down"}
                  onClick={() => handleVote(q.id, "down")}
                  className={`${voteBtnClass}${voteBtnActiveClass("down", q.my_vote === "down")}`}
                >
                  <span aria-hidden className={voteEmojiClass(q.my_vote === "down")}>
                    👎
                  </span>
                  <span
                    className={
                      bumpId === q.id && bumpDir === "down"
                        ? "qa-vote-count--bump tabular-nums"
                        : "tabular-nums"
                    }
                  >
                    {q.downvote_count}
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
