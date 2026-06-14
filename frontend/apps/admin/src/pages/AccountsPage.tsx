/** 帳號管理：組織成員邀請與角色。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPanel,
  AdminSectionTitle,
  adminBtnPrimary,
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
  updateMemberRole,
} from "../lib/adminApi";

const ROLE_LABELS: Record<string, string> = {
  owner: "擁有者",
  admin: "管理員",
  member: "成員",
  guest: "訪客",
};

function InviteForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("member");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface-elevated/30 p-4">
      <AdminSectionTitle>邀請新成員</AdminSectionTitle>
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
            <option value="member">成員</option>
            <option value="admin">管理員</option>
            <option value="guest">訪客</option>
          </select>
        </AdminFormField>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          className={adminBtnPrimary}
          disabled={mutation.isPending || !email || !password}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "邀請中..." : "邀請"}
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberData }) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [saving, setSaving] = useState(false);

  const onRoleChange = async (newRole: string) => {
    setSaving(true);
    setSelectedRole(newRole as MemberData["role"]);
    await updateMemberRole(member.id, newRole);
    qc.invalidateQueries({ queryKey: ["admin-members"] });
    setSaving(false);
  };

  const onRemove = async () => {
    if (!confirm(`確定移除成員 ${member.email}？`)) return;
    await removeMember(member.id);
    qc.invalidateQueries({ queryKey: ["admin-members"] });
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
        {isOwner ? (
          <span className="inline-block rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
            {ROLE_LABELS[member.role]}
          </span>
        ) : (
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground disabled:opacity-50"
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={saving}
          >
            {Object.entries(ROLE_LABELS)
              .filter(([r]) => r !== "owner")
              .map(([r, l]) => (
                <option key={r} value={r}>
                  {l}
                </option>
              ))}
          </select>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted">
        {new Date(member.created_at).toLocaleDateString("zh-TW")}
      </td>
      <td className="px-4 py-3">
        {!isOwner ? (
          <button className="text-xs text-danger hover:underline" onClick={onRemove}>
            移除
          </button>
        ) : null}
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

  return (
    <AdminShell active="accounts" onLogout={onLogout}>
      <div className={`mx-auto max-w-4xl ${adminPageStackClass}`}>
        <AdminPageHeader
          title="帳號管理"
          description="邀請成員並管理角色權限。"
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
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </tbody>
            </table>
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
