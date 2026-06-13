import { api } from "./api";

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
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
