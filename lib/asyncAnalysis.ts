import type { AnalysisResult } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { enqueueJob } from '@/lib/jobQueue';
import { uploadImage } from '@/lib/analysis';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { getUserSettings } from '@/lib/settings';
import { buildDataUrl } from '@/lib/base64';

const SUPABASE_TIMEOUT_MS = 30000;

function withSupabaseTimeout<T>(
  operation: () => Promise<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<{ data: T | null; error: { message: string } | null }> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<{ data: null; error: { message: string } }>(
    (resolve) => {
      timer = setTimeout(
        () => resolve({ data: null, error: { message: `${label} 시간이 초과되었습니다.` } }),
        SUPABASE_TIMEOUT_MS,
      );
    },
  );
  return Promise.race([Promise.resolve(operation()), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Lightweight hash of image base64 for cache keying.
 * Uses a simple polynomial rolling hash — not cryptographic, just for dedup.
 */
function hashImage(base64: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const len = base64.length;
  // Sample to avoid hashing every char of a potentially huge string
  const step = Math.max(1, Math.floor(len / 4096));
  for (let i = 0; i < len; i += step) {
    const ch = base64.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export interface AsyncAnalysisResult {
  scanId: string;
  jobId: string;
  cached: boolean;
}

/**
 * Non-blocking analysis flow:
 * 1. Upload image to storage
 * 2. Check analysis_cache by image hash — if hit, create scan with cached results immediately
 * 3. If cache miss, enqueue an analyze-photo job and create a pending scan row
 * 4. Return immediately with scanId + jobId — the result page subscribes to job realtime
 */
export async function startAsyncAnalysis(
  base64: string,
  mimeType: string,
  mode: 'single' | 'multi' = 'multi',
  additionalBase64Images: string[] = [],
  preferredStyle?: string,
): Promise<AsyncAnalysisResult> {
  const fileName = `scan-${Date.now()}`;
  const imageHash = hashImage(base64);

  // Check cache BEFORE uploading to skip storage entirely on a hit
  const cacheResult = await withSupabaseTimeout(
    () => Promise.resolve(supabase
      .from('analysis_cache')
      .select('analysis_result')
      .eq('image_hash', imageHash)
      .maybeSingle()),
    '캐시 조회',
  );
  const cached = cacheResult.data as { analysis_result: unknown } | null;

  if (cached?.analysis_result) {
    // Cache hit — upload image for the scan record, then create scan with full data
    const imageUrl = await uploadImage(base64, mimeType);
    const analysis = cached.analysis_result as unknown as AnalysisResult;
    const scanId = await createScanWithAnalysis(imageUrl, analysis, [], mode, imageHash);

    // Bump hit count (fire-and-forget)
    supabase.rpc('increment_analysis_cache_hit', { p_hash: imageHash }).then(() => {}, () => {});

    return { scanId, jobId: '', cached: true };
  }

  // Cache miss — upload image and additional angles
  const imageUrl = await uploadImage(base64, mimeType);

  const additionalUrls: string[] = [];
  for (const b64 of additionalBase64Images) {
    try {
      const url = await uploadImage(b64, 'image/jpeg');
      additionalUrls.push(url);
    } catch {
      // individual angle upload failure shouldn't block
    }
  }

  // Cache miss — enqueue job and create pending scan
  const payload =
    additionalBase64Images.length > 0
      ? {
          images: [buildDataUrl(base64, mimeType), ...additionalBase64Images.map((b) => buildDataUrl(b, 'image/jpeg'))],
          fileName,
          mode: 'multi-shot',
          ...(preferredStyle ? { preferredStyle } : {}),
        }
      : {
          imageDataUrl: buildDataUrl(base64, mimeType),
          fileName,
          mimeType,
          mode,
          ...(preferredStyle ? { preferredStyle } : {}),
        };

  const jobId = await enqueueJob('analyze-photo', payload, {
    priority: 3,
  });

  const scanId = await createPendingScan(imageUrl, jobId, additionalUrls, mode, imageHash);

  return { scanId, jobId, cached: false };
}

async function createPendingScan(
  imageUrl: string,
  jobId: string,
  additionalUrls: string[],
  scanSource: 'single' | 'multi',
  imageHash: string,
): Promise<string> {
  const scanPayload: Record<string, unknown> = {
    image_url: imageUrl,
    scan_source: scanSource,
    title: 'AI 분석 중...',
    summary: '',
    contacts: [],
    tags: [],
    product_name: '',
    product_category: '',
    price_estimate: '',
    one_liner: '',
    shopping_matches: [],
    affiliate_links: [],
    template_data: {
      priceLabel: '',
      oneLiner: '',
      category: '',
      accentColor: '#2f9dff',
      hook: '',
      hashtags: [],
      productAdvantages: [],
      caption: '',
    },
    detected_products: [],
    analysis_job_id: jobId,
    image_hash: imageHash,
  };

  if (additionalUrls.length > 0) {
    scanPayload.additional_image_urls = additionalUrls;
  }

  const insertResult = await withSupabaseTimeout<{ id: string }>(
    () => Promise.resolve(supabase
      .from('scans')
      .insert(scanPayload)
      .select('id')
      .single()),
    '스캔 생성',
  );
  const { data, error } = insertResult;

  if (error || !data) throw new Error(`스캔 생성 실패: ${error?.message || '알 수 없는 오류'}`);
  return data.id;
}

async function createScanWithAnalysis(
  imageUrl: string,
  analysis: AnalysisResult,
  additionalUrls: string[],
  scanSource: 'single' | 'multi',
  imageHash: string,
): Promise<string> {
  const settings = await getUserSettings();
  const affiliateLinks = generateAffiliateLinks(analysis, settings);

  const scanPayload: Record<string, unknown> = {
    image_url: imageUrl,
    scan_source: scanSource,
    title: analysis.title,
    summary: analysis.summary,
    contacts: analysis.contacts,
    tags: analysis.tags,
    product_name: analysis.productName,
    product_category: analysis.productCategory,
    price_estimate: analysis.priceEstimate,
    one_liner: analysis.oneLiner,
    shopping_matches: analysis.shoppingMatches,
    affiliate_links: affiliateLinks,
    template_data: analysis.templateData,
    detected_products: analysis.detectedProducts,
    image_hash: imageHash,
    hybrid_mapping: analysis.hybridMapping ?? null,
  };

  if (additionalUrls.length > 0) {
    scanPayload.additional_image_urls = additionalUrls;
  }

  const insertResult = await withSupabaseTimeout<{ id: string }>(
    () => Promise.resolve(supabase
      .from('scans')
      .insert(scanPayload)
      .select('id')
      .single()),
    '스캔 생성',
  );
  const { data, error } = insertResult;

  if (error || !data) throw new Error(`스캔 생성 실패: ${error?.message || '알 수 없는 오류'}`);

  // Kick off TTS in background (same as saveScan does)
  const hookText = analysis.templateData?.hook || analysis.oneLiner || '';
  if (hookText) {
    // Fire-and-forget TTS via direct fetch
    triggerTTS(data.id, hookText).catch(() => {});
  }

  return data.id;
}

export async function triggerTTS(scanId: string, text: string): Promise<void> {
  const { TTS_FUNCTION_URL, supabaseAnonKey } = await import('@/lib/supabase');
  const { base64ToUint8Array } = await import('@/lib/base64');
  let voice = 'alloy';
  let speed = 1.0;
  let pitch = 0;
  try {
    const settings = await getUserSettings();
    if (settings?.default_tts_voice) {
      const { getOpenAiVoiceParams } = await import('@/lib/ttsVoices');
      const params = getOpenAiVoiceParams(settings.default_tts_voice, settings.tts_speed);
      voice = params.voice;
      speed = params.speed;
    }
    if (settings?.tts_pitch != null) pitch = settings.tts_pitch;
  } catch {
    // use defaults
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 115000);
  const response = await fetch(TTS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ text, voice, speed, pitch }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!response.ok) return;
  const data = await response.json();
  if (!data.audioBase64) return;

  const audioBytes = base64ToUint8Array(data.audioBase64);
  const audioFileName = `tts-${scanId}-${Date.now()}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from('scans')
    .upload(audioFileName, audioBytes, { contentType: 'audio/mpeg' });
  if (uploadError) return;

  const { data: urlData } = supabase.storage.from('scans').getPublicUrl(audioFileName);
  if (!urlData.publicUrl) return;

  await supabase.from('scans').update({ tts_url: urlData.publicUrl }).eq('id', scanId);
}

/**
 * Called by the result page when a job completes via realtime.
 * Normalizes the job result, updates the scan row, and caches the analysis.
 */
export async function finalizeAnalysisFromJob(
  scanId: string,
  jobId: string,
  jobResult: Record<string, unknown>,
): Promise<void> {
  const analysis = normalizeJobResult(jobResult);
  const settings = await getUserSettings();
  const affiliateLinks = generateAffiliateLinks(analysis, settings);

  const { error } = await supabase.from('scans').update({
    title: analysis.title,
    summary: analysis.summary,
    contacts: analysis.contacts,
    tags: analysis.tags,
    product_name: analysis.productName,
    product_category: analysis.productCategory,
    price_estimate: analysis.priceEstimate,
    one_liner: analysis.oneLiner,
    shopping_matches: analysis.shoppingMatches,
    affiliate_links: affiliateLinks,
    template_data: analysis.templateData,
    detected_products: analysis.detectedProducts,
    analysis_job_id: null,
    hybrid_mapping: analysis.hybridMapping ?? null,
  }).eq('id', scanId);

  if (error) throw new Error(`스캔 업데이트 실패: ${error.message}`);

  // Cache the analysis for future hits (fire-and-forget)
  const { data: scan } = await supabase.from('scans').select('image_hash').eq('id', scanId).maybeSingle();
  if (scan?.image_hash) {
    supabase.from('analysis_cache').upsert({
      image_hash: scan.image_hash,
      analysis_result: analysis as unknown as Record<string, unknown>,
    }, { onConflict: 'image_hash' }).then(() => {}, () => {});
  }

  // Kick off TTS in background
  const hookText = analysis.templateData?.hook || analysis.oneLiner || '';
  if (hookText) {
    triggerTTS(scanId, hookText).catch(() => {});
  }
}

function normalizeJobResult(data: Record<string, unknown>): AnalysisResult {
  return {
    title: (data.title as string) || 'Product Captured',
    summary: (data.summary as string) || '',
    contacts: Array.isArray(data.contacts) ? data.contacts : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    productName: (data.productName as string) || '',
    productCategory: (data.productCategory as string) || 'product',
    priceEstimate: (data.priceEstimate as string) || '',
    oneLiner: (data.oneLiner as string) || '',
    shoppingMatches: Array.isArray(data.shoppingMatches) ? data.shoppingMatches : [],
    templateData: (data.templateData as AnalysisResult['templateData']) || {
      priceLabel: (data.priceEstimate as string) || '',
      oneLiner: (data.oneLiner as string) || '',
      category: (data.productCategory as string) || '',
      accentColor: '#2f9dff',
      hook: (data.hook as string) || '',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      productAdvantages: Array.isArray(data.productAdvantages) ? data.productAdvantages : [],
      caption: (data.caption as string) || '',
    },
    detectedProducts: Array.isArray(data.detectedProducts) ? data.detectedProducts : [],
    localStoreContext: (data.localStoreContext as AnalysisResult['localStoreContext']) ?? null,
    hybridMapping: (data.hybridMapping as AnalysisResult['hybridMapping']) ?? null,
  };
}
