/** Host 投影遙控：簽發 token、更新 display state、開啟 Screen 視窗。 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { screenUrlByRoom } from "@liveengage/ui";
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

export function useScreenControl(roomId: string) {
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
    // room= 直接帶入，避免 event= 模式依賴 by-code（公開 API 不含 default_room_id）
    return screenUrlByRoom(roomId, token);
  }, [roomId, tokenQuery.data?.token]);

  const openScreen = useCallback(() => {
    const href = buildScreenHref();
    if (!href) return;
    const win = window.open(href, "liveengage-screen", "noopener,noreferrer");
    if (win) screenWindowRef.current = win;
  }, [buildScreenHref]);

  const requestFullscreen = useCallback(() => {
    screenWindowRef.current?.postMessage({ type: "screen:fullscreen" }, "*");
  }, []);

  const { mutate: mutateScreenState, isPending: screenUpdatePending } =
    updateMutation;

  const pushScreen = useCallback(
    (payload: ScreenStateUpdate) => {
      if (!followEnabled) return;
      mutateScreenState(payload);
    },
    [followEnabled, mutateScreenState]
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
      mutateScreenState({
        view: "test",
        ...(sessionTitle != null ? { session_title: sessionTitle } : {}),
      });
    },
    [mutateScreenState]
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
    updating: screenUpdatePending,
  };
}

/** 工作台切換互動時自動同步 Screen（若啟用跟隨）。 */
export function useScreenWorkbenchSync(
  selectedItem: InteractionSummary | null | undefined,
  sessionTitle: string | null | undefined,
  screen: ReturnType<typeof useScreenControl>
): void {
  const syncRef = useRef(screen.syncWorkbenchItem);
  syncRef.current = screen.syncWorkbenchItem;

  useEffect(() => {
    if (!screen.followEnabled) return;
    if (!selectedItem) return;
    if (!isPollType(selectedItem.type) && !isSprint9Type(selectedItem.type)) return;

    const item = selectedItem;
    const title = sessionTitle ?? null;
    const timer = window.setTimeout(() => {
      syncRef.current(item, title);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [selectedItem?.id, selectedItem?.type, sessionTitle, screen.followEnabled]);
}
