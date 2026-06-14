/** S7-4 品牌設定頁面。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AdminFieldHint,
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  adminBtnPrimary,
  adminInputClass,
} from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import { getBranding, updateBranding } from "../lib/adminApi";

interface Props {
  onLogout: () => void;
}

export function BrandingPage({ onLogout }: Props): React.JSX.Element {
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
      <div className="mx-auto max-w-2xl space-y-6">
        <AdminPageHeader
          title="品牌設定"
          description="Logo、主色與自訂網域。"
        />

        {isLoading ? (
          <div className="le-card h-48 animate-pulse" />
        ) : (
          <AdminPanel className="space-y-4 p-6">
            <AdminFormField label="顯示名稱">
              <input
                className={adminInputClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="覆寫組織名稱（選填）"
              />
            </AdminFormField>
            <AdminFormField label="Logo URL">
              <input
                className={adminInputClass}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </AdminFormField>
            <AdminFormField label="Favicon URL">
              <input
                className={adminInputClass}
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://..."
              />
            </AdminFormField>
            <AdminFormField label="主色">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-border bg-surface"
                />
                <input
                  className={`${adminInputClass} font-mono`}
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </AdminFormField>
            <AdminFormField label="自訂網域">
              <input
                className={adminInputClass}
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="events.example.com"
              />
              <AdminFieldHint>DNS 設定請於 Zeabur 網域管理完成。</AdminFieldHint>
            </AdminFormField>

            {logoUrl ? (
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm font-medium text-muted">Logo 預覽</p>
                <img src={logoUrl} alt="Logo 預覽" className="max-h-16 object-contain" />
              </div>
            ) : null}

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <button
              className={adminBtnPrimary}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "儲存中..." : "儲存品牌設定"}
            </button>
          </AdminPanel>
        )}
      </div>
    </AdminShell>
  );
}
