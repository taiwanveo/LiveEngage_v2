/** Session 三欄工作台：Poll + Sprint9 統一控場（Slido 風格）。 */

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  formatUserFacingError,
  IDEAS_EVENT_TYPES,
  POLL_EVENT_TYPES,
  QA_EVENT_TYPES,
  QUIZ_EVENT_TYPES,
  useRoomWebSocket,
  type WsEvent,
} from "@liveengage/realtime";
import { AiConfigTrigger, HostRoomNavHeader, WorkbenchLayout, useSystemNotice } from "@liveengage/ui";
import { getAccessToken, canEditHostContent } from "../lib/auth";
import {
  createInteraction,
  listInteractions,
  reorderWorkbenchInteractions,
  updateInteractionStatus,
} from "../lib/interactionApi";
import { getPoll, pollAction } from "../lib/pollApi";
import {
  isPollType,
  interactionTypeLabel,
  type InteractionSummary,
  type PollAction,
} from "../lib/pollTypes";
import {
  listSessions,
  updateSession,
} from "../lib/sessionApi";
import {
  SESSION_VISIBILITY_LABEL,
  sessionStatusBadge,
} from "../lib/hostSessionHeader";
import {
  applyWorkbenchOrder,
  toInteractionCreateType,
  workbenchInteractions,
  isSprint9Type,
  type WorkbenchCreateType,
} from "../lib/workbenchTypes";
import { supportsLiveAggregateControls } from "@liveengage/renderers";
import { LiveAggregateToggles } from "../components/LiveAggregateToggles";
import { HOST_DASHBOARD_HASH, hostRoomNavItems } from "../components/HostShell";
import { useHostRoomNavLiveState } from "../lib/useHostRoomNavLiveState";
import { HostRoomHubBreadcrumb } from "../components/HostBreadcrumb";
import { HostRoomHeaderActions } from "../components/HostRoomHeaderActions";
import {
  useScreenControl,
  useScreenWorkbenchSync,
} from "../lib/useScreenControl";
import {
  ControlAction,
  ControlToggle,
  canRevealPollResult,
  POLL_REVEAL_REQUIRES_STARTED_HINT,
} from "../components/PollControlBar";
import { AiPollGeneratorModal } from "../components/polls/AiPollGeneratorModal";
import { isPollRunning } from "../lib/pollTypes";
import {
  applyHostPollActionSuccess,
  createSelfPollActionGuard,
  handleHostPollWsEvent,
} from "../lib/pollActionCache";
import { WorkbenchInteractionSidebar } from "../components/workbench/WorkbenchInteractionSidebar";
import {
  WorkbenchMainPanel,
  WorkbenchPreviewPanel,
} from "../components/workbench/WorkbenchMainPanel";
import { useActiveQuizQuestionLabel } from "../components/workbench/QuizWorkbenchMain";
import {
  WorkbenchInteractionActions,
  WORKBENCH_S9_EDIT_ID,
} from "../components/workbench/WorkbenchInteractionActions";

interface Props {
  roomId: string;
  interactionId?: string | undefined;
  onLogout: () => void;
}

function workbenchItemDisplayTitle(
  item: InteractionSummary,
  pollTitle?: string | null
): string {
  if (isPollType(item.type)) {
    return pollTitle?.trim() || "未命名題目";
  }
  const fallback: Record<string, string> = {
    quiz: "未命名 Quiz",
    ideas: "點子牆",
    survey: "問卷",
  };
  return item.title?.trim() || fallback[item.type] || interactionTypeLabel(item.type);
}

