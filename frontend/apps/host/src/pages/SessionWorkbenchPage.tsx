/** Session 三欄工作台：互動清單｜控場｜Participant 預覽（Slido 風格）。 */

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  POLL_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { PollRenderer } from "@liveengage/renderers";
import {
  ParticipantPreviewFrame,
  SessionToolbar,
  WorkbenchLayout,
} from "@liveengage/ui";
import { getAccessToken } from "../lib/auth";
import { createInteraction, listInteractions } from "../lib/interactionApi";
import { getPoll, getPollResults, pollAction } from "../lib/pollApi";
import {
  isPollType,
  POLL_TYPES,
  type InteractionSummary,
  type InteractionStatus,
  type PollAction,
  type PollInteractionType,
} from "../lib/pollTypes";
import {
  listSessions,
  participantJoinUrl,
  type SessionHost,
  type SessionVisibility,
} from "../lib/sessionApi";
import { JoinShareCard } from "../components/JoinShareCard";

interface Props {
  roomId: string;
  pollId?: string | undefined;
  onLogout: () => void;
}

const VISIBILITY_LABEL: Record<SessionVisibility, string> = {
  public: "Public（公開）",
  hidden: "Hidden（隱藏）",
  passcode: "Passcode",
  sso: "SSO",
  restricted: "Restricted（限制）",
};

const STATUS_LABEL: Record<SessionHost["status"], string> = {
  draft: "草稿",
  live: "進行中",
  ended: "已結束",
  archived: "已封存",
};

function isPollRunning(status: InteractionStatus): boolean {
  return status === "active" || status === "locked";
}

function presentAppUrl(roomId: string, pollId: string): string {
  const meta = import.meta as ImportMeta & { env?: { VITE_PRESENT_BASE?: string } };
  const base = (meta.env?.VITE_PRESENT_BASE ?? "https://le-present.zeabur.app").replace(/\/$/, "");
  return `${base}/#/rooms/${roomId}/polls/${pollId}/present`;
}

