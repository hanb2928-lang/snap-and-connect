import type { AnalysisResult } from '@/types/database';
import { supabase, ANALYSIS_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { getUserSettings } from '@/lib/settings';
import { base64ToUint8Array, buildDataUrl } from '@/lib/base64';

export async function uploadImage(
  base64: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const fileName = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('scans')
    .upload(fileName, base64ToUint8Array(base64), { contentType: mimeType });

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(ANALYSIS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ imageDataUrl, fileName, mimeType, mode }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Analysis failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return normalizeAnalysis(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI 분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeMultiShot(
  base64Images: string[],
  fileName: string,
): Promise<AnalysisResult> {
  const images = base64Images.map((b64) => buildDataUrl(b64, 'image/jpeg'));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(ANALYSIS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ images, fileName, mode: 'multi-shot' }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Analysis failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return normalizeAnalysis(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI 다각도 분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
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
    },
    detectedProducts: Array.isArray(data.detectedProducts) ? data.detectedProducts : [],
  };
}

export async function saveScan(
  imageUrl: string,
  analysis: AnalysisResult,
  additionalImageUrls: string[] = [],
): Promise<string> {
  const settings = await getUserSettings();
  const affiliateLinks = generateAffiliateLinks(analysis, settings);

  const { data, error } = await supabase
    .from('scans')
    .insert({
      image_url: imageUrl,
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
      additional_image_urls: additionalImageUrls,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to save scan: ${error.message}`);
  return data.id;
}

export async function saveManualScan(
  imageUrl: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('scans')
    .insert({
      image_url: imageUrl,
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
