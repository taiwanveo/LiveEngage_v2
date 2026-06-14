/** 管理後台導覽項目（S7-1 骨架；後續 Sprint 7-2+ 接 API）。 */

export type AdminRoute =
  | "dashboard"
  | "organization"
  | "sessions"
  | "audit"
  | "branding"
  | "exports";

export interface NavItem {
  id: AdminRoute;
  label: string;
  hash: string;
  description: string;
  sprint: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "總覽",
    hash: "#/dashboard",
    description: "組織活動概況與參與度分析",
    sprint: "S7-1",
  },
  {
    id: "organization",
    label: "組織設定",
    hash: "#/organization",
    description: "管理組織資料、成員與角色",
    sprint: "S7-2",
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
    label: "稽核紀錄",
    hash: "#/audit",
    description: "查詢敏感操作的稽核軌跡",
    sprint: "S7-3",
  },
  {
    id: "branding",
    label: "品牌設定",
    hash: "#/branding",
    description: "Logo、主色與自訂網域",
    sprint: "S7-4",
  },
  {
    id: "exports",
    label: "資料匯出",
    hash: "#/exports",
    description: "XLSX/CSV 匯出與簽名下載連結",
    sprint: "S7-5",
  },
];