export function SessionWorkbenchPage({
  roomId,
  interactionId,
  onLogout,
}: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const selfActionGuard = useRef(createSelfPollActionGuard());
  const [newType, setNewType] = useState<WorkbenchCreateType>("multiple_choice");
  const [newTitle, setNewTitle] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["host-sessions"],
    queryFn: listSessions,
  });

  const session = useMemo(
    () => sessionsQuery.data?.find((s) => s.default_room_id === roomId) ?? null,
    [sessionsQuery.data, roomId]
  );

  const screen = useScreenControl(roomId);

  const interactionsQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
  });

  const workbenchItems = useMemo(
    () => workbenchInteractions(interactionsQuery.data),
    [interactionsQuery.data]
  );

  const selectedId = interactionId ?? workbenchItems[0]?.id ?? null;
  const selectedItem =
    workbenchItems.find((i) => i.id === selectedId) ?? null;

  const pollQuery = useQuery({
    queryKey: ["poll", selectedId],
    queryFn: () => getPoll(selectedId!),
    enabled: Boolean(selectedItem && isPollType(selectedItem.type)),
  });


  const quizActiveLabel = useActiveQuizQuestionLabel(
    selectedItem?.type === "quiz" ? selectedItem.id : null
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createInteraction(roomId, {
        type: toInteractionCreateType(newType),
        ...(newTitle.trim() ? { title: newTitle.trim() } : {}),
      }),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      setNewTitle("");
      window.location.hash = `#/rooms/${roomId}/workbench/${created.id}`;
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "建立失敗"));
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      pollId,
      action,
      confirm,
    }: {
      pollId: string;
      action: PollAction;
      confirm?: boolean;
    }) => pollAction(pollId, action, confirm ?? false),
    onSuccess: (data, variables) => {
      const pollId = data.poll_id ?? variables.pollId;
      selfActionGuard.current.mark(pollId);
      applyHostPollActionSuccess(qc, {
        roomId,
        pollId,
        action: variables.action,
        data,
      });
      if (variables.action === "reveal") {
        screen.syncPollSubView(pollId, "results", session?.title ?? null);
      } else if (variables.action === "hide") {
        screen.syncPollSubView(pollId, "question", session?.title ?? null);
      }
      if (variables.action === "start" && session && session.status === "draft") {
        void updateSession(session.id, { status: "live" }).then(() => {
          void qc.invalidateQueries({ queryKey: ["host-sessions"] });
          showSuccess("已啟動投票，活動已自動設為進行中（Live）");
        });
      }
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "操作失敗"));
    },
  });

  const sprint9StatusMutation = useMutation({
    mutationFn: ({
      interactionId,
      status,
    }: {
      interactionId: string;
      status: "active" | "stopped";
    }) => updateInteractionStatus(interactionId, status),
    onSuccess: (_, variables) => {
      showSuccess("狀態已更新");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
      if (variables.status === "active" && session && session.status === "draft") {
        void updateSession(session.id, { status: "live" }).then(() => {
          void qc.invalidateQueries({ queryKey: ["host-sessions"] });
          showSuccess("已啟動互動，活動已自動設為進行中（Live）");
        });
      }
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "操作失敗"));
    },
  });

  const sessionStatusMutation = useMutation({
    mutationFn: (status: "draft" | "live" | "ended") => {
      if (!session) throw new Error("無效活動");
      return updateSession(session.id, { status });
    },
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["host-sessions"] });
      showSuccess(
        updated.status === "live"
          ? "活動已正式開始（Live）！參加者端已可進入作答。"
          : updated.status === "ended"
            ? "活動已設為結束"
            : "狀態已更新"
      );
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "活動狀態更新失敗"));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      reorderWorkbenchInteractions(roomId, orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: ["interactions", roomId] });
      const previous = qc.getQueryData<InteractionSummary[]>([
        "interactions",
        roomId,
      ]);
      if (previous) {
        qc.setQueryData(
          ["interactions", roomId],
          applyWorkbenchOrder(previous, orderedIds)
        );
      }
      return { previous };
    },
    onError: (err: unknown, _ids, context) => {
      if (context?.previous) {
        qc.setQueryData(["interactions", roomId], context.previous);
      }
      showError(formatUserFacingError(err, "排序儲存失敗"));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
  });

  const handleWsEvent = useCallback(
    (event: WsEvent) => {
      if (QA_EVENT_TYPES.has(event.type)) {
        void qc.invalidateQueries({ queryKey: ["moderation", roomId] });
      }
      if (QUIZ_EVENT_TYPES.has(event.type) && selectedId) {
        void qc.invalidateQueries({ queryKey: ["quiz-questions", selectedId] });
        void qc.invalidateQueries({ queryKey: ["quiz-leaderboard", selectedId] });
      }
      if (IDEAS_EVENT_TYPES.has(event.type) && selectedId) {
        void qc.invalidateQueries({ queryKey: ["ideas", selectedId] });
      }
      if (
        selectedId &&
        isPollType(selectedItem?.type ?? "") &&
        POLL_EVENT_TYPES.has(event.type)
      ) {
        handleHostPollWsEvent(qc, {
          event,
          pollId: selectedId,
          roomId,
          guard: selfActionGuard.current,
        });
      }
    },
    [qc, roomId, selectedId, selectedItem?.type]
  );

  const { connected } = useRoomWebSocket({
    roomId,
    token: getAccessToken(),
    mode: "host",
    onEvent: handleWsEvent,
  });

  const navLive = useHostRoomNavLiveState(roomId, { wsConnected: connected });

  useScreenWorkbenchSync(selectedItem, session?.title ?? null, screen, {
    paused: actionMutation.isPending || sprint9StatusMutation.isPending,
  });

  const poll = pollQuery.data;
  const selectedIndex = workbenchItems.findIndex((p) => p.id === selectedId);
  const running = poll ? isPollRunning(poll.status) : false;
  const locked = poll?.status === "locked";

  const sessionHeaderStatus = session ? sessionStatusBadge(session) : null;

  const selectItem = (id: string): void => {
    window.location.hash = `#/rooms/${roomId}/workbench/${id}`;
  };

  const handleInteractionDeleted = useCallback(
    (deletedId: string) => {
      const idx = workbenchItems.findIndex((i) => i.id === deletedId);
      const remaining = workbenchItems.filter((i) => i.id !== deletedId);
      if (remaining.length === 0) {
        window.location.hash = `#/rooms/${roomId}/workbench`;
        return;
      }
      const next = remaining[Math.min(idx, remaining.length - 1)]!;
      selectItem(next.id);
    },
    [roomId, workbenchItems]
  );

  const goPrev = (): void => {
    if (selectedIndex > 0) selectItem(workbenchItems[selectedIndex - 1]!.id);
  };

  const goNext = (): void => {
    if (selectedIndex >= 0 && selectedIndex < workbenchItems.length - 1) {
      selectItem(workbenchItems[selectedIndex + 1]!.id);
    }
  };

  const runPollAction = (action: PollAction, needsConfirm?: boolean): void => {
    if (!selectedId || !selectedItem || !isPollType(selectedItem.type)) return;
    if (needsConfirm && !window.confirm("確定要重置並清除所有作答？")) return;
    actionMutation.mutate({
      pollId: selectedId,
      action,
      confirm: needsConfirm ?? false,
    });
  };

  const dateLabel = session
    ? new Date(session.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const workbenchControls = (
    <>
      <button
        type="button"
        disabled={selectedIndex <= 0}
        onClick={goPrev}
        className="le-btn-secondary !min-h-[24px] !px-2 !py-0.5 !text-[10px]"
      >
        上一題
      </button>
      <button
        type="button"
        disabled={selectedIndex < 0 || selectedIndex >= workbenchItems.length - 1}
        onClick={goNext}
        className="le-btn-secondary !min-h-[24px] !px-2 !py-0.5 !text-[10px]"
      >
        下一題
      </button>
      <span className="pl-0.5 text-[10px] tabular-nums text-muted">
        {workbenchItems.length > 0 && selectedIndex >= 0
          ? `${selectedIndex + 1}/${workbenchItems.length}`
          : "—"}
      </span>

      {selectedItem && supportsLiveAggregateControls(selectedItem.type) ? (
        <LiveAggregateToggles roomId={roomId} item={selectedItem} />
      ) : null}

      {selectedItem && isPollType(selectedItem.type) ? (
        <>
          <ControlToggle
            active={running}
            activeLabel="結束"
            inactiveLabel="開始"
            disabled={!poll || actionMutation.isPending}
            accent={running ? "danger" : "default"}
            size="compact"
            onClick={() => runPollAction(running ? "stop" : "start")}
          />
          <ControlToggle
            active={locked}
            activeLabel="解除鎖定"
            inactiveLabel="鎖定"
            disabled={!poll || actionMutation.isPending || !running}
            size="compact"
            onClick={() => runPollAction(locked ? "unlock" : "lock")}
          />
          <ControlToggle
            active={Boolean(poll?.result_visible)}
            activeLabel="隱藏答案"
            inactiveLabel="揭曉答案"
            disabled={
              !poll ||
              actionMutation.isPending ||
              !canRevealPollResult(poll.status)
            }
            {...(poll &&
            !canRevealPollResult(poll.status) &&
            !poll.result_visible
              ? { disabledHint: POLL_REVEAL_REQUIRES_STARTED_HINT }
              : {})}
            size="compact"
            onClick={() => runPollAction(poll?.result_visible ? "hide" : "reveal")}
          />
          <ControlAction
            label="重設"
            disabled={!poll || actionMutation.isPending}
            size="compact"
            onClick={() => runPollAction("reset", true)}
          />
        </>
      ) : null}

      {selectedItem && isSprint9Type(selectedItem.type) ? (
        <>
          {selectedItem.status !== "active" && selectedItem.status !== "locked" ? (
            <ControlToggle
              active={false}
              activeLabel="結束"
              inactiveLabel="開放"
              disabled={sprint9StatusMutation.isPending}
              showDot={false}
              size="compact"
              onClick={() => sprint9StatusMutation.mutate({ interactionId: selectedItem.id, status: "active" })}
            />
          ) : (
            <ControlToggle
              active={true}
              activeLabel="結束"
              inactiveLabel="開放"
              disabled={sprint9StatusMutation.isPending}
              accent="danger"
              showDot={false}
              size="compact"
              onClick={() => sprint9StatusMutation.mutate({ interactionId: selectedItem.id, status: "stopped" })}
            />
          )}
        </>
      ) : null}

      {quizActiveLabel ? (
        <span className="max-w-[120px] truncate text-[10px] text-muted" title={quizActiveLabel}>
          {quizActiveLabel}
        </span>
      ) : null}

      {selectedItem ? (
        <WorkbenchInteractionActions
          roomId={roomId}
          interactionId={selectedItem.id}
          status={
            isPollType(selectedItem.type) && poll
              ? poll.status
              : selectedItem.status
          }
          displayTitle={workbenchItemDisplayTitle(
            selectedItem,
            poll?.title
          )}
          {...(isPollType(selectedItem.type)
            ? {
                editHref: `#/rooms/${roomId}/polls/${selectedItem.id}/builder`,
              }
            : isSprint9Type(selectedItem.type)
              ? { editScrollTargetId: WORKBENCH_S9_EDIT_ID }
              : {})}
          onDeleted={() => handleInteractionDeleted(selectedItem.id)}
          variant="compact"
        />
      ) : null}
    </>
  );

  return (
    <>
      <WorkbenchLayout
        toolbar={
          <HostRoomNavHeader
            title="工作台"
            brandHref={HOST_DASHBOARD_HASH}
            sessionMeta={{
              dateLabel,
              code: session?.code ?? "—",
              visibilityLabel: session ? SESSION_VISIBILITY_LABEL[session.visibility] : "—",
              activityLabel: session?.title ?? (sessionsQuery.isLoading ? "載入中…" : "—"),
              ...(sessionHeaderStatus
                ? {
                    statusLabel: sessionHeaderStatus.label,
                    statusBadgeVariant: sessionHeaderStatus.variant,
                  }
                : {}),
            }}
            navItems={hostRoomNavItems(roomId, "workbench", navLive)}
            actions={
              session ? (
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  {session.status === "draft" ? (
                    <button
                      type="button"
                      disabled={sessionStatusMutation.isPending}
                      onClick={() => sessionStatusMutation.mutate("live")}
                      className="le-btn-primary !min-h-[28px] !px-3 !py-1 !text-xs font-semibold shadow-sm animate-pulse"
                      title="將活動設為進行中（Live），讓參加者端可進入作答"
                    >
                      🚀 開始活動 (Go Live)
                    </button>
                  ) : session.status === "live" ? (
                    <button
                      type="button"
                      disabled={sessionStatusMutation.isPending}
                      onClick={() => {
                        if (window.confirm("確定要結束活動？結束後參加者將無法繼續互動。")) {
                          sessionStatusMutation.mutate("ended");
                        }
                      }}
                      className="le-btn-secondary !min-h-[28px] !px-2.5 !py-1 !text-xs !text-danger hover:!bg-danger/10"
                      title="結束此活動"
                    >
                      ⏹ 結束活動
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={sessionStatusMutation.isPending}
                      onClick={() => sessionStatusMutation.mutate("live")}
                      className="le-btn-secondary !min-h-[28px] !px-2.5 !py-1 !text-xs text-accent"
                      title="重新開放活動"
                    >
                      ▶ 重新開放活動
                    </button>
                  )}
                </div>
              ) : null
            }
            headerActions={<AiConfigTrigger />}
            chromeFooterActions={<HostRoomHeaderActions roomId={roomId} screen={screen} />}
            onLogout={onLogout}
            subRow={<HostRoomHubBreadcrumb roomId={roomId} currentLabel="工作台" />}
            titleExtra={
              <span
                className={`le-status-dot ${connected ? "le-status-dot-live" : "bg-muted"}`}
                title={connected ? "WS 已連線" : "WS 未連線"}
              />
            }
            navControls={
              <div className="flex w-full flex-wrap items-center justify-start gap-x-1.5 gap-y-2 sm:justify-center">
                {workbenchControls}
              </div>
            }
          />
        }
        sidebar={
          <WorkbenchInteractionSidebar
            items={workbenchItems}
            selectedId={selectedId}
            loading={interactionsQuery.isLoading}
            reorderable={canEditHostContent()}
            reordering={reorderMutation.isPending}
            newType={newType}
            newTitle={newTitle}
            creating={createMutation.isPending}
            onNewType={setNewType}
            onNewTitle={setNewTitle}
            onCreate={() => createMutation.mutate()}
            onOpenAiModal={() => setAiModalOpen(true)}
            onSelect={selectItem}
            onReorder={(orderedIds) => reorderMutation.mutate(orderedIds)}
          />
        }
        main={
          <>
            {session?.status === "draft" ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚠️</span>
                  <div>
                    <span className="font-semibold">活動目前為「草稿」狀態</span>
                    <span className="ml-1 text-muted">
                      參加者尚無法進入。點擊右側按鈕即可正式開放，或在下方點擊「開始」投票也會自動開放。
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={sessionStatusMutation.isPending}
                  onClick={() => sessionStatusMutation.mutate("live")}
                  className="le-btn-primary shrink-0 !min-h-[28px] !px-3 !py-1 !text-xs font-semibold shadow-sm"
                >
                  🚀 立即開始活動 (Go Live)
                </button>
              </div>
            ) : null}
            <WorkbenchMainPanel
              roomId={roomId}
              item={selectedItem}
              wsConnected={connected}
            />
          </>
        }
        preview={<WorkbenchPreviewPanel item={selectedItem} wsConnected={connected} />}
      />
      <AiPollGeneratorModal
        roomId={roomId}
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSuccess={() => showSuccess("成功建立 AI 靈感題庫！")}
      />
      {systemNoticeModal}
    </>
  );
}
