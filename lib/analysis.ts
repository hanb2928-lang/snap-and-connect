import type { AnalysisResult } from '@/types/database';
import { supabase, ANALYSIS_FUNCTION_URL, TTS_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import { safeFetch } from '@/lib/apiClient';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { getUserSettings } from '@/lib/settings';
import { base64ToUint8Array, buildDataUrl } from '@/lib/base64';
import { enqueueAndWait } from '@/lib/jobQueue';

export async function uploadImage(
  base64: string,
  mimeType: string,
): Promise<string> {
  const uploadMime = mimeType || 'image/jpeg';
  const ext = uploadMime === 'image/png' ? 'png' : uploadMime === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('scans')
    .upload(fileName, base64ToUint8Array(base64), { contentType: uploadMime });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from('scans').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function analyzeImage(
  imageDataUrl: string,
  fileName: string,
  mimeType: string,
  mode: 'single' | 'multi' = 'multi',
): Promise<AnalysisResult> {
  const response = await safeFetch(ANALYSIS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ imageDataUrl, fileName, mimeType, mode }),
    timeoutMs: 60000,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI 분석 실패 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return normalizeAnalysis(data);
}

export async function analyzeMultiShot(
  base64Images: string[],
  fileName: string,
): Promise<AnalysisResult> {
  const dataUrls = base64Images.map((b64) => buildDataUrl(b64, 'image/jpeg'));

  const response = await safeFetch(ANALYSIS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ images: dataUrls, fileName, mode: 'multi-shot' }),
    timeoutMs: 90000,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI 다각도 분석 실패 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return normalizeAnalysis(data);
}

function normalizeAnalysis(data: Record<string, unknown>): AnalysisResult {
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
  };
}

export async function saveScan(
  imageUrl: string,
  analysis: AnalysisResult,
  additionalImageUrls: string[] = [],
  scanSource: 'single' | 'multi' | 'template' = 'single',
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
  };

  if (additionalImageUrls.length > 0) {
    scanPayload.additional_image_urls = additionalImageUrls;
  }

  const { data, error } = await supabase
    .from('scans')
    .insert(scanPayload)
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save scan: ${error.message}`);

  const hookText = analysis.templateData?.hook || analysis.oneLiner || '';
  if (hookText) {
    generateAndUploadTTS(data.id, hookText).catch(() => {});
  }

  return data.id;
}

async function generateAndUploadTTS(scanId: string, text: string): Promise<void> {
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
  const timeoutId = setTimeout(() => controller.abort(), 15000);
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
  const fileName = `tts-${scanId}-${Date.now()}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from('scans')
    .upload(fileName, audioBytes, { contentType: 'audio/mpeg' });
  if (uploadError) return;

  const { data: urlData } = supabase.storage.from('scans').getPublicUrl(fileName);
  if (!urlData.publicUrl) return;

  await supabase.from('scans').update({ tts_url: urlData.publicUrl }).eq('id', scanId);
}

export async function saveManualScan(
  imageUrl: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('scans')
    .insert({
      image_url: imageUrl,
      scan_source: 'template',
      title: '직접 만든 템플릿',
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
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save scan: ${error.message}`);
  return data.id;
}

export async function deleteScan(id: string): Promise<void> {
  const { error } = await supabase.from('scans').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete: ${error.message}`);
}

export async function analyzeImageQueued(
  imageDataUrl: string,
  fileName: string,
  mimeType: string,
  mode: 'single' | 'multi' = 'multi',
  preferredStyle?: string,
): Promise<AnalysisResult> {
  const result = await enqueueAndWait<Record<string, unknown>>(
    'analyze-photo',
    { imageDataUrl, fileName, mimeType, mode, ...(preferredStyle ? { preferredStyle } : {}) },
    { timeoutMs: 180000 },
  );

  if (!result.success || !result.result) {
    throw new Error(result.error ?? 'AI 분석 작업이 실패했습니다.');
  }
  return normalizeAnalysis(result.result);
}

export async function analyzeMultiShotQueued(
  base64Images: string[],
  fileName: string,
): Promise<AnalysisResult> {
  const dataUrls = base64Images.map((b64) => buildDataUrl(b64, 'image/jpeg'));
  const result = await enqueueAndWait<Record<string, unknown>>(
    'analyze-photo',
    { images: dataUrls, fileName, mode: 'multi-shot' },
    { timeoutMs: 180000 },
  );

  if (!result.success || !result.result) {
    throw new Error(result.error ?? 'AI 다각도 분석 작업이 실패했습니다.');
  }
  return normalizeAnalysis(result.result);
}
