import type { InteractionStatus, PollDetail } from "./types";

export const LIVE_AGGREGATE_SCREEN = "live_aggregate_screen";
export const LIVE_AGGREGATE_JOIN = "live_aggregate_join";

function readBool(
  settings: Record<string, unknown>,
  key: string,
  fallback = false
): boolean {
  const v = settings[key];
  return typeof v === "boolean" ? v : fallback;
}

const POLL_INTERACTION_TYPES = new Set([
  "multiple_choice",
  "word_cloud",
  "open_text",
  "rating",
  "ranking",
]);

function isLivePhase(status: InteractionStatus): boolean {
  return status === "active" || status === "locked";
}

export function isPollInteractionType(type: string): boolean {
  return POLL_INTERACTION_TYPES.has(type);
}

/** 是否支援即時聚合雙 Toggle（不含 Q&A）。 */
export function supportsLiveAggregateControls(type: string): boolean {
  return (
    isPollInteractionType(type) ||
    type === "ideas" ||
    type === "quiz" ||
    type === "survey"
  );
}

export function defaultLiveAggregateSettings(type: string): {
  screen: boolean;
  join: boolean;
} {
  if (isPollInteractionType(type)) return { screen: true, join: false };
  if (type === "ideas") return { screen: true, join: true };
  return { screen: false, join: false };
}

export function readLiveAggregateSettings(
  settings: Record<string, unknown>,
  type: string
): { screen: boolean; join: boolean } {
  const defaults = defaultLiveAggregateSettings(type);
  return {
    screen: readBool(settings, LIVE_AGGREGATE_SCREEN, defaults.screen),
    join: readBool(settings, LIVE_AGGREGATE_JOIN, defaults.join),
  };
}

type AggregatePoll = Pick<
  PollDetail,
  "status" | "result_visible" | "settings_public"
> & { type: string };

/** 是否應帶入聚合結果（Host 永遠 true；Screen / Join 依開關與揭曉）。 */
export function shouldShowAggregateResults(
  poll: AggregatePoll,
  surface: "host" | "screen" | "join",
  opts?: { subView?: string | null }
): boolean {
  if (surface === "host") return true;
  if (opts?.subView === "results" || poll.result_visible) return true;
  if (poll.type === "ideas" && poll.status === "stopped") return true;
  if (!isLivePhase(poll.status)) return false;
  const { screen, join } = readLiveAggregateSettings(poll.settings_public, poll.type);
  if (surface === "screen") return screen;
  if (surface === "join") return join;
  return false;
}

/** @deprecated 請改用 readLiveAggregateSettings */
export function isLiveAggregatedPollType(type: string): boolean {
  return type === "word_cloud";
}

/** 參與者作答模式：進行中且尚未提交時，不應以結果圖表取代作答 UI（除非 Join 即時開啟）。 */
export function shouldShowParticipantResults(
  poll: Pick<
    PollDetail,
    "type" | "status" | "result_visible" | "my_submitted" | "settings_public"
  >,
  hasResultsData: boolean,
  opts?: { hostWorkbenchPreview?: boolean }
): boolean {
  if (!shouldShowAggregateResults(poll, "join")) return false;
  if (!hasResultsData) return false;

  const liveJoinDuringActive =
    isLivePhase(poll.status) &&
    !poll.result_visible &&
    readLiveAggregateSettings(poll.settings_public, poll.type).join;

  if (liveJoinDuringActive || opts?.hostWorkbenchPreview) return true;

  if (!poll.result_visible) return false;
  if (poll.status === "active" && !poll.my_submitted) return false;
  return true;
}

/** 投影是否帶入 poll-results。 */
export function shouldPresentPollResults(
  poll: AggregatePoll,
  opts?: { subView?: string | null }
): boolean {
  return shouldShowAggregateResults(poll, "screen", opts);
}

/** Host 右欄參與者預覽是否帶入結果。 */
export function shouldShowHostWorkbenchPollResults(poll: AggregatePoll): boolean {
  return shouldShowAggregateResults(poll, "join");
}
