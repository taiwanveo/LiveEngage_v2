/** BE-009 組織活動管理頁面。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import {
  type AdminSessionData,
  type ListSessionsParams,
  archiveSession,
  listAdminSessions,
} from "../lib/adminApi";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  live: "直播中",
  ended: "已結束",
  archived: "已封存",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  live: "bg-green-50 text-green-700",
  ended: "bg-orange-50 text-orange-700",
  archived: "bg-red-50 text-red-600",
};

function SessionRow({ session, onArchive }: {
  session: AdminSessionData;
  onArchive: (id: string) => void;
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <div>
          <div className="text-sm font-medium text-gray-900">{session.title}</div>
          <code className="text-xs text-gray-400">{session.code}</code>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[session.status] ?? "bg-gray-100 text-gray-600"}`}>
          {STATUS_LABELS[session.status] ?? session.status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(session.created_at).toLocaleDateString("zh-TW")}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {session.archived_at
          ? new Date(session.archived_at).toLocaleDateString("zh-TW")
          : "—"}
      </td>
      <td className="py-3 px-4">
        {session.status !== "archived" && (
          <button
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
            onClick={() => onArchive(session.id)}
          >
            封存
          </button>
        )}
      </td>
    </tr>
  );
}

interface Props {
  onLogout: () => void;
}

export function SessionsPage({ onLogout }: Props) {
  const qc = useQueryClient();
  const [params, setParams] = useState<ListSessionsParams>({ page: 1, page_size: 20 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sessions", params],
    queryFn: () => listAdminSessions(params),
  });

  const archive = useMutation({
    mutationFn: archiveSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sessions"] }),
  });

  const applySearch = () => {
    const next: ListSessionsParams = { page: 1, page_size: 20 };
    if (search) next.search = search;
    if (statusFilter) next.status = statusFilter;
    setParams(next);
  };

  const handleArchive = (id: string) => {
    if (confirm("確定封存此活動？封存後無法重新開放。")) {
      archive.mutate(id);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <AdminShell active="sessions" onLogout={onLogout}>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">活動管理</h1>
          <p className="text-gray-500 mt-1">查看並管理組織所有活動。</p>
        </div>

        {/* 搜尋與篩選 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">搜尋標題 / 代碼</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="輸入關鍵字..."
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">狀態</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="draft">草稿</option>
                <option value="live">直播中</option>
                <option value="ended">已結束</option>
                <option value="archived">已封存</option>
              </select>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              onClick={applySearch}
            >
              搜尋
            </button>
          </div>
        </div>

        {/* 活動列表 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6 animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-sm">找不到符合條件的活動</div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                共 {data?.total ?? 0} 筆
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    <th className="py-3 px-4">活動</th>
                    <th className="py-3 px-4">狀態</th>
                    <th className="py-3 px-4">建立時間</th>
                    <th className="py-3 px-4">封存時間</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((s) => (
                    <SessionRow key={s.id} session={s} onArchive={handleArchive} />
                  ))}
                </tbody>
              </table>

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
