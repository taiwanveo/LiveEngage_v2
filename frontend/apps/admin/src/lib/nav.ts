/** 管理後台導覽項目。 */

export type AdminRoute =
  | "dashboard"
  | "sessions"
  | "audit"
  | "accounts"
  | "organization"
  | "exports";

export interface NavItem {
  id: AdminRoute;
  label: string;
  hash: string;
  description: string;
  sprint: string;
}

/** 側欄顯示順序（不含 dashboard 時用於子頁）。 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "總覽",
    hash: "#/dashboard",
    description: "組織活動概況與參與度分析",
    sprint: "S7-1",
  },
  {
    id: "sessions",
    label: "活動管理",
    hash: "#/sessions",
    description: "查看並管理組織所有活動",
    sprint: "S7-2",
  },
  {
    id: "audit",
    label: "稽核記錄",
    hash: "#/audit",
    description: "查詢敏感操作的稽核軌跡",
    sprint: "S7-3",
  },
  {
    id: "accounts",
    label: "帳號管理",
    hash: "#/accounts",
    description: "邀請成員與管理角色",
    sprint: "S7-2",
  },
  {
    id: "organization",
    label: "組織設定",
    hash: "#/organization",
    description: "管理組織資料與品牌外觀",
    sprint: "S7-2",
  },
  {
    id: "exports",
    label: "資料匯出",
    hash: "#/exports",
    description: "XLSX/CSV 匯出與簽名下載連結",
    sprint: "S7-5",
  },
];
