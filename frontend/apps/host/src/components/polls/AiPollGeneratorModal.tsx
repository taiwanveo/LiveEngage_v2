/** AI 一鍵靈感出題彈出視窗（AI-001：主題靈感推薦、多題型自動搭配、自訂選項、批次建立至房間）。 */

import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatUserFacingError } from "@liveengage/realtime";
import {
  generateAiPolls,
  batchCreateInteractions,
  type AiGeneratedPollItem,
} from "../../lib/interactionApi";

interface Props {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface EditablePollItem extends AiGeneratedPollItem {
  id: string;
  selected: boolean;
}

const INSPIRATION_CHIPS = [
  { label: "🔋 團隊破冰暖場", topic: "團隊破冰與暖場互動" },
  { label: "🏗️ 微服務架構與重構", topic: "微服務架構重構與高並發效能優化" },
  { label: "🚀 產品路線圖與優先級", topic: "下季度產品路線圖與用戶核心價值優先級" },
  { label: "🔄 Sprint 敏捷復盤", topic: "Sprint 敏捷衝刺復盤與阻礙項排除" },
  { label: "📊 培訓教學與吸收度", topic: "新技術培訓教學與關鍵架構概念掌握度" },
  { label: "🌟 AI 賦能研發流程", topic: "AI 輔助開發工具在團隊日常工作流的落地策略" },
];

export function AiPollGeneratorModal({
  roomId,
  isOpen,
  onClose,
  onSuccess,
}: Props): React.JSX.Element | null {
  const queryClient = useQueryClient();

  const [topic, setTopic] = useState("微服務架構重構與效能優化");
  const [pollType, setPollType] = useState("mixed");
  const [count, setCount] = useState(3);
  const [context, setContext] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPolls, setGeneratedPolls] = useState<EditablePollItem[]>([]);
  const [newOptionTexts, setNewOptionTexts] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("請輸入活動或會議主題");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await generateAiPolls({
        topic: topic.trim(),
        count,
        poll_type: pollType === "mixed" ? undefined : pollType,
        context: context.trim() || undefined,
      });

