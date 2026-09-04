import { apiUrl } from "@liveengage/realtime";
import { api } from "./api";
import type { LoginResponse } from "../types";

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

export function ssoAuthorizeUrl(app: "host" | "admin" = "host"): string {
  return apiUrl(`/api/v1/auth/sso/oidc/authorize?app=${app}`);
}

export async function exchangeSsoTicket(ticket: string): Promise<LoginResponse> {
  return api<LoginResponse>("/api/v1/auth/sso/exchange", {
    method: "POST",
    body: { ticket },
  });
}
