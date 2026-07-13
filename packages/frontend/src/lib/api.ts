import type { ApiErrorResponse } from '@rodinkal/shared';

const BASE = '/api';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(res.status, 'UNEXPECTED_RESPONSE', `Unexpected response: ${res.status}`);
  }

  const data = await res.json() as T | ApiErrorResponse;

  if (!res.ok) {
    const err = data as ApiErrorResponse;
    if (res.status === 401) {
      // Session expired — will be handled by auth hook
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.error ?? 'Unknown error', err.details);
  }

  return data as T;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // Don't set Content-Type — browser sets multipart boundary automatically
  });

  const data = await res.json() as T | ApiErrorResponse;
  if (!res.ok) {
    const err = data as ApiErrorResponse;
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.error ?? 'Upload failed');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};

export { ApiError };
