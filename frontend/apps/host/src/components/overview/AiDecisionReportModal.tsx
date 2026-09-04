/** AI 決策報告彈出視窗（視覺化儀表板 + Markdown 預覽 + 匯出/列印）。 */

import * as React from "react";
import { useState, useEffect } from "react";
import { AiConfigTrigger } from "@liveengage/ui";
import {
  generateAiDecisionReport,
  getAiDecisionReport,
  getAiDecisionReportDownloadUrl,
  type AiDecisionReport,
} from "../../lib/overviewApi";

interface Props {
  sessionId: string;
  sessionTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AiDecisionReportModal({
  sessionId,
  sessionTitle,
  isOpen,
  onClose,
}: Props): React.JSX.Element | null {
  const [report, setReport] = useState<AiDecisionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"visual" | "markdown">("visual");
  const [copied, setCopied] = useState<boolean>(false);

  // 當開啟時，先查詢是否已有現成報告；若無則自動生成
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    let isMounted = true;

    async function fetchOrGenerate() {
      setLoading(true);
      setError(null);
      try {
        const existing = await getAiDecisionReport(sessionId);
        if (isMounted && existing) {
          setReport(existing);
          setLoading(false);
          return;
        }
        // 若無現成報告，自動初次生成
        const fresh = await generateAiDecisionReport(sessionId, false);
        if (isMounted) {
          setReport(fresh);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "生成 AI 決策報告時發生問題，請重試。");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchOrGenerate();
    return () => {
      isMounted = false;
    };
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await generateAiDecisionReport(sessionId, true);
      setReport(fresh);
    } catch (err: any) {
      setError(err?.message || "重新分析失敗，請檢查網路連線。");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMarkdown = () => {
    if (!report?.markdown_content) return;
    navigator.clipboard.writeText(report.markdown_content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenPrintHtml = () => {
    const url = getAiDecisionReportDownloadUrl(sessionId);
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm shadow">
                ✨
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                會後 AI 決策報告
              </h3>
              {report?.engagement_rating && (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                  {report.engagement_rating}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sessionTitle} ｜ {report?.generated_at ? `分析時間：${report.generated_at}` : "由 LiveEngage v2 決策引擎生成"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AiConfigTrigger />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="關閉"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("visual")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "visual"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              📊 視覺化報告
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "markdown"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              📝 原始 Markdown
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="依據最新投票與提問重新分析"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              {loading ? "分析中…" : "重新整理"}
            </button>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!report}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              📋 {copied ? "已複製！" : "複製 Markdown"}
            </button>
            <button
              type="button"
              onClick={handleOpenPrintHtml}
              disabled={!report}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              🖨️ 匯出 / 列印 PDF
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !report ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  AI 正在深度解析全場數據…
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  正在萃取群體共識、歸納意見分歧，並梳理未解答焦點與後續行動方案
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                重試生成
              </button>
            </div>
          ) : report && activeTab === "visual" ? (
            <div className="space-y-6">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">參與總人數</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {report.key_metrics.participant_count ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400">人在線</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">主動參與率</div>
                  <div className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {report.key_metrics.engaged_percent ?? 0}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {report.key_metrics.participants_engaged ?? 0} 人發聲
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">投票累計</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {report.key_metrics.poll_votes_total ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400">筆有效票</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Q&A 提問</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {report.key_metrics.qa_questions_total ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    已答覆 {report.key_metrics.answered_count ?? 0} 則
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="rounded-xl border-l-4 border-indigo-600 bg-indigo-50/40 p-5 dark:bg-indigo-950/20">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-indigo-950 dark:text-indigo-200">
                  <span>🎯</span> 執行摘要 (Executive Summary)
                </h4>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {report.executive_summary.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>

              {/* Key Consensuses */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-emerald-600">💡</span> 關鍵共識歸納 (Key Consensuses)
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {report.key_consensuses.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          共識 #{i + 1}
                        </span>
                        <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {c.title}
                        </h5>
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-200">📊 佐證：</strong>
                        {c.evidence}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-800 dark:text-slate-200">🚀 意涵：</strong>
                        {c.impact}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divergences */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-amber-500">⚖️</span> 議題分歧與拉鋸點 (Points of Divergence)
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {report.divergences.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          分歧 #{i + 1}
                        </span>
                        <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {d.topic}
                        </h5>
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {d.description}
                      </p>
                      <div className="mt-2.5 rounded-lg bg-amber-50/70 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <strong>🤝 建議平衡解法：</strong>
                        {d.suggested_compromise}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unanswered Concerns */}
              {report.unanswered_concerns.length > 0 && (
                <div className="space-y-3">
                  <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span className="text-rose-500">❓</span> 觀眾高度關注之未解答焦點 (Top Unanswered Concerns)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {report.unanswered_concerns.map((u, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 border-l-4 border-l-rose-500 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-850"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {u.question}
                          </h5>
                          <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            👍 {u.upvotes}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-800 dark:text-slate-200">關注原因：</strong>
                          {u.why_important}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-800 dark:text-slate-200">建議回覆：</strong>
                          {u.suggested_response_direction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Recommendations */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="text-indigo-600">🚀</span> 建議行動追蹤清單 (Action Items)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                          優先級
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                          負責角色
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                          行動方針
                        </th>
                        <th className="px-3.5 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                          完成時限
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {report.action_recommendations.map((a, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap px-3.5 py-2.5">
                            {a.priority.toLowerCase() === "high" ? (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                                🔴 高 (High)
                              </span>
                            ) : a.priority.toLowerCase() === "medium" ? (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                🟡 中 (Med)
                              </span>
                            ) : (
                              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                🟢 低 (Low)
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-200">
                            {a.owner}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                            {a.action}
                          </td>
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                            {a.timeline}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : report && activeTab === "markdown" ? (
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-slate-950 p-5 text-xs text-slate-200 font-mono leading-relaxed selection:bg-indigo-500">
                {report.markdown_content}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
