/** WS 事件型別定義（對應後端 EventEnvelope + events.py）。 */

export type WsMode = "participant" | "host" | "present";

/** 從後端接收到的 WS 事件信封（SDS §6.2）。 */
export interface WsEvent {
  /** 事件唯一 ID（uuid7 形式），供 replay 去重使用。 */
  id?: string;
  type: string;
  room_id?: string;
  /** UTC ISO 字串 */
  ts?: string;
  payload: Record<string, unknown>;
}

/** Poll 相關事件型別常數（與後端 events.py 同步）。 */
export const POLL_STARTED = "poll_started";
export const POLL_STOPPED = "poll_stopped";
export const POLL_LOCKED = "poll_locked";
export const POLL_UNLOCKED = "poll_unlocked";
export const POLL_RESULT_REVEALED = "poll_result_revealed";
export const POLL_RESULT_HIDDEN = "poll_result_hidden";
export const POLL_RESPONSE_SUBMITTED = "poll_response_submitted";

export const POLL_EVENT_TYPES = new Set([
  POLL_STARTED,
  POLL_STOPPED,
  POLL_LOCKED,
  POLL_UNLOCKED,
  POLL_RESULT_REVEALED,
  POLL_RESULT_HIDDEN,
  POLL_RESPONSE_SUBMITTED,
]);
