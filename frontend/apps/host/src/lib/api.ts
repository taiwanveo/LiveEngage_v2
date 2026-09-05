/** API client：JWT bearer + 401 自動 refresh + 統一錯誤信封解析。 */

import { apiUrl, getAiHeaders, messageForFetchFailure, messageForHttpStatus } from "@liveengage/realtime";
import {
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  setAuthTokens,
  clearAccessToken,
} from "./auth";

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  request_id: string;
}

export class ApiException extends Error {
  status: number;
  error: ApiError;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  _retried?: boolean;
}

const AUTH_NO_REFRESH = [
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/sso/config",
  "/api/v1/auth/sso/exchange",
];

function skipRefresh(path: string): boolean {
  return AUTH_NO_REFRESH.some((p) => path.startsWith(p));
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        clearAccessToken();
        return false;
      }
      const body = (await res.json()) as {
        access_token: string;
        refresh_token: string;
      };
      setAuthTokens(body.access_token, body.refresh_token);
      return true;
    } catch {
      clearAccessToken();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function resolveAccessToken(path: string): Promise<string | null> {
  let token = getAccessToken();
  if (!token || skipRefresh(path)) return token;

  if (!isAccessTokenExpired(token)) return token;

  const ok = await refreshAccessToken();
  return ok ? getAccessToken() : null;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const token = await resolveAccessToken(path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAiHeaders(),
    ...(options.headers ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const requestBody =
    options.body === undefined || options.body === null
      ? null
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: requestBody,
    });
  } catch (err: unknown) {
    throw new ApiException(0, {
      code: "NETWORK_ERROR",
      message: messageForFetchFailure(err),
      details: {},
      request_id: "",
    });
  }

  if (
    res.status === 401 &&
    !skipRefresh(path) &&
    !options._retried &&
    getRefreshToken()
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return api<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    let payload: { error?: ApiError } = {};
    try {
      payload = (await res.json()) as { error?: ApiError };
    } catch {
      // 非 JSON 回應
    }
    const err: ApiError = payload.error ?? {
      code: "INTERNAL",
      message: messageForHttpStatus(res.status),
      details: {},
      request_id: "",
    };
    throw new ApiException(res.status, err);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** 產生 idempotency key（隨機 UUID）。 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
