/** Screen API client（Bearer screen token）。 */

import { apiUrl, messageForFetchFailure, messageForHttpStatus } from "@liveengage/realtime";
import { getScreenToken } from "./screenAuth";

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
    const token = getScreenToken();
    if (!token) {
      throw new ApiException(401, {
        code: "UNAUTHENTICATED",
        message: "缺少 screen token",
        details: {},
        request_id: "",
      });
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new Error(messageForFetchFailure());
  }

  if (!res.ok) {
    let error: ApiError;
    try {
      const data = (await res.json()) as { error?: ApiError };
      error = data.error ?? {
        code: "HTTP_ERROR",
        message: messageForHttpStatus(res.status),
        details: {},
        request_id: "",
      };
    } catch {
      error = {
        code: "HTTP_ERROR",
        message: messageForHttpStatus(res.status),
        details: {},
        request_id: "",
      };
    }
    throw new ApiException(res.status, error);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
