/** 排序題：拖曳調整順序（滑鼠 + 觸控）與 ↑↓ 微調（觸控備援）。 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import type { PollOption } from "../types";

interface Props {
  orderedIds: string[];
  optionsById: Map<string, PollOption>;
  disabled?: boolean;
  rankedCount: number;
  onChange: (next: string[]) => void;
}

function reorderIds(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) {
    return ids;
  }
  const next = [...ids];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed!);
  return next;
}

function DragGrip(props: { disabled?: boolean }): React.JSX.Element {
  return (
    <span
      className={`flex shrink-0 touch-none select-none items-center self-stretch px-1 ${
        props.disabled
          ? "cursor-default text-slate-300"
          : "cursor-grab text-slate-400 active:cursor-grabbing"
      }`}
      aria-hidden
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
        <circle cx="2" cy="2" r="1.25" />
        <circle cx="8" cy="2" r="1.25" />
        <circle cx="2" cy="7" r="1.25" />
        <circle cx="8" cy="7" r="1.25" />
        <circle cx="2" cy="12" r="1.25" />
        <circle cx="8" cy="12" r="1.25" />
      </svg>
    </span>
  );
}

function RankMoveButton(props: {
  direction: "up" | "down";
  disabled?: boolean;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  const { direction, disabled = false, label, onClick } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-slate-600 transition-colors ${
        disabled
          ? "cursor-not-allowed border-slate-100 text-slate-300"
          : "border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 active:bg-primary-100"
      }`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {direction === "up" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  );
}

export function RankingSortableList({
  orderedIds,
  optionsById,
  disabled = false,
  rankedCount,
  onChange,
}: Props): React.JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);

  const resetDrag = useCallback(() => {
    dragFromRef.current = null;
    overRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const finishDrag = useCallback(
    (targetIndex: number) => {
      const from = dragFromRef.current;
      if (from === null || from === targetIndex || disabled) {
        resetDrag();
        return;
      }
      onChange(reorderIds(orderedIds, from, targetIndex));
      resetDrag();
    },
    [disabled, onChange, orderedIds, resetDrag]
  );

  const updateOverIndexFromPoint = useCallback((clientX: number, clientY: number): void => {
    const el = document.elementFromPoint(clientX, clientY);
    const row = el?.closest<HTMLElement>("[data-rank-index]");
    if (!row) return;
    const idx = Number(row.dataset.rankIndex);
    if (Number.isNaN(idx)) return;
    overRef.current = idx;
    setOverIndex(idx);
  }, []);

  const handleGripPointerMove = (e: React.PointerEvent<HTMLSpanElement>): void => {
    if (dragFromRef.current === null || disabled) return;
    updateOverIndexFromPoint(e.clientX, e.clientY);
  };

  const handleGripPointerUp = (e: React.PointerEvent<HTMLSpanElement>): void => {
    if (dragFromRef.current === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    finishDrag(overRef.current ?? dragFromRef.current);
  };

  const moveByArrow = useCallback(
    (index: number, direction: "up" | "down"): void => {
      if (disabled) return;
      const to = direction === "up" ? index - 1 : index + 1;
      if (to < 0 || to >= orderedIds.length) return;
      onChange(reorderIds(orderedIds, index, to));
    },
    [disabled, onChange, orderedIds]
  );

  const showRankCutoff = rankedCount < orderedIds.length;

  return (
    <div className="space-y-2">
      {showRankCutoff ? (
        <p className="text-xs text-slate-500">
          拖曳把手或使用右側箭頭調整順序；前 {rankedCount} 名為您的排序結果。
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          拖曳把手或使用右側箭頭，調整由上到下的優先順序。
        </p>
      )}
      <ul className="space-y-2">
        {orderedIds.map((id, index) => {
          const opt = optionsById.get(id);
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
          const inRanked = index < rankedCount;
          return (
            <li
              key={id}
              data-rank-index={index}
              className={`rounded-lg border transition-opacity ${
                isDragging ? "opacity-40" : ""
              } ${isOver ? "ring-2 ring-primary-400/60" : ""} ${
                inRanked
                  ? "border-primary-200 bg-primary-50/60"
                  : "border-slate-200 bg-slate-50/50 opacity-80"
              }`}
              onDragOver={(e) => {
                if (disabled) return;
                e.preventDefault();
                overRef.current = index;
                setOverIndex(index);
              }}
              onDrop={(e) => {
                if (disabled) return;
                e.preventDefault();
                finishDrag(index);
              }}
            >
              <div className="flex items-center gap-2 px-2 py-2.5">
                <span
                  className={`w-7 shrink-0 text-center text-sm font-semibold ${
                    inRanked ? "text-primary-700" : "text-slate-400"
                  }`}
                >
                  {inRanked ? `#${index + 1}` : "·"}
                </span>
                <span
                  draggable={!disabled}
                  onDragStart={() => {
                    if (disabled) return;
                    dragFromRef.current = index;
                    setDragIndex(index);
                    setOverIndex(index);
                  }}
                  onDragEnd={resetDrag}
                  onPointerDown={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    dragFromRef.current = index;
                    setDragIndex(index);
                    overRef.current = index;
                    setOverIndex(index);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={handleGripPointerUp}
                  onPointerCancel={handleGripPointerUp}
                  className="flex items-center"
                  style={{ touchAction: "none" }}
                >
                  <DragGrip disabled={disabled} />
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-800">
                  {opt?.text ?? "選項"}
                </span>
                {!disabled ? (
                  <span className="flex shrink-0 items-center gap-0.5">
                    {index > 0 ? (
                      <RankMoveButton
                        direction="up"
                        label={`將「${opt?.text ?? "選項"}」上移`}
                        onClick={() => moveByArrow(index, "up")}
                      />
                    ) : null}
                    {index < orderedIds.length - 1 ? (
                      <RankMoveButton
                        direction="down"
                        label={`將「${opt?.text ?? "選項"}」下移`}
                        onClick={() => moveByArrow(index, "down")}
                      />
                    ) : null}
                  </span>
                ) : null}
              </div>
              {showRankCutoff && index === rankedCount - 1 ? (
                <div className="border-t border-dashed border-primary-300/60 px-2 py-1 text-[10px] text-primary-700/80">
                  以上為排序結果
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
