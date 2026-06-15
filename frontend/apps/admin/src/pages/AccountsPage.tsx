/** 帳號管理：組織成員邀請、編輯與角色。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Modal, useSystemNotice } from "@liveengage/ui";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  adminBtnPrimary,
  adminBtnSecondary,
  adminInputClass,
  adminPageStackClass,
  adminTableHeadClass,
} from "../components/AdminLayout";
import { AdminShell } from "../components/AdminShell";
import {
  type MemberData,
  inviteMember,
  listMembers,
  removeMember,
  updateMember,
} from "../lib/adminApi";

const ROLE_LABELS: Record<string, string> = {
  owner: "擁有者",
  admin: "管理員",
  host: "主持人",
  member: "主持人", // legacy JWT／DB
  cohost: "助理主持人",
  guest: "訪客（已停用）",
};

const INVITE_ROLES = [
  { value: "host", label: "主持人" },
  { value: "cohost", label: "助理主持人" },
  { value: "admin", label: "管理員" },
] as const;

function normalizeRole(role: MemberData["role"]): string {
  return role === "member" ? "host" : role;
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const { showError, systemNoticeModal } = useSystemNotice();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("host");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof inviteMember>[0] = { email, role, password };
      if (name) payload.name = name;
      return inviteMember(payload);
    },
    onSuccess: () => {
      onDone();
      setEmail("");
      setName("");
      setPassword("");
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface-elevated/30 p-4">
      <AdminSectionTitle>邀請新使用者</AdminSectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminFormField label="Email">
          <input
            className={adminInputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
          />
        </AdminFormField>
        <AdminFormField label="姓名（選填）">
          <input
            className={adminInputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
          />
        </AdminFormField>
        <AdminFormField label="密碼">
          <input
            className={adminInputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 碼"
          />
        </AdminFormField>
        <AdminFormField label="角色">
          <select
            className={adminInputClass}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {INVITE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </AdminFormField>
      </div>
      <div className="flex justify-end gap-2">
        <button
          className={adminBtnPrimary}
          disabled={mutation.isPending || !email || !password}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "邀請中..." : "邀請"}
        </button>
      </div>
      {systemNoticeModal}
    </div>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: MemberData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showError, showSuccess, systemNoticeModal } = useSystemNotice();
  const isOwner = member.role === "owner";
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState(normalizeRole(member.role));
  const [password, setPassword] = useState("");

  useEffect(() => {
    setName(member.name ?? "");
    setRole(normalizeRole(member.role));
    setPassword("");
  }, [member]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof updateMember>[1] = {};
      const trimmedName = name.trim();
      if (trimmedName !== (member.name ?? "")) {
        payload.name = trimmedName;
      }
      if (!isOwner && role !== normalizeRole(member.role)) {
        payload.role = role;
      }
      if (password) {
        payload.password = password;
      }
      if (!payload.name && !payload.role && !payload.password) {
        throw new Error("請修改至少一項欄位");
      }
      return updateMember(member.id, payload);
    },
    onSuccess: () => {
      showSuccess("成員資料已更新");
      onSaved();
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  return (
    <>
      <Modal open title="編輯成員" onClose={onClose} showCloseButton={false} size="md">
        <div className="space-y-3">
          <AdminFormField label="Email">
            <input className={adminInputClass} type="email" value={member.email} disabled />
          </AdminFormField>
          <AdminFormField label="姓名">
            <input
              className={adminInputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="姓名"
            />
          </AdminFormField>
          <AdminFormField label="角色">
            {isOwner ? (
              <input
                className={adminInputClass}
                value={ROLE_LABELS[member.role]}
                disabled
              />
            ) : (
              <select
                className={adminInputClass}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </AdminFormField>
          <AdminFormField label="新密碼（選填）">
            <input
              className={adminInputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="留空則不變更，至少 8 碼"
            />
          </AdminFormField>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className={adminBtnSecondary} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={adminBtnPrimary}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "儲存中..." : "儲存"}
          </button>
        </div>
      </Modal>
      {systemNoticeModal}
    </>
  );
}

function MemberRow({
  member,
  onEdit,
}: {
  member: MemberData;
  onEdit: (member: MemberData) => void;
}) {
  const qc = useQueryClient();
  const { showError } = useSystemNotice();

  const onRemove = async () => {
    if (!confirm(`確定移除成員 ${member.email}？`)) return;
    try {
      await removeMember(member.id);
      void qc.invalidateQueries({ queryKey: ["admin-members"] });
    } catch (e) {
      showError(e instanceof Error ? e.message : "移除失敗");
    }
  };

  const isOwner = member.role === "owner";

  return (
    <tr className="border-b border-border hover:bg-surface-elevated/30">
      <td className="px-4 py-3">
        <div>
          <div className="text-sm font-medium text-foreground">{member.name ?? "—"}</div>
          <div className="text-xs text-muted">{member.email}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={
            isOwner
              ? "inline-block rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400"
              : "inline-block rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-foreground"
          }
        >
          {ROLE_LABELS[member.role] ?? member.role}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(member.created_at).toLocaleDateString("zh-TW")}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => onEdit(member)}
          >
            編輯
          </button>
          {!isOwner ? (
            <button
              type="button"
              className="text-xs text-danger hover:underline"
              onClick={() => void onRemove()}
            >
              移除
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

interface Props {
  onLogout: () => void;
}

export function AccountsPage({ onLogout }: Props): React.JSX.Element {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: listMembers,
  });
  const [showInvite, setShowInvite] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberData | null>(null);

  return (
    <AdminShell active="accounts" onLogout={onLogout}>
      <div className={`mx-auto max-w-4xl ${adminPageStackClass}`}>
        <AdminPageHeader
          title="帳號管理"
          description="邀請成員，或編輯姓名、密碼與角色權限。"
        />

        <AdminPanel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <AdminSectionTitle>組織成員</AdminSectionTitle>
            <button className={adminBtnPrimary} onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? "取消" : "+ 邀請成員"}
            </button>
          </div>

          {showInvite ? (
            <div className="px-6 pb-2 pt-4">
              <InviteForm
                onDone={() => {
                  setShowInvite(false);
                  void qc.invalidateQueries({ queryKey: ["admin-members"] });
                }}
              />
            </div>
          ) : null}

          {isLoading ? (
            <div className="animate-pulse space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-surface-elevated" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className={adminTableHeadClass}>
                  <th className="px-4 py-3">成員</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">加入時間</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} onEdit={setEditingMember} />
                ))}
              </tbody>
            </table>
          )}
        </AdminPanel>
      </div>

      {editingMember ? (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["admin-members"] })}
        />
      ) : null}
    </AdminShell>
  );
}
