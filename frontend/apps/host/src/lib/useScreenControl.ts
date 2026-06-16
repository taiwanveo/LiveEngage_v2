/** Host 投影遙控：簽發 token、更新 display state、開啟 Screen 視窗。 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { screenUrlByRoom } from "@liveengage/ui";
import type { ThemeId } from "@liveengage/ui";
import {
  mintScreenToken,
  updateScreenState,
  type ScreenStateUpdate,
} from "./screenApi";
import type { InteractionSummary } from "./pollTypes";
import { isPollType } from "./pollTypes";
import { isSprint9Type } from "./workbenchTypes";
import { useScreenTheme } from "./useScreenTheme";

const FOLLOW_KEY = "liveengage-screen-follow";

function screenPayloadKey(payload: ScreenStateUpdate): string {
  return `${payload.view}:${payload.interaction_id ?? ""}:${payload.sub_view ?? ""}`;
}

export function useScreenFollowEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(FOLLOW_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const set = useCallback((v: boolean) => {
    setEnabled(v);
    try {
      localStorage.setItem(FOLLOW_KEY, v ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, []);
  return [enabled, set];
}

function interactionToScreenView(
  item: InteractionSummary
): Pick<ScreenStateUpdate, "view" | "interaction_id"> {
  if (isPollType(item.type)) {
    return { view: "poll", interaction_id: item.id };
  }
  if (item.type === "quiz") return { view: "quiz", interaction_id: item.id };
  if (item.type === "ideas") return { view: "ideas", interaction_id: item.id };
  if (item.type === "survey") return { view: "survey", interaction_id: item.id };
  return { view: "standby", interaction_id: null };
}

export function useScreenControl(roomId: string) {
  const qc = useQueryClient();
  const screenWindowRef = useRef<Window | null>(null);
  const manualOverrideUntilRef = useRef(0);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const queuedPayloadRef = useRef<ScreenStateUpdate | null>(null);
  const [followEnabled, setFollowEnabled] = useScreenFollowEnabled();

  const tokenQuery = useQuery({
    queryKey: ["screen-token", roomId],
    queryFn: () => mintScreenToken(roomId),
    staleTime: 60 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ScreenStateUpdate) => updateScreenState(roomId, payload),
    onSuccess: (data) => {
      qc.setQueryData(["screen-state", roomId], data);
    },
  });

  const { mutate: mutateScreenState, isPending: screenUpdatePending } =
    updateMutation;

  const screenUpdatePendingRef = useRef(screenUpdatePending);
  screenUpdatePendingRef.current = screenUpdatePending;

  const flushScreenQueue = useCallback(() => {
    const next = queuedPayloadRef.current;
    if (!next) return;
    queuedPayloadRef.current = null;
    const key = screenPayloadKey(next);
    lastSyncedKeyRef.current = key;
    mutateScreenState(next, {
      onSettled: () => {
        flushScreenQueue();
      },
    });
  }, [mutateScreenState]);

  const sendScreenState = useCallback(
    (payload: ScreenStateUpdate, opts?: { force?: boolean }) => {
      const key = screenPayloadKey(payload);
      if (!opts?.force && lastSyncedKeyRef.current === key) {
        return;
      }

      if (screenUpdatePendingRef.current) {
        queuedPayloadRef.current = payload;
        return;
      }

      lastSyncedKeyRef.current = key;
      mutateScreenState(payload, {
        onSettled: () => {
          flushScreenQueue();
        },
      });
    },
    [flushScreenQueue, mutateScreenState]
  );

  const resolveScreenWindow = useCallback((): Window | null => {
    const cached = screenWindowRef.current;
    if (cached && !cached.closed) return cached;
    // 僅使用已開啟且已記錄的投影視窗，避免意外開出 about:blank 空白頁。
    return null;
  }, []);

  const screenTheme = useScreenTheme(resolveScreenWindow);

  const buildScreenHref = useCallback((themeOverride?: ThemeId): string | undefined => {
    const token = tokenQuery.data?.token;
    if (!token) return undefined;
    const { theme, bg, fg } = screenTheme.prefs;
    const effectiveTheme = themeOverride ?? theme;
    const customColorsEnabled = themeOverride == null;
    return screenUrlByRoom(roomId, token, {
      theme: effectiveTheme,
      ...(customColorsEnabled && bg ? { bg } : {}),
      ...(customColorsEnabled && fg ? { fg } : {}),
    });
  }, [roomId, screenTheme.prefs, tokenQuery.data?.token]);

  const openScreen = useCallback((): Window | null => {
    const href = buildScreenHref();
    if (!href) return null;
    const win = window.open(href, "liveengage-screen");
    if (win) screenWindowRef.current = win;
    return win;
  }, [buildScreenHref]);

  const openScreenWithTheme = useCallback(
    (theme: ThemeId): Window | null => {
      const href = buildScreenHref(theme);
      if (!href) return null;
      const win = window.open(href, "liveengage-screen");
      if (win) screenWindowRef.current = win;
      return win;
    },
    [buildScreenHref]
  );

  const requestFullscreen = useCallback((): "sent" | "no-window" => {
    const win = resolveScreenWindow();
    if (!win) return "no-window";
    win.postMessage({ type: "screen:fullscreen" }, "*");
    return "sent";
  }, [resolveScreenWindow]);

  const isManualOverrideActive = useCallback(
    () => Date.now() < manualOverrideUntilRef.current,
    []
  );

  const armManualOverride = useCallback((ms = 8000) => {
    manualOverrideUntilRef.current = Date.now() + ms;
  }, []);

  const pushScreen = useCallback(
    (payload: ScreenStateUpdate) => {
      if (!followEnabled) return;
      sendScreenState(payload);
    },
    [followEnabled, sendScreenState]
  );

  const syncWorkbenchItem = useCallback(
    (item: InteractionSummary | null, sessionTitle?: string | null) => {
      if (!item) return;
      const base = interactionToScreenView(item);
      pushScreen({
        ...base,
        sub_view: "question",
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [pushScreen]
  );

  const syncPollSubView = useCallback(
    (pollId: string, subView: "question" | "results", sessionTitle?: string | null) => {
      pushScreen({
        view: "poll",
        interaction_id: pollId,
        sub_view: subView,
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [pushScreen]
  );

  const showTest = useCallback(
    (
      sessionTitle?: string | null,
      handlers?: { onSuccess?: () => void; onError?: (err: unknown) => void }
    ) => {
      armManualOverride(8000);
      lastSyncedKeyRef.current = null;
      const payload: ScreenStateUpdate = {
        view: "test",
        interaction_id: null,
        sub_view: null,
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      };
      mutateScreenState(payload, {
        onSuccess: (data) => {
          lastSyncedKeyRef.current = screenPayloadKey(payload);
          qc.setQueryData(["screen-state", roomId], data);
          handlers?.onSuccess?.();
        },
        ...(handlers?.onError ? { onError: handlers.onError } : {}),
      });
    },
    [armManualOverride, mutateScreenState, qc, roomId]
  );

  const showOverview = useCallback(
    (sessionTitle?: string | null) => {
      pushScreen({
        view: "overview",
        interaction_id: null,
        sub_view: null,
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [pushScreen]
  );

  const showQa = useCallback(
    (sessionTitle?: string | null) => {
      armManualOverride(8000);
      lastSyncedKeyRef.current = null;
      sendScreenState(
        {
          view: "qa",
          interaction_id: null,
          sub_view: null,
          ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
        },
        { force: true }
      );
    },
    [armManualOverride, sendScreenState]
  );

  const showStandby = useCallback(
    (sessionTitle?: string | null) => {
      lastSyncedKeyRef.current = null;
      sendScreenState(
        {
          view: "standby",
          interaction_id: null,
          sub_view: null,
          ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
        },
        { force: true }
      );
    },
    [sendScreenState]
  );

  return {
    buildScreenHref,
    openScreen,
    openScreenWithTheme,
    requestFullscreen,
    showTest,
    showOverview,
    showQa,
    showStandby,
    syncWorkbenchItem,
    syncPollSubView,
    pushScreen,
    followEnabled,
    setFollowEnabled,
    isManualOverrideActive,
    tokenLoading: tokenQuery.isLoading,
    updating: screenUpdatePending,
    screenTheme,
  };
}

/** 工作台切換互動時自動同步 Screen（若啟用跟隨）。 */
export function useScreenWorkbenchSync(
  selectedItem: InteractionSummary | null | undefined,
  sessionTitle: string | null | undefined,
  screen: ReturnType<typeof useScreenControl>,
  opts?: { paused?: boolean }
): void {
  const syncRef = useRef(screen.syncWorkbenchItem);
  const overrideRef = useRef(screen.isManualOverrideActive);
  const lastSyncedIdRef = useRef<string | null>(null);
  syncRef.current = screen.syncWorkbenchItem;
  overrideRef.current = screen.isManualOverrideActive;

  useEffect(() => {
    if (opts?.paused) return;
    if (!screen.followEnabled) return;
    if (overrideRef.current()) return;
    if (!selectedItem) return;
    if (!isPollType(selectedItem.type) && !isSprint9Type(selectedItem.type)) return;
    if (lastSyncedIdRef.current === selectedItem.id) return;

    const item = selectedItem;
    const title = sessionTitle ?? null;
    const timer = window.setTimeout(() => {
      if (overrideRef.current()) return;
      if (lastSyncedIdRef.current === item.id) return;
      lastSyncedIdRef.current = item.id;
      syncRef.current(item, title);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [
    opts?.paused,
    selectedItem?.id,
    selectedItem?.type,
    sessionTitle,
    screen.followEnabled,
  ]);
}