export function SessionWorkbenchPage({ roomId, pollId, onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [showShare, setShowShare] = useState(false);
  const [newType, setNewType] = useState<PollInteractionType>("multiple_choice");
  const [newTitle, setNewTitle] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = useMemo(
    () => sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null,
    [sessionsQuery.data, roomId]
  );

  const interactionsQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const polls = useMemo(
    () => (interactionsQuery.data ?? []).filter((i) => isPollType(i.type)),
    [interactionsQuery.data]
  );

  const selectedPollId = pollId ?? polls[0]?.id ?? null;

  const pollQuery = useQuery({
    queryKey: ["poll", selectedPollId],
    queryFn: () => getPoll(selectedPollId!),
    enabled: Boolean(selectedPollId),
    refetchInterval: 30_000,
  });

  const resultsQuery = useQuery({
    queryKey: ["poll-results", selectedPollId],
    queryFn: () => getPollResults(selectedPollId!),
    enabled: Boolean(selectedPollId),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createInteraction(roomId, {
        type: newType,
        ...(newTitle.trim() ? { title: newTitle.trim() } : {}),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      setNewTitle("");
      window.location.hash = `#/rooms/${roomId}/workbench/${created.id}`;
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, confirm }: { action: PollAction; confirm?: boolean }) =>
      pollAction(selectedPollId!, action, confirm ?? false),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["poll", selectedPollId] });
      void qc.invalidateQueries({ queryKey: ["poll-results", selectedPollId] });
    },
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (!selectedPollId || !POLL_EVENT_TYPES.has(event.type)) return;
      void qc.invalidateQueries({ queryKey: ["poll", selectedPollId] });
      void qc.invalidateQueries({ queryKey: ["poll-results", selectedPollId] });
    },
    [qc, selectedPollId]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleWsEvent,
  });

  const poll = pollQuery.data;
  const results = resultsQuery.data ?? null;
  const selectedIndex = polls.findIndex((p) => p.id === selectedPollId);

  const selectPoll = (id: string): void => {
    window.location.hash = `#/rooms/${roomId}/workbench/${id}`;
  };

  const goPrev = (): void => {
    if (selectedIndex > 0) selectPoll(polls[selectedIndex - 1]!.id);
  };

  const goNext = (): void => {
    if (selectedIndex >= 0 && selectedIndex < polls.length - 1) {
      selectPoll(polls[selectedIndex + 1]!.id);
    }
  };

  const runAction = (action: PollAction, needsConfirm?: boolean): void => {
    if (!selectedPollId) return;
    if (needsConfirm && !window.confirm("確定要重置並清除所有作答？")) return;
    actionMutation.mutate({ action, confirm: needsConfirm ?? false });
  };

  const dateLabel = session
    ? new Date(session.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <WorkbenchLayout
      toolbar={
        <SessionToolbar
          title={session?.title ?? "Session 工作台"}
          dateLabel={dateLabel}
          code={session?.code ?? "—"}
          visibilityLabel={session ? VISIBILITY_LABEL[session.visibility] : "—"}
          {...(session ? { statusLabel: STATUS_LABEL[session.status] } : {})}
          onBack={() => {
            window.location.hash = "#/dashboard";
          }}
          navControls={
            <>
              <button
                type="button"
                disabled={!selectedPollId || !poll || !isPollRunning(poll.status)}
                onClick={() => runAction("stop")}
                className="rounded-full border border-danger/50 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-40"
              >
                Stop
              </button>
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={goPrev}
                className="le-btn-secondary !min-h-[32px] !px-2.5 !text-xs"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={selectedIndex < 0 || selectedIndex >= polls.length - 1}
                onClick={goNext}
                className="le-btn-secondary !min-h-[32px] !px-2.5 !text-xs"
              >
                Next
              </button>
              <span className="pl-1 text-xs tabular-nums text-muted">
                {polls.length > 0 && selectedIndex >= 0
                  ? `${selectedIndex + 1}/${polls.length}`
                  : "—"}
              </span>
            </>
          }
          {...(session ? { onShare: () => setShowShare((v) => !v) } : {})}
          {...(selectedPollId
            ? {
                onPresent: () =>
                  window.open(presentAppUrl(roomId, selectedPollId), "_blank", "noopener"),
              }
            : {})}
          presentMenu={
            selectedPollId ? (
              <a
                href={`#/rooms/${roomId}/polls/${selectedPollId}/present`}
                className="inline-flex min-h-[36px] items-center px-2 text-accent-fg hover:bg-accent/90"
                title="內嵌投影"
              >
                ···
              </a>
            ) : null
          }
          onLogout={onLogout}
          extra={
            <span
              className={`le-status-dot ${connected ? "le-status-dot-live" : "bg-muted"}`}
              title={connected ? "WS 已連線" : "WS 未連線"}
            />
          }
        />
      }
      sidebar={
        <InteractionSidebar
          polls={polls}
          selectedId={selectedPollId}
          loading={interactionsQuery.isLoading}
          newType={newType}
          newTitle={newTitle}
          creating={createMutation.isPending}
          onNewType={setNewType}
          onNewTitle={setNewTitle}
          onCreate={() => createMutation.mutate()}
          onSelect={selectPoll}
        />
      }
      main={
        <div className="space-y-4">
          {showShare && session ? (
            <JoinShareCard code={session.code} joinUrl={participantJoinUrl(session.code)} />
          ) : null}

          {!selectedPollId ? (
            <EmptyMain message="請從左側建立或選擇一個 Poll。" />
          ) : pollQuery.isLoading ? (
            <EmptyMain message="載入 Poll…" />
          ) : poll ? (
            <>
              <PollControlBar
                poll={poll}
                pending={actionMutation.isPending}
                onToggle={(action, needsConfirm) => runAction(action, needsConfirm)}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {poll.type.replace(/_/g, " ")}
                  </p>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {poll.title ?? "未命名題目"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    狀態：{poll.status}
                    {poll.result_visible ? " · 結果已揭示" : ""}
                    {" · "}
                    回應：{results?.response_count ?? 0}
                  </p>
                </div>
                <a
                  href={`#/rooms/${roomId}/polls/${poll.id}/builder`}
                  className="le-btn-secondary !min-h-[36px] !text-xs"
                >
                  編輯題目
                </a>
              </div>

              <div className="le-card overflow-hidden p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">投影預覽</h3>
                <PollRenderer mode="present" poll={poll} results={results} />
              </div>
            </>
          ) : (
            <EmptyMain message="無法載入 Poll。" />
          )}
        </div>
      }
      preview={
        <ParticipantPreviewFrame
          subtitle="All votes are live and saved"
          footer={poll ? `回應數 ${results?.response_count ?? 0}` : undefined}
        >
          {poll ? (
            <PollRenderer
              mode="answer"
              poll={poll}
              results={poll.result_visible ? results : null}
            />
          ) : (
            <p className="text-center text-xs text-muted">選擇 Poll 以預覽參與者畫面</p>
          )}
        </ParticipantPreviewFrame>
      }
    />
  );
}

function PollControlBar(props: {
  poll: {
    status: InteractionStatus;
    result_visible: boolean;
  };
  pending: boolean;
  onToggle: (action: PollAction, needsConfirm?: boolean) => void;
}): React.JSX.Element {
  const { poll, pending, onToggle } = props;
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
        inactiveLabel="隱藏結果"
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

function EmptyMain({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-sm text-muted">
      {message}
    </div>
  );
}

function InteractionSidebar(props: {
  polls: InteractionSummary[];
  selectedId: string | null;
  loading: boolean;
  newType: PollInteractionType;
  newTitle: string;
  creating: boolean;
  onNewType: (t: PollInteractionType) => void;
  onNewTitle: (v: string) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex h-full max-h-[calc(100vh-4.5rem)] flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">My interactions</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" className="le-btn-primary flex-1 !min-h-[36px] !py-2 !text-xs" onClick={props.onCreate} disabled={props.creating}>
            {props.creating ? "…" : "+ Add"}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <select
            value={props.newType}
            onChange={(e) => props.onNewType(e.target.value as PollInteractionType)}
            className="le-input !py-1.5 !text-xs"
          >
            {POLL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={props.newTitle}
            onChange={(e) => props.onNewTitle(e.target.value)}
            placeholder="題目標題（選填）"
            className="le-input !py-1.5 !text-xs"
          />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {props.loading ? (
          <li className="p-4 text-center text-xs text-muted">載入中…</li>
        ) : props.polls.length === 0 ? (
          <li className="p-4 text-center text-xs text-muted">尚無 Poll</li>
        ) : (
          props.polls.map((item) => {
            const active = item.id === props.selectedId;
            return (
              <li key={item.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => props.onSelect(item.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-accent bg-accent-muted shadow-sm"
                      : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.title ?? "未命名題目"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {item.type} · {item.status}
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
