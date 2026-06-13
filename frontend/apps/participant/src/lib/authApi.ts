import { api } from "./api";

export interface SsoConfig {
  enabled: boolean;
  provider: string;
  label: string;
}

export interface SsoParticipantJoinResponse {
  participant_token: string;
  session_id: string;
  room_id: string;
  participant_id: string;
  display_name: string | null;
  email: string | null;
}

export async function fetchSsoConfig(): Promise<SsoConfig> {
  return api<SsoConfig>("/api/v1/auth/sso/config", { public: true });
}

export function ssoAuthorizeUrl(app: "participant", returnTo: string): string {
  return `/api/v1/auth/sso/oidc/authorize?app=${app}&return_to=${encodeURIComponent(returnTo)}`;
}

export async function joinWithSsoTicket(
  ticket: string,
  sessionId: string
): Promise<SsoParticipantJoinResponse> {
  return api<SsoParticipantJoinResponse>("/api/v1/auth/sso/participant-join", {
    method: "POST",
    public: true,
    body: { ticket, session_id: sessionId },
  });
}
