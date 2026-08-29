import { supabase } from '@/lib/supabase';
import { buildCacheKey, contentHash } from '@/lib/hybridAiRouter';

export interface CacheEntry<T> {
  data: T;
  modelUsed: string;
  hitCount: number;
  cached: true;
}

const CACHE_TTL_DAYS = 30;

/**
 * Check the AI content cache for a matching entry.
 * Returns null on miss, error, or expired entry.
 */
export async function getCachedAiResult<T>(
  taskType: string,
  input: string,
  extra?: Record<string, string>,
): Promise<CacheEntry<T> | null> {
  try {
    const cacheKey = buildCacheKey(taskType, input, extra);
    const { data, error } = await supabase
      .from('ai_content_cache')
      .select('result, model_used, hit_count, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    // Check TTL
    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) return null;

    // Fire-and-forget: increment hit count
    supabase
      .from('ai_content_cache')
      .update({ hit_count: (data.hit_count ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('cache_key', cacheKey)
      .then(() => {});

    return {
      data: data.result as T,
      modelUsed: data.model_used,
      hitCount: (data.hit_count ?? 0) + 1,
      cached: true,
    };
  } catch {
    return null;
  }
}

/**
 * Store an AI-generated result in the cache for future hits.
 */
export async function setCachedAiResult<T>(
  taskType: string,
  input: string,
  result: T,
  modelUsed: string,
  extra?: Record<string, string>,
): Promise<void> {
  try {
    const cacheKey = buildCacheKey(taskType, input, extra);
    const inputHash = contentHash(input);
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('ai_content_cache')
      .upsert({
        cache_key: cacheKey,
        task_type: taskType,
        input_hash: inputHash,
        result: result as unknown as Record<string, unknown>,
        model_used: modelUsed,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
  } catch {
    // cache write failure is non-fatal
  }
}

/**
 * Clean up expired cache entries. Called periodically.
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('ai_content_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}
