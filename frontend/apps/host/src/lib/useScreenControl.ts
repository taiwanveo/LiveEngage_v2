/** Host 投影遙控：簽發 token、更新 display state、開啟 Screen 視窗。 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { screenUrlByEvent, screenUrlByRoom } from "@liveengage/ui";
import {
  mintScreenToken,
  updateScreenState,
  type ScreenStateUpdate,
} from "./screenApi";
import type { InteractionSummary } from "./pollTypes";
import { isPollType } from "./pollTypes";
import { isSprint9Type } from "./workbenchTypes";

const FOLLOW_KEY = "liveengage-screen-follow";

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

export function useScreenControl(roomId: string, sessionCode?: string | null) {
  const qc = useQueryClient();
  const screenWindowRef = useRef<Window | null>(null);
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

  const buildScreenHref = useCallback((): string | undefined => {
    const token = tokenQuery.data?.token;
    if (!token) return undefined;
    if (sessionCode) {
      return screenUrlByEvent(sessionCode, token);
    }
    return screenUrlByRoom(roomId, token);
  }, [roomId, sessionCode, tokenQuery.data?.token]);

  const openScreen = useCallback(() => {
    const href = buildScreenHref();
    if (!href) return;
    const win = window.open(href, "liveengage-screen", "noopener,noreferrer");
    if (win) screenWindowRef.current = win;
  }, [buildScreenHref]);

  const requestFullscreen = useCallback(() => {
    screenWindowRef.current?.postMessage({ type: "screen:fullscreen" }, "*");
  }, []);

  const pushScreen = useCallback(
    (payload: ScreenStateUpdate) => {
      if (!followEnabled) return;
      updateMutation.mutate(payload);
    },
    [followEnabled, updateMutation]
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
    (sessionTitle?: string | null) => {
      updateMutation.mutate({
        view: "test",
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [updateMutation]
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
      pushScreen({
        view: "qa",
        interaction_id: null,
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [pushScreen]
  );

  return {
    buildScreenHref,
    openScreen,
    requestFullscreen,
    showTest,
    showOverview,
    showQa,
    syncWorkbenchItem,
    syncPollSubView,
    pushScreen,
    followEnabled,
    setFollowEnabled,
    tokenLoading: tokenQuery.isLoading,
    updating: updateMutation.isPending,
  };
}

/** 工作台切換互動時自動同步 Screen（若啟用跟隨）。 */
export function useScreenWorkbenchSync(
  selectedItem: InteractionSummary | null | undefined,
  sessionTitle: string | null | undefined,
  screen: ReturnType<typeof useScreenControl>
): void {
  useEffect(() => {
    if (!selectedItem || !screen.followEnabled) return;
    if (!isPollType(selectedItem.type) && !isSprint9Type(selectedItem.type)) return;
    screen.syncWorkbenchItem(selectedItem, sessionTitle);
  }, [
    selectedItem?.id,
    selectedItem?.type,
    sessionTitle,
    screen.followEnabled,
    screen.syncWorkbenchItem,
  ]);
}
