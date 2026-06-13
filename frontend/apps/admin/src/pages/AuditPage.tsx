/** BE-010 稽核紀錄查詢頁面。 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import {
  type AuditLogData,
  type ListAuditLogsParams,
  listAuditLogs,
} from "../lib/adminApi";

const ACTION_COLORS: Record<string, string> = {
  update_organization: "bg-blue-50 text-blue-700",
  invite_member: "bg-green-50 text-green-700",
  remove_member: "bg-red-50 text-red-600",
  update_member_role: "bg-yellow-50 text-yellow-700",
  admin_update_session_status: "bg-purple-50 text-purple-700",
};

function AuditRow({ log }: { log: AuditLogData }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600";
  const hasDetails = Object.keys(log.details_jsonb).length > 0;

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
          {new Date(log.created_at).toLocaleString("zh-TW", {
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          })}
        </td>
        <td className="py-3 px-4">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {log.action}
          </span>
        </td>
        <td className="py-3 px-4">
          <div className="text-sm text-gray-700">
            {log.actor_email ?? <span className="text-gray-400">系統</span>}
          </div>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {log.target_type}
          </span>
        </td>
        <td className="py-3 px-4 text-xs text-gray-400">
          {log.target_id?.slice(0, 8) ?? "—"}…
        </td>
        <td className="py-3 px-4 text-xs text-gray-400">
          {hasDetails && (
            <span className="text-blue-500">{expanded ? "▲" : "▼"} 詳情</span>
          )}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <pre className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-3 overflow-auto max-h-40">
              {JSON.stringify(log.details_jsonb, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

interface Props {
  onLogout: () => void;
}

export function AuditPage({ onLogout }: Props) {
  const [params, setParams] = useState<ListAuditLogsParams>({ page: 1, page_size: 50 });
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", params],
    queryFn: () => listAuditLogs(params),
  });

  const applyFilter = () => {
    const next: ListAuditLogsParams = { page: 1, page_size: 50 };
    if (action) next.action = action;
    if (targetType) next.target_type = targetType;
    if (dateFrom) next.date_from = dateFrom;
    if (dateTo) next.date_to = dateTo;
    setParams(next);
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <AdminShell active="audit" onLogout={onLogout}>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">稽核紀錄</h1>
          <p className="text-gray-500 mt-1">查詢敏感操作的稽核軌跡（BE-010）。</p>
        </div>

        {/* 篩選器 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">動作</label>
              <input
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如 update_organization"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">目標類型</label>
              <input
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="如 session, user"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">開始日期</label>
              <input
                type="datetime-local"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">結束日期</label>
              <input
                type="datetime-local"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              onClick={applyFilter}
            >
              查詢
            </button>
            <button
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
              onClick={() => {
                setAction(""); setTargetType(""); setDateFrom(""); setDateTo("");
                setParams({ page: 1, page_size: 50 });
              }}
            >
              清除
            </button>
          </div>
        </div>

        {/* 紀錄列表 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6 animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <div className="text-sm">查無紀錄</div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                共 {data?.total ?? 0} 筆（最多顯示 50 筆）
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <th className="py-3 px-4">時間</th>
                      <th className="py-3 px-4">動作</th>
                      <th className="py-3 px-4">執行者</th>
                      <th className="py-3 px-4">目標類型</th>
                      <th className="py-3 px-4">目標 ID</th>
                      <th className="py-3 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((log) => (
                      <AuditRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    第 {params.page} / {totalPages} 頁
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                      disabled={(params.page ?? 1) <= 1}
                      onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) - 1 }))}
                    >
                      上一頁
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                      disabled={(params.page ?? 1) >= totalPages}
                      onClick={() => setParams(p => ({ ...p, page: (p.page ?? 1) + 1 }))}
                    >
                      下一頁
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
