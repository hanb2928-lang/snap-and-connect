import { Platform } from 'react-native';
import { supabase, supabaseUrl } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import type { SavedAsset } from '@/types/database';

const BUCKET = 'assets';

export async function uploadAssetBlob(
  blob: any,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  const path = `${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAssetBlobWithProgress(
  blob: Blob,
  fileName: string,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<string | null> {
  if (Platform.OS !== 'web') {
    onProgress(100);
    return uploadAssetBlob(blob, fileName, mimeType);
  }

  const path = `${fileName}`;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || '';

  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        resolve(data.publicUrl);
      } else {
        resolve(null);
      }
    };

    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);
    xhr.timeout = 120000;
    xhr.send(blob);
  });
}

export async function uploadAssetDataUrl(
  dataUrl: string,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return uploadAssetBlob(blob, fileName, mimeType);
  }

  {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return null;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) return null;

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, formData, { contentType: mimeType, upsert: true });

      if (error) return null;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      return data.publicUrl;
    } finally {
      await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    }
  }
}

export async function uploadAssetFromFileUri(
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, formData, { contentType: mimeType, upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

export async function saveAssetRecord(record: {
  scan_id: string | null;
  asset_type: 'image' | 'video';
  title: string;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  thumbnail_url?: string | null;
  platform?: string | null;
  affiliate_platform?: string | null;
}): Promise<SavedAsset | null> {
  const { data, error } = await supabase
    .from('saved_assets')
    .insert({
      ...record,
    })
    .select()
    .single();

  if (error) return null;
  return data as SavedAsset;
}

export async function fetchSavedAssets(): Promise<SavedAsset[]> {
  const { data, error } = await supabase
    .from('saved_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as SavedAsset[];
}

export async function deleteSavedAsset(asset: SavedAsset): Promise<boolean> {
  const { error: dbError } = await supabase.from('saved_assets').delete().eq('id', asset.id);
  if (dbError) return false;

  const filePath = `${asset.file_name}`;
  await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {});
  return true;
}

export async function updateAssetUploadStatus(
  assetId: string,
  uploadStatus: 'not_uploaded' | 'uploaded' | 'scheduled',
  shareUrl?: string | null,
): Promise<boolean> {
  const update: Record<string, unknown> = { upload_status: uploadStatus };
  if (shareUrl !== undefined) {
    update.share_url = shareUrl;
  }
  const { error } = await supabase
    .from('saved_assets')
    .update(update)
    .eq('id', assetId);
  return !error;
}
