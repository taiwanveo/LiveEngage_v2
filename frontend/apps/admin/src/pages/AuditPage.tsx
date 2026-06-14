/** BE-010 稽核紀錄查詢頁面。 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  adminBtnPrimary,
  adminBtnSecondary,
  adminInputClass,
  adminMetaBarClass,
  adminPageStackClass,
  adminTableHeadClass,
} from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import {
  type AuditLogData,
  type ListAuditLogsParams,
  listAuditLogs,
} from "../lib/adminApi";

const ACTION_COLORS: Record<string, string> = {
  update_organization: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  invite_member: "bg-green-500/10 text-green-600 dark:text-green-400",
  remove_member: "bg-red-500/10 text-red-600 dark:text-red-400",
  update_member_role: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  admin_update_session_status: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

function AuditRow({ log }: { log: AuditLogData }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ACTION_COLORS[log.action] ?? "bg-surface-elevated text-muted";
  const hasDetails = Object.keys(log.details_jsonb).length > 0;

  return (
    <>
      <tr
        className={`border-b border-border hover:bg-surface-elevated/30 ${hasDetails ? "cursor-pointer" : ""}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
          {new Date(log.created_at).toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
          >
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-foreground">
            {log.actor_email ?? <span className="text-muted">系統</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs text-muted">
            {log.target_type}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted">
          {log.target_id?.slice(0, 8) ?? "—"}…
        </td>
        <td className="px-4 py-3 text-xs text-muted">
          {hasDetails ? (
            <span className="text-accent">{expanded ? "▲" : "▼"} 詳情</span>
          ) : null}
        </td>
      </tr>
      {expanded && hasDetails ? (
        <tr className="bg-surface-elevated/30">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <pre className="max-h-40 overflow-auto rounded border border-border bg-surface p-3 text-xs text-muted">
              {JSON.stringify(log.details_jsonb, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

interface Props {
  onLogout: () => void;
}

export function AuditPage({ onLogout }: Props): React.JSX.Element {
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
      <div className={`mx-auto max-w-6xl ${adminPageStackClass}`}>
        <AdminPageHeader
          title="稽核記錄"
          description="查詢敏感操作的稽核軌跡。"
        />

        <AdminPanel className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <AdminFormField label="動作">
              <input
                className={adminInputClass}
                placeholder="如 update_organization"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
            </AdminFormField>
            <AdminFormField label="目標類型">
              <input
                className={adminInputClass}
                placeholder="如 session, user"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
            </AdminFormField>
            <AdminFormField label="開始日期">
              <input
                type="datetime-local"
                className={adminInputClass}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </AdminFormField>
            <AdminFormField label="結束日期">
              <input
                type="datetime-local"
                className={adminInputClass}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </AdminFormField>
            <button className={adminBtnPrimary} onClick={applyFilter}>
              查詢
            </button>
            <button
              className={adminBtnSecondary}
              onClick={() => {
                setAction("");
                setTargetType("");
                setDateFrom("");
                setDateTo("");
                setParams({ page: 1, page_size: 50 });
              }}
            >
              清除
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
              <div className="mb-3 text-4xl">🔍</div>
              <div className="text-sm">查無紀錄</div>
            </div>
          ) : (
            <>
              <div className={adminMetaBarClass}>
                共 {data?.total ?? 0} 筆（最多顯示 50 筆）
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className={adminTableHeadClass}>
                      <th className="px-4 py-3">時間</th>
                      <th className="px-4 py-3">動作</th>
                      <th className="px-4 py-3">執行者</th>
                      <th className="px-4 py-3">目標類型</th>
                      <th className="px-4 py-3">目標 ID</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((log) => (
                      <AuditRow key={log.id} log={log} />
                    ))}
                  </tbody>
                </table>
              </div>

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
