/** Q&A 熱門排序（與後端 list_public_questions sort=top 一致）。 */

import type { QuestionPublic } from "./qaApi";

export function sortQuestionsTop(items: QuestionPublic[]): QuestionPublic[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.created_at ? Date.parse(a.created_at) : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) : 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.id.localeCompare(a.id);
  });
}
