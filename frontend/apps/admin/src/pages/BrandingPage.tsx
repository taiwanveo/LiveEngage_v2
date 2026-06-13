/** S7-4 品牌設定頁面。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { getBranding, updateBranding } from "../lib/adminApi";

interface Props {
  onLogout: () => void;
}

export function BrandingPage({ onLogout }: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-branding"], queryFn: getBranding });

  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [customDomain, setCustomDomain] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (data?.branding) {
      setLogoUrl(data.branding.logo_url ?? "");
      setFaviconUrl(data.branding.favicon_url ?? "");
      setPrimaryColor(data.branding.primary_color);
      setCustomDomain(data.branding.custom_domain ?? "");
      setDisplayName(data.branding.display_name ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateBranding({
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primaryColor,
        custom_domain: customDomain || null,
        display_name: displayName || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AdminShell active="branding" onLogout={onLogout}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">品牌設定</h1>
          <p className="text-gray-500 mt-1">Logo、主色、自訂網域（S7-4）。</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顯示名稱</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="覆寫組織名稱（選填）"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">主色</label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-gray-300"
                />
                <input
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">自訂網域</label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="events.example.com"
              />
              <p className="text-xs text-gray-400 mt-1">DNS 設定請於 Zeabur 網域管理完成。</p>
            </div>

            {logoUrl && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Logo 預覽</p>
                <img src={logoUrl} alt="Logo 預覽" className="max-h-16 object-contain" />
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "儲存中..." : "儲存品牌設定"}
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
