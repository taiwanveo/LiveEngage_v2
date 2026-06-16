/** 工作台左欄：Poll + Sprint9 互動清單、建立與拖曳排序（滑鼠 + 觸控）與 ↑↓ 微調。 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import {
  interactionStatusLabel,
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import {
  WORKBENCH_CREATE_OPTIONS,
  reorderWorkbenchIds,
  type WorkbenchCreateType,
} from "../../lib/workbenchTypes";

interface Props {
  items: InteractionSummary[];
  selectedId: string | null;
  loading: boolean;
  reorderable?: boolean;
  reordering?: boolean;
  newType: WorkbenchCreateType;
  newTitle: string;
  creating: boolean;
  onNewType: (t: WorkbenchCreateType) => void;
  onNewTitle: (v: string) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}

function ReorderMoveButton(props: {
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
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted transition-colors ${
        disabled
          ? "cursor-not-allowed border-border/60 text-muted/40"
          : "border-border bg-surface hover:border-accent/40 hover:bg-accent-muted hover:text-accent active:bg-accent-muted"
      }`}
    >
      <svg
        width="12"
        height="12"
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

function DragHandle(props: {
  disabled: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLSpanElement>) => void;
}): React.JSX.Element {
  return (
    <span
      draggable={!props.disabled}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      style={{ touchAction: "none" }}
      className={`flex shrink-0 touch-none select-none items-center self-stretch px-1 ${
        props.disabled
          ? "cursor-default text-muted/30"
          : "cursor-grab text-muted hover:text-foreground active:cursor-grabbing"
      }`}
      aria-hidden
      title={props.disabled ? undefined : "拖曳調整順序"}
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

export function WorkbenchInteractionSidebar(props: Props): React.JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);

  const reorderable =
    props.reorderable !== false &&
    Boolean(props.onReorder) &&
    props.items.length > 1 &&
    !props.reordering;

  const resetDrag = useCallback(() => {
    dragFromRef.current = null;
    overRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const finishDrag = useCallback(
    (targetIndex: number) => {
      const from = dragFromRef.current;
      if (
        from === null ||
        from === targetIndex ||
        !props.onReorder ||
        !reorderable
      ) {
        resetDrag();
        return;
      }
      const ids = props.items.map((item) => item.id);
      props.onReorder(reorderWorkbenchIds(ids, from, targetIndex));
      resetDrag();
    },
    [props, reorderable, resetDrag]
  );

  const updateOverIndexFromPoint = useCallback((clientX: number, clientY: number): void => {
    const el = document.elementFromPoint(clientX, clientY);
    const row = el?.closest<HTMLElement>("[data-workbench-index]");
    if (!row) return;
    const idx = Number(row.dataset.workbenchIndex);
    if (Number.isNaN(idx)) return;
    overRef.current = idx;
    setOverIndex(idx);
  }, []);

  const handleGripPointerMove = (e: React.PointerEvent<HTMLSpanElement>): void => {
    if (dragFromRef.current === null || !reorderable) return;
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
      if (!props.onReorder || !reorderable) return;
      const to = direction === "up" ? index - 1 : index + 1;
      if (to < 0 || to >= props.items.length) return;
      const ids = props.items.map((item) => item.id);
      props.onReorder(reorderWorkbenchIds(ids, index, to));
    },
    [props, reorderable]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <h2 className="text-xs font-semibold text-foreground">互動項目</h2>
        <div className="mt-2 space-y-1.5">
          <select
            value={props.newType}
            onChange={(e) => props.onNewType(e.target.value as WorkbenchCreateType)}
            className="le-input w-full !py-1 !text-[11px]"
          >
            {WORKBENCH_CREATE_OPTIONS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="text"
            value={props.newTitle}
            onChange={(e) => props.onNewTitle(e.target.value)}
            placeholder="標題（選填）"
            className="le-input w-full !py-1 !text-[11px] placeholder:text-[10px]"
          />
          <button
            type="button"
            className="le-btn-primary w-full !min-h-[32px] !py-1.5 !text-[11px]"
            onClick={props.onCreate}
            disabled={props.creating}
          >
            {props.creating ? "…" : "新增互動"}
          </button>
        </div>
      </div>
      <ul
        className={`min-h-0 flex-1 p-1.5 pt-3 ${
          props.items.length >= 6 ? "overflow-y-auto" : "overflow-y-visible"
        }`}
      >
        {props.loading ? (
          <li className="p-3 text-center text-[11px] text-muted">載入中…</li>
        ) : props.items.length === 0 ? (
          <li className="p-3 text-center text-[11px] text-muted">尚無互動項目</li>
        ) : (
          props.items.map((item, index) => {
            const active = item.id === props.selectedId;
            const isDragging = dragIndex === index;
            const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
            return (
              <li
                key={item.id}
                data-workbench-index={index}
                className={`mb-1.5 select-none rounded-lg transition-opacity ${
                  isDragging ? "opacity-40" : ""
                } ${isOver ? "ring-2 ring-accent/50 ring-offset-1" : ""}`}
                onDragOver={(e) => {
                  if (!reorderable) return;
                  e.preventDefault();
                  overRef.current = index;
                  setOverIndex(index);
                }}
                onDragLeave={() => {
                  if (overIndex === index) setOverIndex(null);
                }}
                onDrop={(e) => {
                  if (!reorderable) return;
                  e.preventDefault();
                  finishDrag(index);
                }}
              >
                <div
                  className={`flex items-stretch overflow-hidden rounded-lg border transition-colors ${
                    active
                      ? "border-accent bg-accent-muted shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <DragHandle
                    disabled={!reorderable}
                    onDragStart={(e) => {
                      if (!reorderable) return;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(index));
                      dragFromRef.current = index;
                      setDragIndex(index);
                      overRef.current = index;
                      setOverIndex(index);
                    }}
                    onDragEnd={resetDrag}
                    onPointerDown={(e) => {
                      if (!reorderable) return;
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
                  />
                  <button
                    type="button"
                    onClick={() => props.onSelect(item.id)}
                    className="min-w-0 flex-1 px-2 py-2 text-left select-text"
                  >
                    <p className="truncate text-xs font-medium text-foreground">
                      {item.title ?? "未命名"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {interactionTypeLabel(item.type)} ·{" "}
                      {interactionStatusLabel(item.status)}
                    </p>
                  </button>
                  {reorderable ? (
                    <span className="flex shrink-0 items-center gap-0.5 self-center pr-1">
                      <ReorderMoveButton
                        direction="up"
                        label={`將「${item.title ?? "未命名"}」上移`}
                        disabled={index === 0}
                        onClick={() => moveByArrow(index, "up")}
                      />
                      <ReorderMoveButton
                        direction="down"
                        label={`將「${item.title ?? "未命名"}」下移`}
                        disabled={index === props.items.length - 1}
                        onClick={() => moveByArrow(index, "down")}
                      />
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
