import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Image as RNImage } from 'react-native';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { base64ToUint8Array, cleanBase64 } from '@/lib/base64';

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
): Promise<string> {
  const functionUrl = `${supabaseUrl}/functions/v1/remove-bg`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ imageDataUrl, mimeType }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`배경 제거 실패 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  const base64 = cleanBase64(data.imageBase64);
  const dataUrl = `data:${data.mimeType || 'image/png'};base64,${base64}`;
  return dataUrl;
}

function base64ToBlob(base64: string, mimeType: string): any {
  const bytes = base64ToUint8Array(base64);
  return new (global as any).Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
}

export async function compressImage(uri: string, maxWidth = 1280): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function uploadEditedImage(base64: string, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const fileName = `edited-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const body = Platform.OS === 'web'
    ? base64ToBlob(base64, mimeType)
    : base64ToUint8Array(base64);

  const { error } = await supabase.storage
    .from('scans')
    .upload(fileName, body, { contentType: mimeType });

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

export async function readUriAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('이미지를 변환할 수 없습니다'));
      reader.readAsDataURL(blob);
    });
    const mimeType = dataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
    return { base64: cleanBase64(dataUrl), mimeType };
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
