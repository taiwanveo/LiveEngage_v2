import { api } from "./api";
import type { LoginResponse } from "../types";

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  return api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
}
