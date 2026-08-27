import { supabaseAnonKey } from '@/lib/supabase';

interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 800;

function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('abort');
  }
  return false;
}

function backoffDelay(attempt: number): number {
  return BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 200;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 60000, retries = MAX_RETRIES, ...fetchOptions } = options;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = {
        ...fetchOptions.headers,
        apikey: supabaseAnonKey,
      };

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new ApiError('인증이 만료되었습니다. 앱을 새로고침하고 다시 시도해주세요.', response.status);
      }

      if (response.status === 429) {
        if (attempt < retries) {
          lastError = new ApiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', response.status);
          await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
          continue;
        }
        throw new ApiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', response.status);
      }

      if (response.status >= 500) {
        if (attempt < retries) {
          lastError = new ApiError('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.', response.status);
          await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
          continue;
        }
        throw new ApiError('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.', response.status);
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))) {
        lastError = new ApiError('요청 시간이 초과되었습니다. 네트워크 환경을 확인 후 다시 시도해주세요.', 408);
      } else if (err instanceof ApiError) {
        lastError = err;
      } else {
        lastError = err;
      }

      if (attempt < retries && isRetryableError(lastError)) {
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('요청에 실패했습니다.');
}

export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: { message: string } | null }>,
  retries = 1,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await operation();
      if (result.error) {
        const msg = result.error.message;
        if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth')) {
          throw new ApiError('인증 세션이 만료되었습니다. 앱을 새로고침해주세요.', 401);
        }
        throw new Error(msg);
      }
      return result.data as T;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError) throw err;

      const isNetwork = err instanceof Error && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('network') ||
        err.message.includes('abort')
      );

      if (isNetwork && attempt < retries) {
        await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * Math.pow(2, attempt)));
        continue;
      }

      if (isNetwork) {
        throw new ApiError('네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.', 0);
      }
      throw err;
    }
  }

  throw lastError || new Error('작업에 실패했습니다.');
}

export function friendlyApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
