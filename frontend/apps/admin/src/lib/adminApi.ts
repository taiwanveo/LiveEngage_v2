/** Admin API client（BE-008/009/010）。 */

import { api } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgData {
  id: string;
  name: string;
  plan: string | null;
  settings_jsonb: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MemberData {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "host" | "member" | "cohost" | "guest";
  created_at: string;
}

export interface AdminSessionData {
  id: string;
  org_id: string;
  host_user_id: string;
  title: string;
  code: string;
  status: "draft" | "live" | "ended" | "archived";
  visibility: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface PaginatedSessions {
  items: AdminSessionData[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditLogData {
  id: string;
  org_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  session_id: string | null;
  room_id: string | null;
  target_type: string;
  target_id: string | null;
  action: string;
  details_jsonb: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogData[];
  total: number;
  page: number;
  page_size: number;
}

// ── Organization ─────────────────────────────────────────────────────────────

export const getOrganization = (): Promise<OrgData> =>
  api<OrgData>("/api/v1/admin/organization");

export const updateOrganization = (payload: {
  name?: string;
  plan?: string;
  settings_jsonb?: Record<string, unknown>;
}): Promise<OrgData> =>
  api<OrgData>("/api/v1/admin/organization", { method: "PATCH", body: payload });

// ── Members ───────────────────────────────────────────────────────────────────

export const listMembers = (): Promise<MemberData[]> =>
  api<MemberData[]>("/api/v1/admin/members");

export const inviteMember = (payload: {
  email: string;
  name?: string;
  role: string;
  password: string;
}): Promise<MemberData> =>
  api<MemberData>("/api/v1/admin/members", { method: "POST", body: payload });

export const updateMemberRole = (
  userId: string,
  role: string
): Promise<MemberData> =>
  api<MemberData>(`/api/v1/admin/members/${userId}`, {
    method: "PATCH",
    body: { role },
  });

export const removeMember = (userId: string): Promise<void> =>
  api<void>(`/api/v1/admin/members/${userId}`, { method: "DELETE" });

// ── Sessions ──────────────────────────────────────────────────────────────────

export interface ListSessionsParams {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const listAdminSessions = (
  params: ListSessionsParams = {}
): Promise<PaginatedSessions> => {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  if (params.page_size) qs.set("page_size", String(params.page_size));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return api<PaginatedSessions>(`/api/v1/admin/sessions${query}`);
};

export const archiveSession = (sessionId: string): Promise<AdminSessionData> =>
  api<AdminSessionData>(`/api/v1/admin/sessions/${sessionId}`, {
    method: "PATCH",
    body: { status: "archived" },
  });

// ── Audit Logs ────────────────────────────────────────────────────────────────

export interface ListAuditLogsParams {
  action?: string;
  actor_user_id?: string;
  session_id?: string;
  target_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export const listAuditLogs = (
  params: ListAuditLogsParams = {}
): Promise<PaginatedAuditLogs> => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return api<PaginatedAuditLogs>(`/api/v1/admin/audit-logs${query}`);
};

// ── Branding（S7-4）──────────────────────────────────────────────────────────

export interface BrandingData {
  org_id: string;
  branding: {
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    custom_domain: string | null;
    display_name: string | null;
  };
}

export const getBranding = (): Promise<BrandingData> =>
  api<BrandingData>("/api/v1/admin/branding");

export const updateBranding = (payload: Partial<BrandingData["branding"]>): Promise<BrandingData> =>
  api<BrandingData>("/api/v1/admin/branding", { method: "PATCH", body: payload });

// ── Exports（S7-5）───────────────────────────────────────────────────────────

export interface ExportJobData {
  id: string;
  session_id: string;
  format: "csv" | "xlsx";
  status: string;
  download_url: string | null;
  expires_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExportJobList {
  items: ExportJobData[];
  total: number;
}

export const listExports = (sessionId?: string): Promise<ExportJobList> => {
  const q = sessionId ? `?session_id=${sessionId}` : "";
  return api<ExportJobList>(`/api/v1/admin/exports${q}`);
};

export const createExport = (payload: {
  session_id: string;
  format: "csv" | "xlsx";
}): Promise<ExportJobData> =>
  api<ExportJobData>("/api/v1/admin/exports", { method: "POST", body: payload });

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AdminStatsOverview {
  sessions_total: number;
  sessions_live: number;
  participants_total: number;
  poll_responses_total: number;
  export_jobs_total: number;
  ai_requests_total: number;
}

export interface EngagementAnalytics {
  participants_total: number;
  participants_qa: number;
  participants_poll_voters: number;
  participants_engaged: number;
  engaged_score_percent: number;
  poll_votes_total: number;
  qa_questions_total: number;
}

export const getStatsOverview = (): Promise<AdminStatsOverview> =>
  api<AdminStatsOverview>("/api/v1/admin/stats/overview");

export const getEngagementAnalytics = (): Promise<EngagementAnalytics> =>
  api<EngagementAnalytics>("/api/v1/admin/analytics/engagement");

// ── Integrations ──────────────────────────────────────────────────────────────

export interface WebhookData {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  created_at: string;
}

export const listWebhooks = (): Promise<{ items: WebhookData[] }> =>
  api<{ items: WebhookData[] }>("/api/v1/admin/integrations/webhooks");

export const createWebhook = (payload: {
  url: string;
  events?: string[];
}): Promise<WebhookData> =>
  api<WebhookData>("/api/v1/admin/integrations/webhooks", {
    method: "POST",
    body: payload,
  });
