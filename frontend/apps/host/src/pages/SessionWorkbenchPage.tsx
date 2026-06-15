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
import { HostRoomNavHeader, WorkbenchLayout, useSystemNotice } from "@liveengage/ui";
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
  type InteractionSummary,
  type PollAction,
} from "../lib/pollTypes";
import {
  listSessions,
  type SessionHost,
  type SessionVisibility,
} from "../lib/sessionApi";
import {
  applyWorkbenchOrder,
  toInteractionCreateType,
  workbenchInteractions,
  isSprint9Type,
  type WorkbenchCreateType,
} from "../lib/workbenchTypes";
import { HOST_DASHBOARD_HASH, hostRoomNavItems } from "../components/HostShell";
import { HostRoomHeaderActions } from "../components/HostRoomHeaderActions";
import { ControlAction, ControlToggle, isPollRunning } from "../components/PollControlBar";
import { presentAppUrl, sprint9PresentUrl } from "../lib/presentUrl";
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
import { QaModerationModal } from "../components/qa/QaModerationModal";
import { useQaPendingCount } from "../components/qa/QaModerationPanel";

interface Props {
  roomId: string;
  interactionId?: string | undefined;
  onLogout: () => void;
}

const VISIBILITY_LABEL: Record<SessionVisibility, string> = {
  public: "公開",
  hidden: "隱藏",
  passcode: "密碼加入",
  sso: "SSO 登入",
  restricted: "限制加入",
};

const STATUS_LABEL: Record<SessionHost["status"], string> = {
  draft: "草稿",
  live: "進行中",
  ended: "已結束",
  archived: "已封存",
};

function itemToolbarStatus(item: InteractionSummary): {
  label: string;
  variant: "live" | "accent" | "muted";
} {
  switch (item.status) {
    case "active":
      return { label: "進行中", variant: "live" };
    case "locked":
      return { label: "已鎖定", variant: "accent" };
    case "stopped":
      return { label: "已結束", variant: "muted" };
    default:
      return { label: "閒置", variant: "muted" };
  }
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
  const [qaModalOpen, setQaModalOpen] = useState(false);

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

  const pendingQaCount = useQaPendingCount(roomId);
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
    mutationFn: ({ action, confirm }: { action: PollAction; confirm?: boolean }) =>
      pollAction(selectedId!, action, confirm ?? false),
    onSuccess: (data, variables) => {
      if (!selectedId) return;
      selfActionGuard.current.mark(selectedId);
      applyHostPollActionSuccess(qc, {
        roomId,
        pollId: selectedId,
        action: variables.action,
        data,
      });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "操作失敗"));
    },
  });

  const sprint9StatusMutation = useMutation({
    mutationFn: (status: "active" | "stopped") =>
      updateInteractionStatus(selectedId!, status),
    onSuccess: () => {
      showSuccess("狀態已更新");
      void qc.invalidateQueries({ queryKey: ["interactions", roomId] });
    },
    onError: (err: unknown) => {
      showError(formatUserFacingError(err, "操作失敗"));
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

  const poll = pollQuery.data;
  const selectedIndex = workbenchItems.findIndex((p) => p.id === selectedId);
  const running = poll ? isPollRunning(poll.status) : false;
  const locked = poll?.status === "locked";

  const toolbarStatus = selectedItem
    ? itemToolbarStatus(selectedItem)
    : session
      ? {
          label: STATUS_LABEL[session.status],
          variant: session.status === "live" ? ("live" as const) : ("muted" as const),
        }
      : null;

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
    actionMutation.mutate({ action, confirm: needsConfirm ?? false });
  };

  const presentHref = useMemo(() => {
    if (!selectedId || !selectedItem) return undefined;
    if (isPollType(selectedItem.type)) return presentAppUrl(roomId, selectedId);
    if (isSprint9Type(selectedItem.type)) return sprint9PresentUrl(roomId, selectedId);
    return undefined;
  }, [roomId, selectedId, selectedItem]);

  const dateLabel = session
    ? new Date(session.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const navControls = (
    <>
      <button
        type="button"
        onClick={() => setQaModalOpen(true)}
        className="le-btn-secondary relative !min-h-[24px] !px-2 !py-0.5 !text-[10px]"
      >
        Q&amp;A
        {pendingQaCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
            {pendingQaCount > 99 ? "99+" : pendingQaCount}
          </span>
        ) : null}
      </button>

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
            disabled={!poll || actionMutation.isPending}
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
              size="compact"
              onClick={() => sprint9StatusMutation.mutate("active")}
            />
          ) : (
            <ControlToggle
              active={true}
              activeLabel="結束"
              inactiveLabel="開放"
              disabled={sprint9StatusMutation.isPending}
              accent="danger"
              size="compact"
              onClick={() => sprint9StatusMutation.mutate("stopped")}
            />
          )}
        </>
      ) : null}

      {quizActiveLabel ? (
        <span className="max-w-[120px] truncate text-[10px] text-muted" title={quizActiveLabel}>
          {quizActiveLabel}
        </span>
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
              visibilityLabel: session ? VISIBILITY_LABEL[session.visibility] : "—",
              activityLabel: session?.title ?? (sessionsQuery.isLoading ? "載入中…" : "—"),
              ...(toolbarStatus
                ? {
                    statusLabel: toolbarStatus.label,
                    statusBadgeVariant: toolbarStatus.variant,
                  }
                : {}),
            }}
            navItems={hostRoomNavItems(roomId, "workbench")}
            navControls={navControls}
            chromeFooterActions={
              <HostRoomHeaderActions
                roomId={roomId}
                {...(presentHref ? { presentHref } : {})}
              />
            }
            onLogout={onLogout}
            titleExtra={
              <span
                className={`le-status-dot ${connected ? "le-status-dot-live" : "bg-muted"}`}
                title={connected ? "WS 已連線" : "WS 未連線"}
              />
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
            onSelect={selectItem}
            onReorder={(orderedIds) => reorderMutation.mutate(orderedIds)}
          />
        }
        main={
          <WorkbenchMainPanel
            roomId={roomId}
            item={selectedItem}
            onInteractionDeleted={handleInteractionDeleted}
          />
        }
        preview={<WorkbenchPreviewPanel item={selectedItem} />}
      />
      <QaModerationModal
        roomId={roomId}
        open={qaModalOpen}
        onClose={() => setQaModalOpen(false)}
      />
      {systemNoticeModal}
    </>
  );
}
