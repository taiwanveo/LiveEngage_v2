/** S7-5 資料匯出頁面（BE-012）。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  adminBtnPrimary,
  adminInputClass,
  adminMetaBarClass,
  adminTableHeadClass,
} from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import {
  createExport,
  listAdminSessions,
  listExports,
  type ExportJobData,
} from "../lib/adminApi";

interface Props {
  onLogout: () => void;
}

function ExportRow({ job }: { job: ExportJobData }) {
  const exp = job.expires_at
    ? new Date(job.expires_at).toLocaleString("zh-TW")
    : "—";

  return (
    <tr className="border-b border-border hover:bg-surface-elevated/30">
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(job.created_at).toLocaleString("zh-TW")}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted">
        {job.session_id.slice(0, 8)}…
      </td>
      <td className="px-4 py-3">
        <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-medium uppercase text-foreground">
          {job.format}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            job.status === "completed"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : job.status === "failed"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          }`}
        >
          {job.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">{exp}</td>
      <td className="px-4 py-3">
        {job.download_url ? (
          <a
            href={job.download_url}
            className="text-xs text-accent hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            下載
          </a>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

export function ExportsPage({ onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState("");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [error, setError] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions-export"],
    queryFn: () => listAdminSessions({ page_size: 50 }),
  });

  const exportsQuery = useQuery({
    queryKey: ["admin-exports"],
    queryFn: () => listExports(),
  });

  const mutation = useMutation({
    mutationFn: () => createExport({ session_id: sessionId, format }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-exports"] });
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AdminShell active="exports" onLogout={onLogout}>
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader
          title="資料匯出"
          description="XLSX/CSV 匯出與 72 小時簽名下載連結。"
        />

        <AdminPanel className="space-y-4 p-6">
          <AdminSectionTitle>建立匯出</AdminSectionTitle>
          <div className="flex flex-wrap items-end gap-3">
            <AdminFormField label="活動" className="min-w-48 flex-1">
              <select
                className={adminInputClass}
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">選擇活動…</option>
                {sessionsQuery.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.code})
                  </option>
                ))}
              </select>
            </AdminFormField>
            <AdminFormField label="格式">
              <select
                className={adminInputClass}
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </AdminFormField>
            <button
              className={adminBtnPrimary}
              disabled={!sessionId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "匯出中..." : "建立匯出"}
            </button>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </AdminPanel>

        <AdminPanel className="overflow-hidden">
          <div className={adminMetaBarClass}>匯出紀錄（下載連結 72 小時有效）</div>
          {exportsQuery.isLoading ? (
            <div className="h-32 animate-pulse bg-surface-elevated/30 p-6" />
          ) : exportsQuery.data?.items.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">尚無匯出紀錄</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">建立時間</th>
                  <th className="px-4 py-3">活動</th>
                  <th className="px-4 py-3">格式</th>
                  <th className="px-4 py-3">狀態</th>
                  <th className="px-4 py-3">到期</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {exportsQuery.data?.items.map((job) => (
                  <ExportRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
