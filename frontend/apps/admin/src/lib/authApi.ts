import { api } from "./api";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SsoConfig {
  enabled: boolean;
  provider: string;
  label: string;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  return api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function fetchSsoConfig(): Promise<SsoConfig> {
  return api<SsoConfig>("/api/v1/auth/sso/config");
}

export function ssoAuthorizeUrl(app: "host" | "admin" = "admin"): string {
  return `/api/v1/auth/sso/oidc/authorize?app=${app}`;
}

export async function exchangeSsoTicket(ticket: string): Promise<LoginResponse> {
  return api<LoginResponse>("/api/v1/auth/sso/exchange", {
    method: "POST",
    body: { ticket },
  });
}
