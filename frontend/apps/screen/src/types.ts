/** Screen 共用型別。 */

export type QuestionStatus = "pending" | "approved" | "dismissed" | "answered";

export interface QuestionReply {
  id: string;
  question_id: string;
  author_type: "host" | "participant";
  content: string;
  is_private: boolean;
  created_at: string;
}

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
