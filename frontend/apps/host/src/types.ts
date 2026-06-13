/** 與 backend `app.schemas.question` 對齊的資料型別。 */

export type QuestionStatus =
  | "pending"
  | "approved"
  | "answered"
  | "dismissed"
  | "archived";

export type ModerateAction =
  | "approve"
  | "dismiss"
  | "archive"
  | "restore"
  | "answer"
  | "unanswer"
  | "highlight"
  | "unhighlight";

export interface QuestionPublic {
  id: string;
  room_id: string;
  content: string;
  author_display: string | null;
  is_anonymous: boolean;
  status: QuestionStatus;
  upvote_count: number;
  downvote_count: number;
  score: number;
  highlighted: boolean;
  answered_at: string | null;
  label_id: string | null;
  created_at: string;
  my_vote: "up" | "down" | null;
  replies: QuestionReply[];
}

export interface QuestionReply {
  id: string;
  question_id: string;
  author_type: "host" | "participant";
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
}
