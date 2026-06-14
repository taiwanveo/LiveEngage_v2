/** Poll renderer 型別（對齊 backend `app.schemas.poll`）。 */

export type PollInteractionType =
  | "multiple_choice"
  | "word_cloud"
  | "open_text"
  | "rating"
  | "ranking";

export type InteractionStatus = "idle" | "active" | "locked" | "stopped";

/** answer＝參與者作答；present＝投影展示；preview＝Host Builder 預覽。 */
export type RenderMode = "answer" | "present" | "preview";

export interface PollOption {
  id: string;
  text: string;
  order_no: number;
  is_correct?: boolean | null;
}

export interface PollDetail {
  id: string;
  room_id: string;
  type: PollInteractionType;
  title: string | null;
  description: string | null;
  status: InteractionStatus;
  result_visible: boolean;
  settings_public: Record<string, unknown>;
  options: PollOption[];
  my_submitted: boolean;
  ends_at: string | null;
}

export interface OptionCount {
  option_id: string;
  count: number;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface TextEntry {
  id: string;
  text: string;
  author_display: string | null;
  created_at: string;
}

export interface PollResults {
  interaction_id: string;
  type: PollInteractionType;
  status: InteractionStatus;
  response_count: number;
  option_counts?: OptionCount[] | null;
  word_counts?: WordCount[] | null;
  average?: number | null;
  distribution?: Record<string, number> | null;
  entries?: TextEntry[] | null;
}

export interface PollRendererProps {
  mode: RenderMode;
  poll: PollDetail;
  results?: PollResults | null;
  /** Host 工作台右欄：依控場狀態預覽參與者畫面（揭曉後即顯示統計等） */
  hostWorkbenchPreview?: boolean;
  onSubmit?: (answer: Record<string, unknown>) => void;
  submitting?: boolean;
  submitError?: string | null;
}
