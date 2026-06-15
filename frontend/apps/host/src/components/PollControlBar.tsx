/** Poll 控場 toggle 列（工作台 / 控制台共用）。 */

import * as React from "react";
import type { InteractionStatus, PollAction } from "../lib/pollTypes";

function isPollRunning(status: InteractionStatus): boolean {
  return status === "active" || status === "locked";
}

export { isPollRunning };

interface PollControlState {
  status: InteractionStatus;
  result_visible: boolean;
}

interface Props {
  poll: PollControlState;
  pending: boolean;
  onToggle: (action: PollAction, needsConfirm?: boolean) => void;
  /** 緊湊列（工作台頂欄）不包外框 */
  variant?: "card" | "inline";
  showReset?: boolean;
}

export function PollControlBar({
  poll,
  pending,
  onToggle,
  variant = "card",
  showReset = true,
}: Props): React.JSX.Element {
  const toggles = (
    <PollControlToggles
      poll={poll}
      pending={pending}
      onToggle={onToggle}
      size={variant === "inline" ? "compact" : "default"}
      showReset={showReset}
    />
  );

  if (variant === "inline") {
    return toggles;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
      {toggles}
    </div>
  );
}

export function PollControlToggles({
  poll,
  pending,
  onToggle,
  size = "default",
  showReset = true,
}: {
  poll: PollControlState;
  pending: boolean;
  onToggle: (action: PollAction, needsConfirm?: boolean) => void;
  size?: "default" | "compact";
  showReset?: boolean;
}): React.JSX.Element {
  const running = isPollRunning(poll.status);
  const locked = poll.status === "locked";

  return (
    <>
      <ControlToggle
        active={running}
        activeLabel="結束"
        inactiveLabel="開始"
        disabled={pending}
        accent={running ? "danger" : "default"}
        size={size}
        onClick={() => onToggle(running ? "stop" : "start")}
      />
      <ControlToggle
        active={locked}
        activeLabel="解除鎖定"
        inactiveLabel="鎖定"
        disabled={pending || !running}
        size={size}
        onClick={() => onToggle(locked ? "unlock" : "lock")}
      />
      <ControlToggle
        active={poll.result_visible}
        activeLabel="隱藏答案"
        inactiveLabel="揭曉答案"
        disabled={pending}
        size={size}
        onClick={() => onToggle(poll.result_visible ? "hide" : "reveal")}
      />
      {showReset ? (
        <ControlAction
          label="重設"
          disabled={pending}
          size={size}
          onClick={() => onToggle("reset", true)}
        />
      ) : null}
    </>
  );
}

type ControlAccent = "default" | "success" | "danger";
type ControlSize = "default" | "compact";

function controlSizeClass(size: ControlSize): string {
  return size === "compact"
    ? "min-h-[24px] px-2 py-0.5 text-[10px]"
    : "min-h-[32px] px-3 py-1 text-xs";
}

function controlDotClass(active: boolean, accent: ControlAccent, size: ControlSize): string {
  const dim = size === "compact" ? "h-1 w-1" : "h-1.5 w-1.5";
  if (!active) return `${dim} shrink-0 rounded-full bg-muted`;
  if (accent === "success") return `${dim} shrink-0 rounded-full bg-success`;
  if (accent === "danger") return `${dim} shrink-0 rounded-full bg-danger`;
  return `${dim} shrink-0 rounded-full bg-accent`;
}

function controlInactiveClass(): string {
  return "border-border bg-background text-foreground hover:border-accent/30 hover:bg-surface-elevated";
}

function controlActiveClass(accent: ControlAccent): string {
  if (accent === "success") return "border-success/40 bg-success/10 text-success";
  if (accent === "danger") return "border-danger/40 bg-danger/10 text-danger";
  return "border-accent/40 bg-accent-muted text-accent";
}

/** 單次動作按鈕（外觀與未按下的 ControlToggle 一致，例如重設）。 */
export function ControlAction(props: {
  label: string;
  disabled?: boolean;
  size?: ControlSize;
  onClick: () => void;
}): React.JSX.Element {
  const size = props.size ?? "default";

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition disabled:opacity-50 ${controlSizeClass(size)} ${controlInactiveClass()}`}
    >
      <span className={controlDotClass(false, "default", size)} />
      {props.label}
    </button>
  );
}

export function ControlToggle(props: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  disabled?: boolean;
  accent?: ControlAccent;
  size?: ControlSize;
  onClick: () => void;
}): React.JSX.Element {
  const label = props.active ? props.activeLabel : props.inactiveLabel;
  const size = props.size ?? "default";
  const accent = props.accent ?? "default";

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition disabled:opacity-50 ${controlSizeClass(size)} ${
        props.active ? controlActiveClass(accent) : controlInactiveClass()
      }`}
    >
      <span className={controlDotClass(props.active, accent, size)} />
      {label}
    </button>
  );
}
