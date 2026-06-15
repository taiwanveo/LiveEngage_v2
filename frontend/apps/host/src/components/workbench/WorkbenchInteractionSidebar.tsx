/** 工作台左欄：Poll + Sprint9 互動清單與建立。 */

import * as React from "react";
import {
  interactionStatusLabel,
  interactionTypeLabel,
  type InteractionSummary,
} from "../../lib/pollTypes";
import {
  WORKBENCH_CREATE_OPTIONS,
  type WorkbenchCreateType,
} from "../../lib/workbenchTypes";

interface Props {
  items: InteractionSummary[];
  selectedId: string | null;
  loading: boolean;
  newType: WorkbenchCreateType;
  newTitle: string;
  creating: boolean;
  onNewType: (t: WorkbenchCreateType) => void;
  onNewTitle: (v: string) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
}

export function WorkbenchInteractionSidebar(props: Props): React.JSX.Element {
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
          props.items.map((item) => {
            const active = item.id === props.selectedId;
            return (
              <li key={item.id} className="mb-1.5">
                <button
                  type="button"
                  onClick={() => props.onSelect(item.id)}
                  className={`w-full rounded-lg border px-2 py-2 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent-muted shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.title ?? "未命名"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {interactionTypeLabel(item.type)} · {interactionStatusLabel(item.status)}
                  </p>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
