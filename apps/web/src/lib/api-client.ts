import type { ApiResponse } from '@inkflow/shared-types';

/**
 * Base URL resolution:
 * - Server Components: use API_URL env var (docker network or localhost)
 * - Client Components: use NEXT_PUBLIC_API_URL env var
 */
function getBaseUrl(): string {
  // Server-side (Node.js process)
  if (typeof window === 'undefined') {
    return process.env.API_URL ?? 'http://localhost:3000';
  }
  // Client-side (browser)
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

type RequestOptions = {
  token?: string;
  revalidate?: number | false;
  tags?: string[];
};

type FetchOptions = RequestOptions & {
  method: string;
  body?: unknown;
};

class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, options: FetchOptions): Promise<T> {
  const { method, body, token, revalidate, tags } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
    method,
    headers,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Next.js ISR / cache options (server-side only)
  if (revalidate !== undefined || tags !== undefined) {
    fetchOptions.next = {};
    if (revalidate !== undefined) fetchOptions.next.revalidate = revalidate;
    if (tags !== undefined) fetchOptions.next.tags = tags;
  }

  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, fetchOptions);

  // Handle non-JSON responses (e.g. 204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  const json: ApiResponse<T> = await response.json();

  if (!json.success) {
    throw new ApiClientError(
      json.error.code,
      json.error.message,
      response.status,
      json.error.details,
    );
  }

  return json.data;
}

export const apiClient = {
  /**
   * GET request.
   * On the server, pass `revalidate` (seconds) for ISR caching.
   */
  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>(path, { method: 'GET', ...options });
  },

  /**
   * POST request.
   */
  post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>(path, { method: 'POST', body, ...options });
  },

  /**
   * PATCH request.
   */
  patch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>(path, { method: 'PATCH', body, ...options });
  },

  /**
   * DELETE request.
   */
  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>(path, { method: 'DELETE', ...options });
  },
};

export { ApiClientError };
export type { RequestOptions };
