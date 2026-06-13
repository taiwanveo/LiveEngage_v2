/** Host Room API（多房間）。 */

import { api } from "./api";

export interface RoomData {
  id: string;
  session_id: string;
  name: string | null;
  description: string | null;
  slug: string | null;
  order_no: number;
  created_at: string;
  updated_at: string;
}

export async function listRooms(sessionId: string): Promise<RoomData[]> {
  const res = await api<{ items: RoomData[] }>(`/api/v1/sessions/${sessionId}/rooms`);
  return res.items;
}

export async function createRoom(
  sessionId: string,
  payload: { name: string; description?: string }
): Promise<RoomData> {
  return api<RoomData>(`/api/v1/sessions/${sessionId}/rooms`, {
    method: "POST",
    body: payload,
  });
}
