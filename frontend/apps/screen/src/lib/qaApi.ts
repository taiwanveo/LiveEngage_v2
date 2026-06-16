/** Q&A 公開列表（Screen）。 */

import { api } from "./api";
import type { QuestionPublic } from "../types";

export async function listPublicQuestions(
  roomId: string,
  sort: "top" | "newest" = "top"
): Promise<QuestionPublic[]> {
  const res = await api<{ items: QuestionPublic[] }>(
    `/api/v1/rooms/${roomId}/questions?sort=${sort}`,
    { public: true }
  );
  return res.items;
}
