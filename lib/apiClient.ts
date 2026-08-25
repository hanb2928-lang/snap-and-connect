import { supabaseAnonKey } from '@/lib/supabase';

interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
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
  const { timeoutMs = 60000, ...fetchOptions } = options;

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

    if (response.status === 401 || response.status === 403) {
      throw new ApiError('인증이 만료되었습니다. 앱을 새로고침하고 다시 시도해주세요.', response.status);
    }

    if (response.status === 429) {
      throw new ApiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', response.status);
    }

    if (response.status >= 500) {
      throw new ApiError('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.', response.status);
    }

    return response;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('요청 시간이 초과되었습니다. 네트워크 환경을 확인 후 다시 시도해주세요.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
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
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.message.includes('Failed to fetch')) {
      throw new ApiError('네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.', 0);
    }
    throw err;
  }
}

export function friendlyApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
