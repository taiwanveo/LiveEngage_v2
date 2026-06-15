/** 統一活動工作台：互動類型篩選與排序。 */

import type { InteractionCreateType } from "./interactionApi";
import {
  isPollType,
  POLL_TYPES,
  type InteractionSummary,
  type PollInteractionType,
} from "./pollTypes";

export const SPRINT9_TYPES = ["quiz", "ideas", "survey"] as const;
export type Sprint9InteractionType = (typeof SPRINT9_TYPES)[number];

export type WorkbenchCreateType = PollInteractionType | Sprint9InteractionType;

export const WORKBENCH_CREATE_OPTIONS: {
  group: string;
  options: { value: WorkbenchCreateType; label: string }[];
}[] = [
  {
    group: "Poll",
    options: POLL_TYPES.map((t) => ({ value: t.value, label: t.label })),
  },
  {
    group: "Quiz / Ideas / Survey",
    options: [
      { value: "quiz", label: "快問快答" },
      { value: "ideas", label: "點子牆" },
      { value: "survey", label: "問卷" },
    ],
  },
];

export function isSprint9Type(type: string): type is Sprint9InteractionType {
  return (SPRINT9_TYPES as readonly string[]).includes(type);
}

export function isWorkbenchInteraction(type: string): boolean {
  return isPollType(type) || isSprint9Type(type);
}

export function filterWorkbenchInteractions(
  items: InteractionSummary[]
): InteractionSummary[] {
  return items.filter((i) => isWorkbenchInteraction(i.type));
}

export function sortWorkbenchInteractions(
  items: InteractionSummary[]
): InteractionSummary[] {
  return [...items].sort((a, b) => {
    if (a.order_no !== b.order_no) return a.order_no - b.order_no;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function workbenchInteractions(
  items: InteractionSummary[] | undefined
): InteractionSummary[] {
  return sortWorkbenchInteractions(filterWorkbenchInteractions(items ?? []));
}

/** 拖曳排序：將 fromIndex 項目移到 toIndex。 */
export function reorderWorkbenchIds(
  ids: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length ||
    fromIndex === toIndex
  ) {
    return ids;
  }
  const next = [...ids];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed!);
  return next;
}

/** 樂觀更新：依新順序重設 order_no。 */
export function applyWorkbenchOrder(
  items: InteractionSummary[],
  orderedIds: string[]
): InteractionSummary[] {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  return items.map((item) =>
    orderMap.has(item.id)
      ? { ...item, order_no: orderMap.get(item.id)! }
      : item
  );
}

export function toInteractionCreateType(
  type: WorkbenchCreateType
): InteractionCreateType {
  return type;
}
