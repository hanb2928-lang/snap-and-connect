import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Image as RNImage } from 'react-native';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { base64ToUint8Array, cleanBase64 } from '@/lib/base64';
import { safeFetch } from '@/lib/apiClient';

export async function rotateImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ rotate: 90 }]);
  return result.uri;
}

export async function flipImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ flip: ImageManipulator.FlipType.Horizontal }]);
  return result.uri;
}

export async function cropImage(
  uri: string,
  crop: { originX: number; originY: number; width: number; height: number },
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(uri, [
    {
      crop: {
        originX: Math.round(crop.originX),
        originY: Math.round(crop.originY),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      },
    },
  ]);
  return result.uri;
}

export async function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const img = new (global as unknown as { Image: typeof Image }).Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('이미지 크기를 불러올 수 없습니다'));
      img.src = uri;
    });
  }
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error('이미지 크기를 불러올 수 없습니다')),
    );
  });
}

export async function removeBackground(
  imageDataUrl: string,
  mimeType: string,
  userMaskDataUrl?: string,
): Promise<string> {
  const functionUrl = `${supabaseUrl}/functions/v1/remove-bg`;
  const response = await safeFetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ imageDataUrl, mimeType, userMaskDataUrl }),
    timeoutMs: 115000,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: '배경 제거 서버 오류가 발생했습니다.' }));
    throw new Error(errData.error || `배경 제거 실패 (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  if (data.imageUrl) {
    return data.imageUrl;
  }

  // Fallback for older deployments still returning base64
  const base64 = cleanBase64(data.imageBase64);
  return `data:${data.mimeType || 'image/png'};base64,${base64}`;
}

function base64ToBlob(base64: string, mimeType: string): any {
  const bytes = base64ToUint8Array(base64);
  return new (global as any).Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
}

export async function compressImage(uri: string, maxWidth = 1080, quality = 0.8): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function compressImageToBase64(
  uri: string,
  maxDimension = 1080,
  quality = 0.7,
): Promise<{ base64: string; mimeType: string }> {
  const { width: origW, height: origH } = await getImageSize(uri);
  const longer = Math.max(origW, origH);
  const actions =
    longer > maxDimension
      ? origW >= origH
        ? [{ resize: { width: maxDimension } }]
        : [{ resize: { height: maxDimension } }]
      : [];
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, mimeType: 'image/jpeg' };
}

export async function uploadEditedImage(base64: string, mimeType: string): Promise<string> {
  const isPng = mimeType === 'image/png';
  const dataUrl = isPng ? `data:image/png;base64,${base64}` : `data:image/jpeg;base64,${base64}`;
  const compressedDataUrl = isPng ? await prepareImageForEdit(dataUrl, 1080) : await prepareImageForApi(dataUrl, 1080, 0.85);
  const compressedBase64 = cleanBase64(compressedDataUrl);
  const uploadMime = isPng ? 'image/png' : 'image/jpeg';
  const ext = isPng ? 'png' : 'jpg';

  const fileName = `edited-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const body = Platform.OS === 'web'
    ? base64ToBlob(compressedBase64, uploadMime)
    : base64ToUint8Array(compressedBase64);

  const { error } = await supabase.storage
    .from('scans')
    .upload(fileName, body, { contentType: uploadMime });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage.from('scans').getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function saveEditedScan(scanId: string, editedImageUrl: string): Promise<void> {
  const { error } = await supabase
    .from('scans')
    .update({ edited_image_url: editedImageUrl })
    .eq('id', scanId);

  if (error) throw new Error(`저장 실패: ${error.message}`);
}

export async function compositeOnBackground(
  productDataUrl: string,
  bgStyle: 'studio' | 'retail' | 'natural' | 'gradient' | 'none',
): Promise<string> {
  if (bgStyle === 'none') return productDataUrl;
  const bgUrl = `/bg-${bgStyle}.webp`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return compositeOnBackgroundWeb(productDataUrl, bgUrl);
  }

  return compositeOnBackgroundNative(productDataUrl, bgUrl);
}

