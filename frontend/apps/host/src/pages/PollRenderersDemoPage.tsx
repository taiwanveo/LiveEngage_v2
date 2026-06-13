/** S6-1：Poll renderers 三 mode 展示頁（mock 資料，不接 API）。 */

import * as React from "react";
import { useState } from "react";
import {
  PollRenderer,
  type PollDetail,
  type PollInteractionType,
  type PollResults,
  type RenderMode,
} from "@liveengage/renderers";

const OPTION_IDS = ["opt-a", "opt-b", "opt-c", "opt-d"] as const;

function basePoll(type: PollInteractionType): PollDetail {
  return {
    id: `demo-${type}`,
    room_id: "room-demo",
    type,
    title: `示範題目 — ${type}`,
    description: "S6-1 renderers 核心展示（mock 資料）",
    status: "active",
    result_visible: true,
    settings_public: {},
    options: OPTION_IDS.map((id, i) => ({
      id,
      text: `選項 ${String.fromCharCode(65 + i)}`,
      order_no: i + 1,
      is_correct: i === 0 ? true : null,
    })),
    my_submitted: false,
    ends_at: null,
  };
}

const MOCKS: Record<PollInteractionType, { poll: PollDetail; results: PollResults }> = {
  multiple_choice: {
    poll: {
      ...basePoll("multiple_choice"),
      settings_public: { multi_select: false, allow_change: true },
    },
    results: {
      interaction_id: "demo-multiple_choice",
      type: "multiple_choice",
      status: "active",
      response_count: 42,
      option_counts: [
        { option_id: "opt-a", count: 18 },
        { option_id: "opt-b", count: 12 },
        { option_id: "opt-c", count: 8 },
        { option_id: "opt-d", count: 4 },
      ],
    },
  },
  word_cloud: {
    poll: {
      ...basePoll("word_cloud"),
      options: [],
      settings_public: { max_word_length: 20 },
    },
    results: {
      interaction_id: "demo-word_cloud",
      type: "word_cloud",
      status: "active",
      response_count: 30,
      word_counts: [
        { word: "創新", count: 12 },
        { word: "協作", count: 9 },
        { word: "敏捷", count: 7 },
        { word: "品質", count: 5 },
      ],
    },
  },
  open_text: {
    poll: {
      ...basePoll("open_text"),
      options: [],
      settings_public: { max_length: 200, multiline: true, allow_multiple: false },
    },
    results: {
      interaction_id: "demo-open_text",
      type: "open_text",
      status: "active",
      response_count: 3,
      entries: [
        {
          id: "e1",
          text: "希望加強即時互動功能",
          author_display: "參與者 A",
          created_at: "2026-06-13T10:00:00Z",
        },
        {
          id: "e2",
          text: "介面可以更簡潔",
          author_display: null,
          created_at: "2026-06-13T10:01:00Z",
        },
      ],
    },
  },
  rating: {
    poll: {
      ...basePoll("rating"),
      options: [],
      settings_public: { min_value: 1, max_value: 5 },
    },
    results: {
      interaction_id: "demo-rating",
      type: "rating",
      status: "active",
      response_count: 25,
      average: 4.2,
      distribution: { "1": 1, "2": 2, "3": 4, "4": 10, "5": 8 },
    },
  },
  ranking: {
    poll: {
      ...basePoll("ranking"),
      settings_public: { top_n: 3 },
    },
    results: {
      interaction_id: "demo-ranking",
      type: "ranking",
      status: "active",
      response_count: 15,
      option_counts: [
        { option_id: "opt-b", count: 28 },
        { option_id: "opt-a", count: 22 },
        { option_id: "opt-c", count: 18 },
        { option_id: "opt-d", count: 7 },
      ],
    },
  },
};

const POLL_TYPES: PollInteractionType[] = [
  "multiple_choice",
  "word_cloud",
  "open_text",
  "rating",
  "ranking",
];

const MODES: RenderMode[] = ["answer", "present", "preview"];

interface PollRenderersDemoPageProps {
  onBack: () => void;
}

export function PollRenderersDemoPage({
  onBack,
}: PollRenderersDemoPageProps): React.JSX.Element {
  const [pollType, setPollType] = useState<PollInteractionType>("multiple_choice");
  const [mode, setMode] = useState<RenderMode>("answer");
  const [submitLog, setSubmitLog] = useState<string | null>(null);

  const mock = MOCKS[pollType];
  const showResults = mode === "present" || (mode === "answer" && mock.poll.result_visible);

  return (
    <div className="min-h-full bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Poll Renderers（S6-1）</h1>
            <p className="text-sm text-slate-600">answer / present / preview 三 mode 共用元件</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            返回
          </button>
        </header>

        <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">題型</span>
            <select
              value={pollType}
              onChange={(e) => setPollType(e.target.value as PollInteractionType)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              {POLL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mode</span>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    mode === m
                      ? "rounded-lg bg-primary-600 px-3 py-2 text-white"
                      : "rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {submitLog ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            已提交（mock）：{submitLog}
          </p>
        ) : null}

        <PollRenderer
          mode={mode}
          poll={mock.poll}
          results={showResults ? mock.results : null}
          {...(mode === "answer"
            ? {
                onSubmit: (answer: Record<string, unknown>) => {
                  setSubmitLog(JSON.stringify(answer));
                },
              }
            : {})}
        />
      </div>
    </div>
  );
}
