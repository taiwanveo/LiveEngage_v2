/** 互動題型中文標籤（Host／Participant 共用）。 */

export const INTERACTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "選擇題",
  word_cloud: "文字雲",
  open_text: "開放文字",
  rating: "評分",
  ranking: "排序",
  qa: "Q&A 問答",
  quiz: "快問快答",
  ideas: "點子牆",
  survey: "問卷",
};

export function interactionTypeLabel(type: string): string {
  return INTERACTION_TYPE_LABEL[type] ?? type;
}
