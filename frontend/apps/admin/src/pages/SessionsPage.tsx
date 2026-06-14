/** BE-009 組織活動管理頁面。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  adminBtnPrimary,
  adminBtnSecondary,
  adminInputClass,
  adminMetaBarClass,
  adminTableHeadClass,
} from "../components/AdminLayout";
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
  draft: "bg-surface-elevated text-muted",
  live: "bg-green-500/10 text-green-600 dark:text-green-400",
  ended: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  archived: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function SessionRow({
  session,
  onArchive,
}: {
  session: AdminSessionData;
  onArchive: (id: string) => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-surface-elevated/30">
      <td className="px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">{session.title}</div>
          <code className="text-xs text-muted">{session.code}</code>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[session.status] ?? "bg-surface-elevated text-muted"}`}
        >
          {STATUS_LABELS[session.status] ?? session.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(session.created_at).toLocaleDateString("zh-TW")}
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {session.archived_at
          ? new Date(session.archived_at).toLocaleDateString("zh-TW")
          : "—"}
      </td>
      <td className="px-4 py-3">
        {session.status !== "archived" ? (
          <button
            className="text-xs text-danger hover:underline"
            onClick={() => onArchive(session.id)}
          >
            封存
          </button>
        ) : null}
      </td>
    </tr>
  );
}

interface Props {
  onLogout: () => void;
}

export function SessionsPage({ onLogout }: Props): React.JSX.Element {
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
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader
          title="活動管理"
          description="查看並管理組織所有活動。"
        />

        <AdminPanel className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <AdminFormField label="搜尋標題 / 代碼" className="min-w-48 flex-1">
              <input
                className={adminInputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="輸入關鍵字..."
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
            </AdminFormField>
            <AdminFormField label="狀態">
              <select
                className={adminInputClass}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">全部</option>
                <option value="draft">草稿</option>
                <option value="live">直播中</option>
                <option value="ended">已結束</option>
                <option value="archived">已封存</option>
              </select>
            </AdminFormField>
            <button className={adminBtnPrimary} onClick={applySearch}>
              搜尋
            </button>
          </div>
        </AdminPanel>

        <AdminPanel className="overflow-hidden">
          {isLoading ? (
            <div className="animate-pulse space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded bg-surface-elevated" />
              ))}
            </div>
          ) : data?.items.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <div className="mb-3 text-4xl">📋</div>
              <div className="text-sm">找不到符合條件的活動</div>
            </div>
          ) : (
            <>
              <div className={adminMetaBarClass}>共 {data?.total ?? 0} 筆</div>
              <table className="w-full">
                <thead>
                  <tr className={adminTableHeadClass}>
                    <th className="px-4 py-3">活動</th>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3">建立時間</th>
                    <th className="px-4 py-3">封存時間</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((s) => (
                    <SessionRow key={s.id} session={s} onArchive={handleArchive} />
                  ))}
                </tbody>
              </table>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-muted">
                    第 {params.page} / {totalPages} 頁
                  </span>
                  <div className="flex gap-2">
                    <button
                      className={`${adminBtnSecondary} !min-h-0 px-3 py-1.5 text-xs`}
                      disabled={(params.page ?? 1) <= 1}
                      onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                    >
                      上一頁
                    </button>
                    <button
                      className={`${adminBtnSecondary} !min-h-0 px-3 py-1.5 text-xs`}
                      disabled={(params.page ?? 1) >= totalPages}
                      onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                    >
                      下一頁
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
