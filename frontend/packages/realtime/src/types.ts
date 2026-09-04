/** WS 事件型別定義（對應後端 EventEnvelope + events.py）。 */

export type WsMode = "participant" | "host" | "present" | "screen";

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

/** Q&A 相關事件（與後端 events.py 同步）。 */
export const QUESTION_SUBMITTED = "question_submitted";
export const QUESTION_APPROVED = "question_approved";
export const QUESTION_DISMISSED = "question_dismissed";
export const QUESTION_UPVOTED = "question_upvoted";
export const QUESTION_DOWNVOTED = "question_downvoted";
export const QUESTION_HIGHLIGHTED = "question_highlighted";
export const QUESTION_ANSWERED = "question_answered";
export const QUESTION_REPLIED = "question_replied";

export const QA_EVENT_TYPES = new Set([
  QUESTION_SUBMITTED,
  QUESTION_APPROVED,
  QUESTION_DISMISSED,
  QUESTION_UPVOTED,
  QUESTION_DOWNVOTED,
  QUESTION_HIGHLIGHTED,
  QUESTION_ANSWERED,
  QUESTION_REPLIED,
]);

/** Quiz 事件（Sprint 9；BE-007 / FE-011） */
export const QUIZ_QUESTION_STARTED = "quiz_question_started";
export const QUIZ_QUESTION_CLOSED = "quiz_question_closed";
export const QUIZ_QUESTION_UPDATED = "quiz_question_updated";
export const QUIZ_LEADERBOARD_UPDATED = "quiz_leaderboard_updated";

export const QUIZ_EVENT_TYPES = new Set([
  QUIZ_QUESTION_STARTED,
  QUIZ_QUESTION_CLOSED,
  QUIZ_QUESTION_UPDATED,
  QUIZ_LEADERBOARD_UPDATED,
]);

/** Ideas 事件（Sprint 9；FE-013） */
export const IDEA_SUBMITTED = "idea_submitted";
export const IDEA_REACTED = "idea_reacted";
export const IDEA_VISIBILITY_CHANGED = "idea_visibility_changed";

export const IDEAS_EVENT_TYPES = new Set([
  IDEA_SUBMITTED,
  IDEA_REACTED,
  IDEA_VISIBILITY_CHANGED,
]);

/** Session 事件（活動生命週期） */
export const SESSION_STARTED = "session_started";
export const SESSION_ENDED = "session_ended";

/** 互動開放（Quiz / Ideas / Survey / Q&A；Poll 另用 poll_started） */
export const INTERACTION_STARTED = "interaction_started";

export const SESSION_EVENT_TYPES = new Set([SESSION_STARTED, SESSION_ENDED]);

export const INTERACTION_EVENT_TYPES = new Set([INTERACTION_STARTED]);

/** Screen 投影遙控 */
export const SCREEN_VIEW_CHANGED = "screen_view_changed";
