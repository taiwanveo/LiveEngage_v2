/** 組織設定：組織資料與品牌（合併單一區塊）。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSystemNotice } from "@liveengage/ui";
import {
  AdminFieldHint,
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  adminBtnPrimary,
  adminBtnSecondary,
  adminInputClass,
  adminPageStackClass,
} from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import {
  getBranding,
  getOrganization,
  updateBranding,
  updateOrganization,
} from "../lib/adminApi";

function OrganizationSettings() {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["admin-org"],
    queryFn: getOrganization,
  });
  const { data: brandingData, isLoading: brandingLoading } = useQuery({
    queryKey: ["admin-branding"],
    queryFn: getBranding,
  });

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [overrideThemeColors, setOverrideThemeColors] = useState(false);
  const [customDomain, setCustomDomain] = useState("");

  useEffect(() => {
    if (org) {
      setNameInput(org.name);
    }
  }, [org]);

  useEffect(() => {
    if (brandingData?.branding) {
      const b = brandingData.branding;
      setLogoUrl(b.logo_url ?? "");
      setFaviconUrl(b.favicon_url ?? "");
      setPrimaryColor(b.primary_color);
      setOverrideThemeColors(b.override_theme_colors ?? false);
      setCustomDomain(b.custom_domain ?? "");
    }
  }, [brandingData]);

  const nameMutation = useMutation({
    mutationFn: (name: string) => updateOrganization({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-org"] });
      qc.invalidateQueries({ queryKey: ["admin-org-branding"] });
      qc.invalidateQueries({ queryKey: ["admin-site-branding"] });
      setEditingName(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  const brandingMutation = useMutation({
    mutationFn: () =>
      updateBranding({
        logo_url: logoUrl || null,
        favicon_url: faviconUrl || null,
        primary_color: primaryColor,
        custom_domain: customDomain || null,
        display_name: null,
        override_theme_colors: overrideThemeColors,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
      qc.invalidateQueries({ queryKey: ["admin-org-branding"] });
      qc.invalidateQueries({ queryKey: ["admin-site-branding"] });
    },
    onError: (e: Error) => showError(e.message),
  });

  if (orgLoading || brandingLoading || !org) {
    return <div className="le-card h-48 animate-pulse p-6" />;
  }

  return (
    <AdminPanel className="space-y-4 p-6">
      <AdminSectionTitle className="mb-2">組織資料</AdminSectionTitle>

      <AdminFormField label="組織名稱">
        {editingName ? (
          <div className="flex flex-wrap gap-2">
            <input
              className={`${adminInputClass} min-w-[200px] flex-1`}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={org.name}
            />
            <button
              className={adminBtnPrimary}
              disabled={nameMutation.isPending}
              onClick={() => nameMutation.mutate(nameInput)}
            >
              儲存
            </button>
            <button
              className={adminBtnSecondary}
              onClick={() => {
                setEditingName(false);
                setNameInput(org.name);
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground">{org.name}</span>
            <button
              className="text-sm text-accent hover:underline"
              onClick={() => {
                setNameInput(org.name);
                setEditingName(true);
              }}
            >
              編輯
            </button>
          </div>
        )}
        <AdminFieldHint>
          登入頁標題會顯示為「{'{組織名稱}'} 即時互動通」；若未設定組織名稱則預設為 LiveEngage
          即時互動通。Logo 會套用在登入頁與加入頁。
        </AdminFieldHint>
      </AdminFormField>

      <AdminFormField label="方案">
        <span className="inline-block rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium uppercase text-accent">
          {org.plan ?? "free"}
        </span>
      </AdminFormField>

      <AdminFormField label="組織 ID">
        <code className="rounded bg-surface-elevated px-2 py-1 text-xs text-muted">
          {org.id}
        </code>
      </AdminFormField>

      <div className="border-t border-border pt-4" />

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

      <AdminFormField label="組織主色">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 rounded border border-border bg-surface"
          />
          <input
            className={`${adminInputClass} max-w-xs font-mono`}
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
            checked={overrideThemeColors}
            onChange={(e) => setOverrideThemeColors(e.target.checked)}
          />
          <span>
            使用組織主色覆蓋主題按鈕與連結配色
            <span className="mt-0.5 block text-xs font-normal text-muted">
              未勾選時，介面配色依右上角主題切換（Slido 綠、Cursor 橘等）；勾選後全站按鈕與連結改為上方主色。
            </span>
          </span>
        </label>
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

      <button
        className={adminBtnPrimary}
        disabled={brandingMutation.isPending}
        onClick={() => brandingMutation.mutate()}
      >
        {brandingMutation.isPending ? "儲存中..." : "儲存品牌設定"}
      </button>
      {systemNoticeModal}
    </AdminPanel>
  );
}

interface Props {
  onLogout: () => void;
}

export function OrganizationPage({ onLogout }: Props): React.JSX.Element {
  return (
    <AdminShell active="organization" onLogout={onLogout}>
      <div className={`mx-auto max-w-2xl ${adminPageStackClass}`}>
        <AdminPageHeader title="組織設定" description="管理組織資料與品牌設定。" />
        <OrganizationSettings />
      </div>
    </AdminShell>
  );
}
