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
    description: "組織活動概況與快捷入口",
    sprint: "S7-1",
  },
  {
    id: "organization",
    label: "組織設定",
    hash: "#/organization",
    description: "BE-008：組織資料、成員與角色",
    sprint: "S7-2",
  },
  {
    id: "sessions",
    label: "活動管理",
    hash: "#/sessions",
    description: "BE-009：活動列表、狀態與封存",
    sprint: "S7-2",
  },
  {
    id: "audit",
    label: "稽核紀錄",
    hash: "#/audit",
    description: "BE-010：audit log 查詢與篩選",
    sprint: "S7-3",
  },
  {
    id: "branding",
    label: "品牌設定",
    hash: "#/branding",
    description: "Branding 基礎：Logo、主色、自訂網域",
    sprint: "S7-4",
  },
  {
    id: "exports",
    label: "資料匯出",
    hash: "#/exports",
    description: "BE-012：XLSX/CSV 匯出、72h 簽名連結",
    sprint: "S7-5",
  },
];
