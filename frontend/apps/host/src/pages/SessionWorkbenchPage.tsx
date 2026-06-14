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
  pollTypeLabel,
  interactionStatusLabel,
  type InteractionSummary,
  type PollAction,
  type PollInteractionType,
} from "../lib/pollTypes";
import {
  listSessions,
  type SessionHost,
  type SessionVisibility,
} from "../lib/sessionApi";
import { HOST_DASHBOARD_HASH } from "../components/HostShell";
import { HostRoomHeaderActions } from "../components/HostRoomHeaderActions";
import { PollControlBar, isPollRunning } from "../components/PollControlBar";

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

export function SessionWorkbenchPage({ roomId, pollId, onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
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
          titleHref={HOST_DASHBOARD_HASH}
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
                className="rounded-full border border-danger/50 px-2 py-0.5 text-[10px] font-medium text-danger hover:bg-danger/5 disabled:opacity-40"
              >
                Stop
              </button>
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={goPrev}
                className="le-btn-secondary !min-h-[24px] !px-2 !py-0.5 !text-[10px]"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={selectedIndex < 0 || selectedIndex >= polls.length - 1}
                onClick={goNext}
                className="le-btn-secondary !min-h-[24px] !px-2 !py-0.5 !text-[10px]"
              >
                Next
              </button>
              <span className="pl-0.5 text-[10px] tabular-nums text-muted">
                {polls.length > 0 && selectedIndex >= 0
                  ? `${selectedIndex + 1}/${polls.length}`
                  : "—"}
              </span>
            </>
          }
          chromeFooterActions={
            <HostRoomHeaderActions
              roomId={roomId}
              {...(selectedPollId ? { presentPollId: selectedPollId } : {})}
              presentMenu={
                selectedPollId ? (
                  <a
                    href={`#/rooms/${roomId}/polls/${selectedPollId}/present`}
                    className="inline-flex min-h-[28px] items-center px-1.5 text-[10px] text-accent-fg hover:bg-accent/90"
                    title="內嵌投影"
                  >
                    ···
                  </a>
                ) : null
              }
            />
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
                  <p className="text-xs font-medium text-muted">
                    {pollTypeLabel(poll.type)}
                  </p>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {poll.title ?? "未命名題目"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    狀態：{interactionStatusLabel(poll.status)}
                    {poll.result_visible ? " · 結果已揭示" : ""}
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
          stats={
            poll ? (
              <p className="text-[10px] font-semibold tabular-nums leading-tight text-foreground">
                回應數{" "}
                <span className="font-display text-xs text-accent">
                  {results?.response_count ?? 0}
                </span>
              </p>
            ) : undefined
          }
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-foreground">互動項目</h2>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            className="le-btn-primary w-full !min-h-[32px] !py-1.5 !text-[11px]"
            onClick={props.onCreate}
            disabled={props.creating}
          >
            {props.creating ? "…" : "+ Add"}
          </button>
        </div>
        <div className="mt-2 space-y-1.5">
          <select
            value={props.newType}
            onChange={(e) => props.onNewType(e.target.value as PollInteractionType)}
            className="le-input w-full !py-1 !text-[11px]"
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
            className="le-input w-full !py-1 !text-[11px]"
          />
        </div>
      </div>
      <ul
        className={`min-h-0 flex-1 p-1.5 ${
          props.polls.length >= 6 ? "overflow-y-auto" : "overflow-y-visible"
        }`}
      >
        {props.loading ? (
          <li className="p-3 text-center text-[11px] text-muted">載入中…</li>
        ) : props.polls.length === 0 ? (
          <li className="p-3 text-center text-[11px] text-muted">尚無 Poll</li>
        ) : (
          props.polls.map((item) => {
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
                    {item.title ?? "未命名題目"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {pollTypeLabel(item.type)} · {interactionStatusLabel(item.status)}
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
