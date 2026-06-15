/** workbenchTypes 單元測試（以 assert 執行，無 vitest 時可手動驗證）。 */

import assert from "node:assert/strict";
import {
  applyWorkbenchOrder,
  filterWorkbenchInteractions,
  isWorkbenchInteraction,
  reorderWorkbenchIds,
  sortWorkbenchInteractions,
  workbenchInteractions,
} from "./workbenchTypes";
import type { InteractionSummary } from "./pollTypes";

function mockItem(
  overrides: Partial<InteractionSummary> & { id: string; type: string }
): InteractionSummary {
  return {
    room_id: "room-1",
    title: null,
    description: null,
    status: "idle",
    order_no: 0,
    settings: {},
    result_visible: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const samples: InteractionSummary[] = [
  mockItem({ id: "1", type: "multiple_choice", order_no: 2 }),
  mockItem({ id: "2", type: "quiz", order_no: 1 }),
  mockItem({ id: "3", type: "qa", order_no: 0 }),
  mockItem({ id: "4", type: "ideas", order_no: 1, created_at: "2026-01-02T00:00:00Z" }),
];

assert.equal(isWorkbenchInteraction("multiple_choice"), true);
assert.equal(isWorkbenchInteraction("quiz"), true);
assert.equal(isWorkbenchInteraction("qa"), false);

const filtered = filterWorkbenchInteractions(samples);
assert.equal(filtered.length, 3);
assert.ok(!filtered.some((i) => i.type === "qa"));

const sorted = sortWorkbenchInteractions(filtered);
assert.deepEqual(
  sorted.map((i) => i.id),
  ["2", "4", "1"]
);

assert.equal(workbenchInteractions(samples).length, 3);

assert.deepEqual(reorderWorkbenchIds(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
assert.deepEqual(reorderWorkbenchIds(["a", "b", "c"], 2, 0), ["c", "a", "b"]);

const reordered = applyWorkbenchOrder(samples, ["1", "2", "4"]);
assert.equal(reordered.find((i) => i.id === "1")?.order_no, 0);
assert.equal(reordered.find((i) => i.id === "2")?.order_no, 1);

console.log("workbenchTypes: all assertions passed");
