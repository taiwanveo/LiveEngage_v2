/** BE-008 組織設定與成員管理頁面。 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import {
  type MemberData,
  getOrganization,
  inviteMember,
  listMembers,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from "../lib/adminApi";

const ROLE_LABELS: Record<string, string> = {
  owner: "擁有者",
  admin: "管理員",
  member: "成員",
  guest: "訪客",
};

function OrgSettings() {
  const qc = useQueryClient();
  const { data: org, isLoading } = useQuery({
    queryKey: ["admin-org"],
    queryFn: getOrganization,
  });

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (name: string) => updateOrganization({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-org"] });
      setEditing(false);
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !org) {
    return <div className="animate-pulse h-24 bg-gray-100 rounded-lg" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">組織資料</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">組織名稱</label>
          {editing ? (
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={org.name}
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(nameInput)}
              >
                儲存
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                onClick={() => { setEditing(false); setError(""); }}
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-gray-900">{org.name}</span>
              <button
                className="text-sm text-blue-600 hover:underline"
                onClick={() => { setNameInput(org.name); setEditing(true); }}
              >
                編輯
              </button>
            </div>
          )}
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">方案</label>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 uppercase">
            {org.plan ?? "free"}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">組織 ID</label>
          <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">{org.id}</code>
        </div>
      </div>
    </div>
  );
}

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
    onSuccess: () => { onDone(); setEmail(""); setName(""); setPassword(""); setError(""); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">邀請新成員</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">姓名（選填）</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">密碼</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 8 碼"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">角色</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={role} onChange={(e) => setRole(e.target.value)}
          >
            <option value="member">成員</option>
            <option value="admin">管理員</option>
            <option value="guest">訪客</option>
          </select>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={mutation.isPending || !email || !password}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "邀請中..." : "邀請"}
        </button>
      </div>
    </div>
  );
}

function MemberRow({ member, currentUserId }: { member: MemberData; currentUserId?: string }) {
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

  const isMe = member.id === currentUserId;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4">
        <div>
          <div className="text-sm font-medium text-gray-900">{member.name ?? "—"}</div>
          <div className="text-xs text-gray-500">{member.email}</div>
        </div>
      </td>
      <td className="py-3 px-4">
        {member.role === "owner" ? (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
            {ROLE_LABELS[member.role]}
          </span>
        ) : (
          <select
            className="text-sm border border-gray-200 rounded px-2 py-1 disabled:opacity-50"
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={saving || isMe}
          >
            {Object.entries(ROLE_LABELS).filter(([r]) => r !== "owner").map(([r, l]) => (
              <option key={r} value={r}>{l}</option>
            ))}
          </select>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(member.created_at).toLocaleDateString("zh-TW")}
      </td>
      <td className="py-3 px-4">
        {!isMe && member.role !== "owner" && (
          <button
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
            onClick={onRemove}
          >
            移除
          </button>
        )}
      </td>
    </tr>
  );
}

function MembersTable() {
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: listMembers,
  });
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">組織成員</h2>
        <button
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          onClick={() => setShowInvite(!showInvite)}
        >
          {showInvite ? "取消" : "+ 邀請成員"}
        </button>
      </div>

      {showInvite && (
        <div className="px-6 pt-4 pb-2">
          <InviteForm onDone={() => {
            setShowInvite(false);
            qc.invalidateQueries({ queryKey: ["admin-members"] });
          }} />
        </div>
      )}

      {isLoading ? (
        <div className="p-6 animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
              <th className="py-3 px-4">成員</th>
              <th className="py-3 px-4">角色</th>
              <th className="py-3 px-4">加入時間</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface Props {
  onLogout: () => void;
}

export function OrganizationPage({ onLogout }: Props) {
  return (
    <AdminShell active="organization" onLogout={onLogout}>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">組織設定</h1>
          <p className="text-gray-500 mt-1">管理組織資料與成員。</p>
        </div>
        <OrgSettings />
        <MembersTable />
      </div>
    </AdminShell>
  );
}