async function compositeOnBackgroundWeb(productDataUrl: string, bgUrl: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다');

  const [bgImg, productImg] = await Promise.all([
    loadImageElement(bgUrl),
    loadImageElement(productDataUrl),
  ]);

  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  const pw = productImg.naturalWidth;
  const ph = productImg.naturalHeight;
  const scale = Math.min((canvas.width * 0.8) / pw, (canvas.height * 0.8) / ph);
  const dw = pw * scale;
  const dh = ph * scale;
  const dx = (canvas.width - dw) / 2;
  const dy = (canvas.height - dh) / 2;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(productImg, dx, dy, dw, dh);
  ctx.shadowColor = 'transparent';

  return canvas.toDataURL('image/png', 0.95);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
    img.src = src;
  });
}

async function compositeOnBackgroundNative(productDataUrl: string, _bgUrl: string): Promise<string> {
  return productDataUrl;
}

export async function prepareImageForApi(
  dataUrl: string,
  maxDimension = 1024,
  quality = 0.8,
): Promise<string> {
  const normalizedDataUrl = normalizeImageDataUrl(dataUrl);
  if (Platform.OS === 'web') {
    try {
      const img = await loadImageElement(normalizedDataUrl);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return normalizedDataUrl;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    } catch {
      return normalizedDataUrl;
    }
  }

  const { width: origW, height: origH } = await getImageSize(normalizedDataUrl);
  const longer = Math.max(origW, origH);
  const actions =
    longer > maxDimension
      ? origW >= origH
        ? [{ resize: { width: maxDimension } }]
        : [{ resize: { height: maxDimension } }]
      : [];
  const manipulated = await ImageManipulator.manipulateAsync(
    normalizedDataUrl,
    actions,
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
  );

  const fileInfo = await FileSystem.getInfoAsync(manipulated.uri);
  if (!fileInfo.exists) throw new Error('이미지 변환 실패');
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${base64}`;
}

export async function prepareImageForEdit(
  dataUrl: string,
  maxDimension = 1024,
): Promise<string> {
  const normalizedDataUrl = normalizeImageDataUrl(dataUrl);
  if (Platform.OS === 'web') {
    try {
      const img = await loadImageElement(normalizedDataUrl);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return normalizedDataUrl;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch {
      return normalizedDataUrl;
    }
  }

  const { width: origW, height: origH } = await getImageSize(normalizedDataUrl);
  const longer = Math.max(origW, origH);
  const actions =
    longer > maxDimension
      ? origW >= origH
        ? [{ resize: { width: maxDimension } }]
        : [{ resize: { height: maxDimension } }]
      : [];
  const manipulated = await ImageManipulator.manipulateAsync(
    normalizedDataUrl,
    actions,
    { compress: 1, format: ImageManipulator.SaveFormat.PNG },
  );

  const fileInfo = await FileSystem.getInfoAsync(manipulated.uri);
  if (!fileInfo.exists) throw new Error('이미지 변환 실패');
  const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/png;base64,${base64}`;
}

export function normalizeImageDataUrl(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return dataUrl;

  const header = dataUrl.slice(5, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
  if (!header.includes('base64') || !base64) return dataUrl;

  const declaredMime = header.split(';')[0];
  if (declaredMime.startsWith('image/')) return `data:${declaredMime};base64,${base64}`;

  const detectedMime = base64.startsWith('iVBORw0KGgo')
    ? 'image/png'
    : base64.startsWith('/9j/')
      ? 'image/jpeg'
      : base64.startsWith('R0lGOD')
        ? 'image/gif'
        : base64.startsWith('UklGR')
          ? 'image/webp'
          : null;

  return detectedMime ? `data:${detectedMime};base64,${base64}` : dataUrl;
}

export async function readUriAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(uri, { signal: controller.signal });
      if (!response.ok) throw new Error(`이미지 로드 실패 (${response.status})`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('이미지가 아닌 콘텐츠가 반환되었습니다');
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('이미지를 변환할 수 없습니다'));
        reader.readAsDataURL(blob);
      });
      const mimeType = dataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
      return { base64: cleanBase64(dataUrl), mimeType };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) throw new Error('파일을 찾을 수 없습니다');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  return { base64, mimeType };
}
