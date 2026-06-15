/** 組織設定：組織資料與品牌外觀。 */

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

function OrgSettings() {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const { data: org, isLoading } = useQuery({
    queryKey: ["admin-org"],
    queryFn: getOrganization,
  });

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const mutation = useMutation({
    mutationFn: (name: string) => updateOrganization({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-org"] });
      setEditing(false);
    },
    onError: (e: Error) => showError(e.message),
  });

  if (isLoading || !org) {
    return <div className="le-card h-24 animate-pulse p-6" />;
  }

  return (
    <AdminPanel className="p-6">
      <AdminSectionTitle className="mb-4">組織資料</AdminSectionTitle>
      <div className="space-y-4">
        <AdminFormField label="組織名稱">
          {editing ? (
            <div className="flex flex-wrap gap-2">
              <input
                className={`${adminInputClass} min-w-[200px] flex-1`}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={org.name}
              />
              <button
                className={adminBtnPrimary}
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(nameInput)}
              >
                儲存
              </button>
              <button
                className={adminBtnSecondary}
                onClick={() => {
                  setEditing(false);
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
                  setEditing(true);
                }}
              >
                編輯
              </button>
            </div>
          )}
          <AdminFieldHint>
            參與者端公開顯示名稱亦使用此組織名稱（若未另外設定品牌顯示名）。
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
      </div>
      {systemNoticeModal}
    </AdminPanel>
  );
}

function BrandingSettings() {
  const qc = useQueryClient();
  const { showError, systemNoticeModal } = useSystemNotice();
  const { data, isLoading } = useQuery({ queryKey: ["admin-branding"], queryFn: getBranding });

  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [customDomain, setCustomDomain] = useState("");
  const [displayName, setDisplayName] = useState("");

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
        display_name: displayName.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
    },
    onError: (e: Error) => showError(e.message),
  });

  if (isLoading) {
    return <div className="le-card h-48 animate-pulse" />;
  }

  return (
    <AdminPanel className="space-y-4 p-6">
      <AdminSectionTitle className="mb-2">品牌外觀</AdminSectionTitle>
      <p className="mb-4 text-xs text-muted">
        Logo、主色等設定會套用在管理後台登入頁、Host 頂欄與 Participant 加入頁。
      </p>

      <AdminFormField label="品牌顯示名稱（選填）">
        <input
          className={adminInputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="留空則使用「組織資料」中的組織名稱"
        />
        <AdminFieldHint>
          登入頁標題會顯示為「{'{名稱}'} 即時互動通」；皆未設定時預設為 LiveEngage 即時互動通。
        </AdminFieldHint>
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

      <button
        className={adminBtnPrimary}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "儲存中..." : "儲存品牌設定"}
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
        <AdminPageHeader title="組織設定" description="管理組織資料。" />
        <OrgSettings />
        <BrandingSettings />
      </div>
    </AdminShell>
  );
}
