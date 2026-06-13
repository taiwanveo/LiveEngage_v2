/** S7-5 資料匯出頁面（BE-012）。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(job.created_at).toLocaleString("zh-TW")}
      </td>
      <td className="py-3 px-4 text-xs font-mono text-gray-600">
        {job.session_id.slice(0, 8)}…
      </td>
      <td className="py-3 px-4">
        <span className="uppercase text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
          {job.format}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            job.status === "completed"
              ? "bg-green-50 text-green-700"
              : job.status === "failed"
                ? "bg-red-50 text-red-600"
                : "bg-yellow-50 text-yellow-700"
          }`}
        >
          {job.status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">{exp}</td>
      <td className="py-3 px-4">
        {job.download_url ? (
          <a
            href={job.download_url}
            className="text-xs text-blue-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            下載
          </a>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

export function ExportsPage({ onLogout }: Props) {
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
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">資料匯出</h1>
          <p className="text-gray-500 mt-1">BE-012：XLSX/CSV 匯出、72h 簽名下載連結。</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">建立匯出</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">活動</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">格式</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={!sessionId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "匯出中..." : "建立匯出"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
            匯出紀錄（下載連結 72 小時有效）
          </div>
          {exportsQuery.isLoading ? (
            <div className="p-6 animate-pulse h-32 bg-gray-50" />
          ) : exportsQuery.data?.items.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">尚無匯出紀錄</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="py-3 px-4">建立時間</th>
                  <th className="py-3 px-4">活動</th>
                  <th className="py-3 px-4">格式</th>
                  <th className="py-3 px-4">狀態</th>
                  <th className="py-3 px-4">到期</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {exportsQuery.data?.items.map((job) => (
                  <ExportRow key={job.id} job={job} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
