import { Platform } from 'react-native';

export interface PickedImage {
  base64: string;
  uri: string;
  mimeType: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
    reader.readAsDataURL(file);
  });
}

function resizeImage(file: File, maxSize = 1280, quality = 0.7): Promise<{ base64: string; uri: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('이미지 처리를 할 수 없습니다'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const isWebpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        const mimeType = isWebpSupported ? 'image/webp' : file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        resolve({ base64, uri: dataUrl, mimeType });
      };
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
    reader.readAsDataURL(file);
  });
}

export async function pickImageWeb(multiple = false, maxCount = 4): Promise<PickedImage[]> {
  return new Promise((resolve, reject) => {
    if (Platform.OS !== 'web') {
      reject(new Error('웹에서만 사용할 수 있는 기능입니다'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (multiple) {
      input.multiple = true;
    }

    let settled = false;
    const cleanup = () => {
      input.onchange = null;
      input.onerror = null;
      window.removeEventListener('focus', onFocus);
    };
    const onFocus = () => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          settled = true;
          cleanup();
          resolve([]);
        }
      }, 500);
    };

    input.onchange = async () => {
      settled = true;
      cleanup();
      const files = Array.from(input.files || []);
      if (files.length === 0) {
        resolve([]);
        return;
      }
      try {
        const limited = files.slice(0, multiple ? maxCount : 1);
        const results = await Promise.all(
          limited.map((f) => resizeImage(f)),
        );
        resolve(results);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('이미지 선택에 실패했습니다'));
      }
    };
    input.onerror = () => {
      settled = true;
      cleanup();
      reject(new Error('파일 선택창을 열 수 없습니다'));
    };

    setTimeout(() => {
      window.addEventListener('focus', onFocus);
    }, 300);

    input.click();
  });
}

export function isWebPlatform(): boolean {
  return Platform.OS === 'web';
}
