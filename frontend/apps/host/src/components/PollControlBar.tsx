/** Poll 控場 toggle 列（工作台 / 控制台共用）。 */

import * as React from "react";
import type { InteractionStatus, PollAction } from "../lib/pollTypes";

function isPollRunning(status: InteractionStatus): boolean {
  return status === "active" || status === "locked";
}

export { isPollRunning };

interface Props {
  poll: {
    status: InteractionStatus;
    result_visible: boolean;
  };
  pending: boolean;
  onToggle: (action: PollAction, needsConfirm?: boolean) => void;
}

export function PollControlBar({ poll, pending, onToggle }: Props): React.JSX.Element {
  const running = isPollRunning(poll.status);
  const locked = poll.status === "locked";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
      <ControlToggle
        active={running}
        activeLabel="進行中"
        inactiveLabel="開始"
        disabled={pending}
        accent={running ? "success" : "default"}
        onClick={() => onToggle(running ? "stop" : "start")}
      />
      <ControlToggle
        active={locked}
        activeLabel="已鎖定"
        inactiveLabel="鎖定"
        disabled={pending || !running}
        onClick={() => onToggle(locked ? "unlock" : "lock")}
      />
      <ControlToggle
        active={poll.result_visible}
        activeLabel="結果顯示"
        inactiveLabel="揭示結果"
        disabled={pending}
        onClick={() => onToggle(poll.result_visible ? "hide" : "reveal")}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => onToggle("reset", true)}
        className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-surface-elevated hover:text-foreground disabled:opacity-50"
      >
        重置
      </button>
    </div>
  );
}

function ControlToggle(props: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  disabled?: boolean;
  accent?: "default" | "success";
  onClick: () => void;
}): React.JSX.Element {
  const label = props.active ? props.activeLabel : props.inactiveLabel;
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
        props.active
          ? props.accent === "success"
            ? "border-success/40 bg-success/10 text-success"
            : "border-accent/40 bg-accent-muted text-accent"
          : "border-border bg-background text-muted hover:border-accent/30 hover:text-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          props.active
            ? props.accent === "success"
              ? "bg-success"
              : "bg-accent"
            : "bg-muted"
        }`}
      />
      {label}
    </button>
  );
}