      const items: EditablePollItem[] = (res.polls || []).map((p, idx) => ({
        ...p,
        id: `gen-${Date.now()}-${idx}`,
        selected: true,
      }));
      setGeneratedPolls(items);
    } catch (err: unknown) {
      setError(formatUserFacingError(err, "AI 生成題目失敗，請檢查網路或稍後重試。"));
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setGeneratedPolls((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = generatedPolls.every((p) => p.selected);
    setGeneratedPolls((prev) =>
      prev.map((item) => ({ ...item, selected: !allSelected }))
    );
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setGeneratedPolls((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleRemoveOption = (pollId: string, optIdx: number) => {
    setGeneratedPolls((prev) =>
      prev.map((item) => {
        if (item.id !== pollId) return item;
        const nextOpts = [...item.options];
        nextOpts.splice(optIdx, 1);
        return { ...item, options: nextOpts };
      })
    );
  };

  const handleAddOption = (pollId: string) => {
    const text = (newOptionTexts[pollId] || "").trim();
    if (!text) return;
    setGeneratedPolls((prev) =>
      prev.map((item) => {
        if (item.id !== pollId) return item;
        return { ...item, options: [...item.options, text] };
      })
    );
    setNewOptionTexts((prev) => ({ ...prev, [pollId]: "" }));
  };

  const selectedCount = generatedPolls.filter((p) => p.selected).length;

  const handleBatchCreate = async () => {
    const toCreate = generatedPolls.filter((p) => p.selected);
    if (toCreate.length === 0) {
      setError("請至少勾選一道題目進行建立");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload = toCreate.map((p) => ({
        title: p.title.trim(),
        type: p.type,
        description: p.description ?? undefined,
        options: p.options,
        settings: {},
      }));

      await batchCreateInteractions(roomId, payload);
      await queryClient.invalidateQueries({ queryKey: ["interactions", roomId] });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      setError(formatUserFacingError(err, "批次建立題目失敗，請重試。"));
    } finally {
      setCreating(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "word_cloud":
        return <span className="rounded bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">文字雲</span>;
      case "rating":
        return <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">評分題</span>;
      case "open_text":
        return <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">開放問答</span>;
      default:
        return <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">選擇題</span>;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface-raised">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-accent text-white shadow-sm text-lg">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">AI 一鍵靈感出題</h2>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  AI-001
                </span>
              </div>
              <p className="text-xs text-muted">
                輸入主題，AI 智慧設計最具共鳴的多題型互動並支援一鍵批次建立
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 text-muted transition hover:border-accent hover:text-foreground"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Quick inspiration chips */}
          <div>
            <label className="text-xs font-semibold text-muted block mb-1.5">
              💡 快速靈感主題推薦：
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INSPIRATION_CHIPS.map((chip) => (
                <button
                  key={chip.topic}
                  type="button"
                  onClick={() => setTopic(chip.topic)}
                  className="rounded-full border border-border/70 bg-surface px-2.5 py-1 text-xs text-foreground/85 transition hover:border-accent hover:bg-accent/10 hover:text-accent"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Controls */}
          <div className="rounded-xl border border-border bg-surface-raised/40 p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                活動或討論主題 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：微服務架構重構、團隊 Q3 衝刺目標、跨組協作痛點..."
                className="le-input w-full !text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  題型策略偏好
                </label>
                <select
                  value={pollType}
                  onChange={(e) => setPollType(e.target.value)}
                  className="le-input w-full !text-xs"
                >
                  <option value="mixed">🎯 綜合推薦（多選、文字雲、評分題交錯）</option>
                  <option value="multiple_choice">🔘 選擇題專用（多維度決策衡量）</option>
                  <option value="word_cloud">☁️ 文字雲專用（全場共鳴關鍵字）</option>
                  <option value="rating">⭐ 評分題專用（信心度/滿意度評分）</option>
                  <option value="open_text">💬 開放問答（深度意見搜集）</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  生成題數
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCount(num)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                        count === num
                          ? "border-accent bg-accent text-white shadow-sm"
                          : "border-border bg-surface text-muted hover:border-accent/60"
                      }`}
                    >
                      {num} 題
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-accent hover:underline flex items-center gap-1"
              >
                <span>{showAdvanced ? "▼ 收起進階背景補充" : "▶ 補充活動背景與與會者設定（選填）"}</span>
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    rows={2}
                    placeholder="例如：全體參與者約 35 位資深後端工程師與架構師，剛完成 Sprint 12，重點在於排查技術債..."
                    className="le-input w-full !text-xs"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={generating || !topic.trim()}
                onClick={handleGenerate}
                className="le-btn-primary flex items-center gap-2 !px-5 !py-2 !text-sm shadow-sm hover:shadow"
              >
                {generating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>AI 正在構思互動題目…</span>
                  </>
                ) : (
                  <>
                    <span>🪄 即刻生成靈感題目</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              ⚠️ {error}
            </div>
          )}

          {/* Generated Polls Section */}
          {generatedPolls.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">
                    💡 AI 靈感題庫預覽（已生成 {generatedPolls.length} 題）
                  </h3>
                  <span className="text-xs text-muted">可直接微調標題或自訂選項</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs text-accent hover:underline"
                >
                  {generatedPolls.every((p) => p.selected) ? "取消全選" : "全部選取"}
                </button>
              </div>

              <div className="space-y-3">
                {generatedPolls.map((poll, idx) => (
                  <div
                    key={poll.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      poll.selected
                        ? "border-accent/40 bg-surface shadow-sm"
                        : "border-border bg-surface-raised/30 opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={poll.selected}
                        onChange={() => handleToggleSelect(poll.id)}
                        className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                        aria-label={`勾選題目 ${idx + 1}`}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-muted">#{idx + 1}</span>
                          {getTypeBadge(poll.type)}
                        </div>

                        {/* Editable Title */}
                        <input
                          type="text"
                          value={poll.title}
                          onChange={(e) => handleTitleChange(poll.id, e.target.value)}
                          className="le-input w-full !text-sm font-medium"
                          placeholder="題目名稱"
                        />

                        {/* Rationality */}
                        {poll.rationality && (
                          <p className="text-xs text-muted flex items-start gap-1 bg-surface-raised/60 p-2 rounded-lg">
                            <span className="shrink-0 text-accent">💡 設計目的：</span>
                            <span>{poll.rationality}</span>
                          </p>
                        )}

                        {/* Multiple Choice Options */}
                        {poll.type === "multiple_choice" && (
                          <div className="mt-2 space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted block">
                              選項清單（可增刪）：
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {poll.options.map((opt, optIdx) => (
                                <span
                                  key={optIdx}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-raised px-2.5 py-1 text-xs text-foreground"
                                >
                                  <span>{opt}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(poll.id, optIdx)}
                                    className="text-muted hover:text-danger"
                                    title="刪除此選項"
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={newOptionTexts[poll.id] || ""}
                                onChange={(e) =>
                                  setNewOptionTexts((prev) => ({
                                    ...prev,
                                    [poll.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddOption(poll.id);
                                  }
                                }}
                                placeholder="新增選項..."
                                className="le-input !py-1 !text-xs max-w-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddOption(poll.id)}
                                className="le-btn-secondary !py-1 !px-2.5 !text-xs"
                              >
                                ＋加入
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5 bg-surface-raised">
          <div className="text-xs text-muted">
            {generatedPolls.length > 0 ? (
              <span>
                已勾選 <strong className="text-foreground">{selectedCount}</strong> /{" "}
                {generatedPolls.length} 題
              </span>
            ) : (
              <span>先輸入主題並點擊生成，再行批次建立</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="le-btn-secondary !px-4 !py-2 !text-xs"
            >
              取消
            </button>
            <button
              type="button"
              disabled={creating || selectedCount === 0}
              onClick={handleBatchCreate}
              className="le-btn-primary flex items-center gap-1.5 !px-5 !py-2 !text-xs font-semibold shadow-sm"
            >
              {creating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>批次建立中…</span>
                </>
              ) : (
                <>
                  <span>🚀 批次建立至本活動 ({selectedCount} 題)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
