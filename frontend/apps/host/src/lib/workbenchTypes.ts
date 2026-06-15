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

export function toInteractionCreateType(
  type: WorkbenchCreateType
): InteractionCreateType {
  return type;
}
