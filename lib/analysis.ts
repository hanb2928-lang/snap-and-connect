import type { AnalysisResult } from '@/types/database';
import { supabase, ANALYSIS_FUNCTION_URL, TTS_FUNCTION_URL, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { safeFetch } from '@/lib/apiClient';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { getUserSettings } from '@/lib/settings';
import { base64ToUint8Array, buildDataUrl } from '@/lib/base64';
import { enqueueAndWait } from '@/lib/jobQueue';
import { deductCredits } from '@/lib/credits';

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
  await deductCredits('photo_analysis');

  const response = await safeFetch(ANALYSIS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ imageDataUrl, fileName, mimeType, mode }),
    timeoutMs: 115000,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'AI 분석 서버 오류가 발생했습니다.' }));
    throw new Error(errData.error || `AI 분석 실패 (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return normalizeAnalysis(data);
}

export async function analyzeMultiShot(
  base64Images: string[],
  fileName: string,
): Promise<AnalysisResult> {
  await deductCredits('multi_shot_analysis');

  const dataUrls = base64Images.map((b64) => buildDataUrl(b64, 'image/jpeg'));

  const response = await safeFetch(ANALYSIS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ images: dataUrls, fileName, mode: 'multi-shot' }),
    timeoutMs: 115000,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'AI 다각도 분석 서버 오류가 발생했습니다.' }));
    throw new Error(errData.error || `AI 다각도 분석 실패 (${response.status})`);
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

function trimText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

export async function updateScanWithAnalysis(
  scanId: string,
  analysis: AnalysisResult,
): Promise<void> {
  const settings = await getUserSettings();
  const affiliateLinks = generateAffiliateLinks(analysis, settings);

  const td = analysis.templateData;
  const cleanTemplateData = td ? {
    priceLabel: td.priceLabel,
    oneLiner: trimText(td.oneLiner, 80),
    category: td.category,
    accentColor: td.accentColor,
    hook: trimText(td.hook, 60),
    hashtags: (td.hashtags || []).slice(0, 8),
    productAdvantages: (td.productAdvantages || []).slice(0, 3).map((a) => trimText(a, 60)),
    caption: trimText(td.caption, 120),
    ...(td.platformVariants ? { platformVariants: td.platformVariants } : {}),
  } : undefined;

  const { error } = await supabase.from('scans').update({
    title: trimText(analysis.title, 40),
    summary: trimText(analysis.summary, 200),
    contacts: analysis.contacts,
    tags: (analysis.tags || []).slice(0, 8),
    product_name: analysis.productName,
    product_category: analysis.productCategory,
    price_estimate: analysis.priceEstimate,
    one_liner: trimText(analysis.oneLiner, 80),
    shopping_matches: analysis.shoppingMatches,
    affiliate_links: affiliateLinks,
    ...(cleanTemplateData ? { template_data: cleanTemplateData } : {}),
    detected_products: analysis.detectedProducts,
    scan_source: 'single',
  }).eq('id', scanId);

  if (error) throw new Error(`Failed to update scan: ${error.message}`);

  const hookText = td?.hook || analysis.oneLiner || '';
  if (hookText) {
    generateAndUploadTTS(scanId, hookText).catch(() => {});
  }
}

export async function analyzeImageWithProductContext(
  imageDataUrl: string,
  fileName: string,
  mimeType: string,
  mode: 'single' | 'multi' = 'multi',
  productContext?: { productName?: string; description?: string; price?: string; brand?: string; platform?: string },
): Promise<AnalysisResult> {
  await deductCredits('photo_analysis');

  const response = await safeFetch(ANALYSIS_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ imageDataUrl, fileName, mimeType, mode, productContext }),
    timeoutMs: 115000,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'AI 분석 서버 오류가 발생했습니다.' }));
    throw new Error(errData.error || `AI 분석 실패 (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return normalizeAnalysis(data);
}

export async function extractProductMeta(
  url: string,
): Promise<{
  productName: string;
  description: string;
  price: string;
  currency: string;
  image: string;
  imageBase64: string;
  imageMimeType: string;
  platform: string;
  brand: string;
  availability: string;
  searchUrl: string;
  productId: string;
  extractionMethod: string;
}> {
  const extractUrl = `${supabaseUrl}/functions/v1/extract-product-meta`;
  const response = await safeFetch(extractUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ url }),
    timeoutMs: 115000,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: '상품 정보 추출 서버 오류가 발생했습니다.' }));
    throw new Error(errData.error || `상품 정보 추출 실패 (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.productMeta;
}

export async function analyzeImageQueued(
  imageDataUrl: string,
  fileName: string,
  mimeType: string,
  mode: 'single' | 'multi' = 'multi',
  preferredStyle?: string,
): Promise<AnalysisResult> {
  await deductCredits('photo_analysis');

  const result = await enqueueAndWait<Record<string, unknown>>(
    'analyze-photo',
    { imageDataUrl, fileName, mimeType, mode, ...(preferredStyle ? { preferredStyle } : {}) },
    { timeoutMs: 115000 },
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
  await deductCredits('multi_shot_analysis');

  const dataUrls = base64Images.map((b64) => buildDataUrl(b64, 'image/jpeg'));
  const result = await enqueueAndWait<Record<string, unknown>>(
    'analyze-photo',
    { images: dataUrls, fileName, mode: 'multi-shot' },
    { timeoutMs: 115000 },
  );

  if (!result.success || !result.result) {
    throw new Error(result.error ?? 'AI 다각도 분석 작업이 실패했습니다.');
  }
  return normalizeAnalysis(result.result);
}
