/** API client：participant bearer + 統一錯誤信封。 */

import { apiUrl, messageForFetchFailure, messageForHttpStatus } from "@liveengage/realtime";
import { getParticipantToken } from "./participantAuth";

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
  idempotencyKey?: string;
  /** 不需 token 的公開端點（by-code、join） */
  public?: boolean;
}

export async function api<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!options.public) {
    const token = getParticipantToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
    });
  } catch (err: unknown) {
    throw new ApiException(0, {
      code: "NETWORK_ERROR",
      message: messageForFetchFailure(err),
      details: {},
      request_id: "",
    });
  }

  if (!res.ok) {
    let payload: { error?: ApiError } = {};
    try {
      payload = (await res.json()) as { error?: ApiError };
    } catch {
      // 非 JSON
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

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
