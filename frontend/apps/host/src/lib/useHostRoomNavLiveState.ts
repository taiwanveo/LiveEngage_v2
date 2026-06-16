/** 房間頂欄導覽「進行中」膠囊狀態（Q&A / Poll / Quiz）。 */

import { useQuery } from "@tanstack/react-query";
import { findLatestQaInteraction, listInteractions } from "./interactionApi";
import { isPollRunning } from "./pollTypes";
import { isPollType } from "./pollTypes";

export interface HostRoomNavLiveState {
  qaOpen: boolean;
  pollRunning: boolean;
  quizRunning: boolean;
}

export function useHostRoomNavLiveState(
  roomId: string,
  opts?: { wsConnected?: boolean }
): HostRoomNavLiveState {
  const interactionsQuery = useQuery({
    queryKey: ["interactions", roomId],
    queryFn: () => listInteractions(roomId),
    // WS 已連線時靠事件 invalidation；僅斷線時輪詢備援
    refetchInterval: opts?.wsConnected ? false : 5_000,
  });

  const items = interactionsQuery.data ?? [];
  const qa = findLatestQaInteraction(items);

  return {
    qaOpen: qa?.status === "active",
    pollRunning: items.some(
      (item) => isPollType(item.type) && isPollRunning(item.status)
    ),
    quizRunning: items.some(
      (item) => item.type === "quiz" && isPollRunning(item.status)
    ),
  };
}
