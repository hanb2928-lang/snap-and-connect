import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Scissors,
  Type,
  Sticker,
  Check,
  X,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '@/hooks/useSafeTop';
import {
  getImageSize,
  removeBackground,
  uploadEditedImage,
  saveEditedScan,
  readUriAsBase64,
  compressImage,
  compositeOnBackground,
} from '@/lib/imageEdit';
import { BackgroundPicker, type BackgroundStyle } from '@/components/BackgroundPicker';
import { BgRemoveEditor } from '@/components/BgRemoveEditor';
import { removeBackgroundOnDevice } from '@/lib/removeBgOnDevice';
import { cleanBase64 } from '@/lib/base64';
import { getHtml2Canvas } from '@/lib/html2canvas';
import { captureRef } from 'react-native-view-shot';
import type { Scan } from '@/types/database';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type EditMode = 'none' | 'text' | 'sticker';

interface TextOverlay {
  id: string;
  text: string;
  color: string;
  fontSize: number;
}

const STICKER_EMOJIS = ['🔥', '✨', '💯', '👍', '❤️', '🛒', '💰', '🚀', '😍', '⭐'];

const STICKER_DISPLAY_SIZE = 44;
const STICKER_RENDER_SIZE = 88;

function emojiToDataUrl(emoji: string, size: number): string {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.font = `${Math.round(size * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  return canvas.toDataURL('image/png');
}


export default function EditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUri, setImageUri] = useState<string>('');
  const [originalUri, setOriginalUri] = useState<string>('');
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [processing, setProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [bgPickerVisible, setBgPickerVisible] = useState(false);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgEditorVisible, setBgEditorVisible] = useState(false);
  const [bgEditorDataUrl, setBgEditorDataUrl] = useState('');
  const [bgEditorMask, setBgEditorMask] = useState<Uint8ClampedArray | null>(null);
  const undoStack = useRef<string[]>([]);
  const imageWrapRef = useRef<View | null>(null);

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [tempText, setTempText] = useState('');
  const [tempColor] = useState('#ffffff');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Sticker overlay state
  const [stickers, setStickers] = useState<string[]>([]);
  const [stickerDataUrls, setStickerDataUrls] = useState<Record<string, string>>({});
  const [stickerModalVisible, setStickerModalVisible] = useState(false);
  const [previewArea, setPreviewArea] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const maxDisplayWidth = previewArea.w > 0 ? previewArea.w - 32 : screenWidth - 32;
  const maxDisplayHeight = previewArea.h > 0 ? previewArea.h - 32 : screenHeight * 0.5;
  const aspect = imageSize.width && imageSize.height ? imageSize.width / imageSize.height : 1;
  const rawHeight = maxDisplayWidth / aspect;
  const imageDisplayWidth = rawHeight > maxDisplayHeight ? maxDisplayHeight * aspect : maxDisplayWidth;
  const imageDisplayHeight = imageDisplayWidth / aspect;

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('scans')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        if (!data) {
          setError('스캔을 찾을 수 없습니다');
          setLoading(false);
          return;
        }

        const scanData = data as Scan;
        setScan(scanData);
        const rawUri = scanData.edited_image_url || scanData.image_url;

        let uri = rawUri;
        if (Platform.OS === 'web' && !rawUri.startsWith('data:')) {
          try {
            const res = await fetch(rawUri, { mode: 'cors' });
            const blob = await res.blob();
            uri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
              reader.readAsDataURL(blob);
            });
          } catch {
            // fall back to raw URL
          }
        }

        setImageUri(uri);
        setOriginalUri(scanData.image_url);
        try {
          const size = await getImageSize(uri);
          setImageSize(size);
        } catch {
          // size detection will retry — use a safe default so layout doesn't jump
          setImageSize({ width: imageDisplayWidth, height: imageDisplayHeight });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다');
      } finally {
        // Small delay lets the Image component begin decoding before we reveal,
        // avoiding a flash of empty layout on native.
        setLoading(false);
      }
    })();
  }, [id]);

  // Reset is handled inline; no separate imageLoaded flag needed.

  const pushUndo = useCallback((uri: string) => {
    undoStack.current.push(uri);
    setCanUndo(undoStack.current.length > 0);
  }, []);

  const updateImage = useCallback((newUri: string) => {
    pushUndo(imageUri);
    setImageUri(newUri);
    setEditMode('none');
  }, [imageUri, pushUndo]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setImageUri(prev);
    setCanUndo(undoStack.current.length > 0);
  }, []);

  const handleQuickRemoveBg = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    setProgressText('온디바이스 배경 제거 중...');
    setEditMode('none');
    try {
      let dataUrl: string;
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const reader = new FileReader();
        dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('이미지를 변환할 수 없습니다'));
          reader.readAsDataURL(blob);
        });
      } else {
        const { base64, mimeType: detectedMime } = await readUriAsBase64(imageUri);
        dataUrl = `data:${detectedMime};base64,${base64}`;
      }

      const result = await removeBackgroundOnDevice(dataUrl);
      if (!result.ok) throw new Error(result.error);

      const base64 = cleanBase64(result.dataUrl);
      const newUri = await uploadEditedImage(base64, 'image/png');
      updateImage(newUri);
      setBgPickerVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배경 제거 실패');
    }
    setProcessing(false);
  }, [imageUri, processing, updateImage]);

  const handleRemoveBg = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    setProgressText('AI 1차 배경 제거 중...');
    setEditMode('none');
    try {
      let dataUrl: string;
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const reader = new FileReader();
        dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('이미지를 변환할 수 없습니다'));
          reader.readAsDataURL(blob);
        });
      } else {
        const { base64, mimeType: detectedMime } = await readUriAsBase64(imageUri);
        dataUrl = `data:${detectedMime};base64,${base64}`;
      }

      const mimeType = dataUrl.match(/^data:(image\/\w+);/)?.[1] || 'image/png';
      const editedDataUrl = await removeBackground(dataUrl, mimeType);

      // Get the edited image as a data URL for the editor
      let editorDataUrl: string;
      if (editedDataUrl.startsWith('http')) {
        // Fetch the uploaded image to get it as data URL for canvas
        if (Platform.OS === 'web') {
          const resp = await fetch(editedDataUrl);
          const blob = await resp.blob();
          editorDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
            reader.readAsDataURL(blob);
          });
        } else {
          editorDataUrl = editedDataUrl;
        }
      } else {
        editorDataUrl = editedDataUrl;
      }

      // Get image dimensions for the editor
      let editorImgW = imageDisplayWidth;
      let editorImgH = imageDisplayHeight;
      try {
        const size = await getImageSize(editorDataUrl);
        editorImgW = size.width;
        editorImgH = size.height;
      } catch {
        // use defaults
      }

      // On web, extract the alpha channel as the initial mask
      let initialMask: Uint8ClampedArray | null = null;
      if (Platform.OS === 'web' && editorDataUrl.startsWith('data:')) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('img load'));
            el.src = editorDataUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            initialMask = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
            editorImgW = img.naturalWidth;
            editorImgH = img.naturalHeight;
          }
        } catch {
          // skip mask extraction
        }
      }

      setBgEditorDataUrl(editorDataUrl);
      setBgEditorMask(initialMask);
      setBgEditorVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배경 제거 실패');
    }
    setProcessing(false);
  }, [imageUri, processing, updateImage, imageDisplayWidth, imageDisplayHeight]);

  const handleBgEditorConfirm = useCallback(async (resultDataUrl: string) => {
    setBgEditorVisible(false);
    if (!resultDataUrl) {
      // No user edit — use the AI result as-is (already in bgEditorDataUrl)
      const dataUrl = bgEditorDataUrl;
      try {
        let newUri: string;
        if (dataUrl.startsWith('http')) {
          newUri = dataUrl;
        } else {
          const base64 = cleanBase64(dataUrl);
          newUri = await uploadEditedImage(base64, 'image/png');
        }
        updateImage(newUri);
        setBgPickerVisible(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : '이미지 저장 실패');
      }
      return;
    }

    // User edited the mask — send to server with mask for final processing
    setProcessing(true);
    setProgressText('사용자 편집 적용 중...');
    try {
      const base64 = cleanBase64(resultDataUrl);
      const newUri = await uploadEditedImage(base64, 'image/png');
      updateImage(newUri);
      setBgPickerVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '편집 결과 저장 실패');
    }
    setProcessing(false);
  }, [bgEditorDataUrl, updateImage]);

  const handleBgEditorCancel = useCallback(() => {
    setBgEditorVisible(false);
  }, []);

  const handleBgSelect = useCallback(async (style: BackgroundStyle) => {
    if (bgProcessing) return;
    setBgProcessing(true);
    setError(null);
    try {
      let dataUrl: string;
      if (Platform.OS === 'web') {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const reader = new FileReader();
        dataUrl = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('이미지를 변환할 수 없습니다'));
          reader.readAsDataURL(blob);
        });
      } else {
        const { base64, mimeType: detectedMime } = await readUriAsBase64(imageUri);
        dataUrl = `data:${detectedMime};base64,${base64}`;
      }

      const compositeDataUrl = await compositeOnBackground(dataUrl, style);
      const compositeBase64 = cleanBase64(compositeDataUrl);
      const newUri = await uploadEditedImage(compositeBase64, 'image/png');
      updateImage(newUri);
      setBgPickerVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배경 합성 실패');
    }
    setBgProcessing(false);
  }, [imageUri, bgProcessing, updateImage]);

  const handleBgSkip = useCallback(() => {
    setBgPickerVisible(false);
  }, []);

  const handleAddText = useCallback(() => {
    setTempText('');
    setEditingTextId(null);
    setTextModalVisible(true);
  }, []);

  const handleEditText = useCallback((overlay: TextOverlay) => {
    setTempText(overlay.text);
    setEditingTextId(overlay.id);
    setTextModalVisible(true);
  }, []);

  const handleSaveText = useCallback(() => {
    if (!tempText.trim()) {
      setTextModalVisible(false);
      return;
    }
    if (editingTextId) {
      setTextOverlays((prev) =>
        prev.map((o) => (o.id === editingTextId ? { ...o, text: tempText, color: tempColor } : o)),
      );
    } else {
      const newOverlay: TextOverlay = {
        id: `text-${Date.now()}`,
        text: tempText,
        color: '#ffffff',
        fontSize: 24,
      };
      setTextOverlays((prev) => [...prev, newOverlay]);
    }
    setTextModalVisible(false);
    setTempText('');
    setEditingTextId(null);
  }, [tempText, editingTextId]);

  const handleDeleteText = useCallback((textId: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== textId));
  }, []);

  const handleAddSticker = useCallback((emoji: string) => {
    setStickers((prev) => [...prev, emoji]);
    setStickerModalVisible(false);
    // Pre-render emoji to a canvas image so html2canvas captures it on web
    if (Platform.OS === 'web') {
      setStickerDataUrls((prev) => {
        if (prev[emoji]) return prev;
        return { ...prev, [emoji]: emojiToDataUrl(emoji, STICKER_RENDER_SIZE) };
      });
    }
  }, []);

  const handleRemoveLastSticker = useCallback(() => {
    setStickers((prev) => prev.slice(0, -1));
  }, []);

  const performReset = useCallback(() => {
    undoStack.current = [];
    setCanUndo(false);
    setImageUri(originalUri);
    setTextOverlays([]);
    setStickers([]);
  }, [originalUri]);

  const handleReset = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('편집 내용을 버리고 원본 사진으로 돌아갈까요?')) {
        performReset();
      }
      return;
    }
    Alert.alert('원본으로 복원', '편집 내용을 버리고 원본 사진으로 돌아갈까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '복원',
        style: 'destructive',
        onPress: performReset,
      },
    ]);
  }, [performReset]);

  const handleSave = useCallback(async () => {
    if (!scan || processing) return;
    setProcessing(true);
    setError(null);
    setProgressText('저장 중...');
    try {
      let base64: string;
      let mimeType: string;

      const hasOverlays = textOverlays.length > 0 || stickers.length > 0;

      if (hasOverlays && imageWrapRef.current) {
        if (Platform.OS === 'web') {
          const el = imageWrapRef.current as unknown as HTMLElement;
          const html2canvas = await getHtml2Canvas();
          if (!html2canvas) throw new Error('이미지 캡처를 불러올 수 없습니다');
          const canvas = await html2canvas(el, {
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
          });
          const dataUrl = canvas.toDataURL('image/png', 1);
          mimeType = 'image/png';
          base64 = cleanBase64(dataUrl);
        } else {
          const capturedUri = await captureRef(imageWrapRef, {
            format: 'png',
            quality: 1,
            fileName: `${scan.id}-edited.png`,
          });
          const result = await readUriAsBase64(capturedUri);
          base64 = result.base64;
          mimeType = result.mimeType;
        }
      } else if (Platform.OS === 'web') {
        // imageUri is already a data URL on web
        mimeType = imageUri.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
        base64 = cleanBase64(imageUri);
      } else {
        const compressedUri = await compressImage(imageUri);
        const result = await readUriAsBase64(compressedUri);
        base64 = result.base64;
        mimeType = result.mimeType;
      }
      const uploadedUrl = await uploadEditedImage(base64, mimeType);
      await saveEditedScan(scan.id, uploadedUrl);
      setProcessing(false);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
      setProcessing(false);
    }
  }, [scan, imageUri, processing, router, textOverlays, stickers]);

  if (error && !scan && !loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={theme.colors.dark.text} strokeWidth={2} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: safeTop + 12 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>사진 편집</Text>
        <View style={styles.topActions}>
          {canUndo && (
            <TouchableOpacity style={styles.iconButton} onPress={handleUndo} activeOpacity={0.7}>
              <Undo2 size={18} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconButton} onPress={handleReset} activeOpacity={0.7}>
            <Trash2 size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.saveIconButton]}
            onPress={handleSave}
            disabled={processing}
            activeOpacity={0.7}
          >
            <Check size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewWrap} onLayout={(e) => setPreviewArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <View ref={imageWrapRef} style={[styles.imageWrap, { width: imageDisplayWidth, height: imageDisplayHeight }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              fadeDuration={Platform.OS === 'web' ? 0 : 300}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={styles.placeholderSpinner} />
            </View>
          )}

          {textOverlays.map((overlay) => (
            <TouchableOpacity
              key={overlay.id}
              style={[styles.textOverlay, { maxWidth: imageDisplayWidth * 0.8 }]}
              onPress={() => handleEditText(overlay)}
              onLongPress={() => handleDeleteText(overlay.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.overlayText, { color: overlay.color, fontSize: overlay.fontSize }]}
                numberOfLines={3}
              >
                {overlay.text}
              </Text>
            </TouchableOpacity>
          ))}

          {stickers.map((emoji, i) => {
            const maxLeft = Math.max(0, imageDisplayWidth - STICKER_DISPLAY_SIZE - 10);
            const maxTop = Math.max(0, imageDisplayHeight - STICKER_DISPLAY_SIZE - 10);
            const left = Math.min(20 + (i % 3) * 80, maxLeft);
            const top = Math.min(20 + Math.floor(i / 3) * 80, maxTop);
            return (
              <View
                key={`sticker-${i}`}
                style={[styles.stickerOverlay, { left, top }]}
              >
                {Platform.OS === 'web' && stickerDataUrls[emoji] ? (
                  <Image
                    source={{ uri: stickerDataUrls[emoji] }}
                    style={{ width: STICKER_DISPLAY_SIZE, height: STICKER_DISPLAY_SIZE }}
                  />
                ) : (
                  <Text style={styles.stickerText}>{emoji}</Text>
                )}
              </View>
            );
          })}

        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <X size={16} color={theme.colors.error[400]} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {editMode === 'none' && (
        <View style={[styles.toolBar, { paddingBottom: theme.spacing.md + insets.bottom }]}>
          <View style={styles.toolRow}>
            <ToolButton
              icon={<Zap size={18} color={theme.colors.warning[400]} strokeWidth={2} />}
              label="0.1초 누끼"
              onPress={handleQuickRemoveBg}
              disabled={processing}
              highlight
            />
            <ToolButton
              icon={<Scissors size={18} color={theme.colors.accent[400]} strokeWidth={2} />}
              label="AI 배경제거"
              onPress={handleRemoveBg}
              disabled={processing}
              highlight
            />
            <ToolButton
              icon={<Type size={18} color={theme.colors.warning[400]} strokeWidth={2} />}
              label="텍스트"
              onPress={handleAddText}
              disabled={processing}
            />
            <ToolButton
              icon={<Sticker size={18} color={theme.colors.success[400]} strokeWidth={2} />}
              label="스티커"
              onPress={() => setStickerModalVisible(true)}
              disabled={processing}
            />
          </View>
        </View>
      )}

      <BackgroundPicker
        visible={bgPickerVisible}
        onSelect={handleBgSelect}
        onSkip={handleBgSkip}
        processing={bgProcessing}
      />

      <BgRemoveEditor
        visible={bgEditorVisible}
        imageDataUrl={bgEditorDataUrl}
        initialMask={bgEditorMask}
        imageWidth={imageSize.width || imageDisplayWidth}
        imageHeight={imageSize.height || imageDisplayHeight}
        onConfirm={handleBgEditorConfirm}
        onCancel={handleBgEditorCancel}
      />

      {(textOverlays.length > 0 || stickers.length > 0) && editMode === 'none' && (
        <View style={styles.overlaySummary}>
          {textOverlays.length > 0 && (
            <Text style={styles.overlaySummaryText}>텍스트 {textOverlays.length}개</Text>
          )}
          {stickers.length > 0 && (
            <Text style={styles.overlaySummaryText}>스티커 {stickers.length}개</Text>
          )}
          {stickers.length > 0 && (
            <TouchableOpacity onPress={handleRemoveLastSticker} style={styles.removeLastBtn}>
              <X size={14} color={theme.colors.error[400]} strokeWidth={2} />
              <Text style={styles.removeLastText}>마지막 스티커 제거</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <View style={styles.processingSpinner} />
            <Text style={styles.processingTitle}>불러오는 중</Text>
            <Text style={styles.processingSubtext}>편집기를 준비하고 있습니다</Text>
          </View>
        </View>
      )}

      {processing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <View style={styles.processingSpinner} />
            <Text style={styles.processingTitle}>편집 중</Text>
            <Text style={styles.processingSubtext}>{progressText}</Text>
          </View>
        </View>
      )}

      {/* Text Edit Modal */}
      <Modal visible={textModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingTextId ? '텍스트 수정' : '텍스트 추가'}</Text>
            <TextInput
              style={styles.modalInput}
              value={tempText}
              onChangeText={setTempText}
              placeholder="여기에 텍스트 입력"
              placeholderTextColor={theme.colors.dark.textFaint}
              autoFocus
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setTextModalVisible(false); setTempText(''); setEditingTextId(null); }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveText}>
                <Text style={styles.modalSaveText}>{editingTextId ? '수정' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticker Picker Modal */}
      <Modal visible={stickerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.stickerModalCard}>
            <Text style={styles.modalTitle}>스티커 선택</Text>
            <View style={styles.stickerGrid}>
              {STICKER_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.stickerCell}
                  onPress={() => handleAddSticker(emoji)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.stickerCellText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setStickerModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  onPress,
  disabled,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.toolButton, highlight && styles.toolButtonHighlight]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.toolIconWrap}>{icon}</View>
      <Text style={styles.toolLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: theme.spacing.sm,
  },
  topTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveIconButton: {
    backgroundColor: theme.colors.primary[500],
  },
  previewWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  imageWrap: {
    position: 'relative',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.dark.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dark.surface,
  },
  placeholderSpinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: theme.colors.dark.border,
    borderTopColor: theme.colors.primary[400],
  },
  textOverlay: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(10, 15, 30, 0.15)',
  },
  overlayText: {
    fontFamily: theme.typography.fontFamily.bold,
    flexWrap: 'wrap',
  },
  stickerOverlay: {
    position: 'absolute',
  },
  stickerText: {
    fontSize: 40,
  },
  toolBar: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  toolButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  toolButtonHighlight: {},
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  overlaySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  overlaySummaryText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  removeLastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeLastText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.error[500] + '20',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  errorText: {
    flex: 1,
    color: theme.colors.error[400],
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
  },
  errorTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  backButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  processingSpinner: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    borderWidth: 4,
    borderColor: theme.colors.dark.border,
    borderTopColor: theme.colors.primary[400],
  },
  processingTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  processingSubtext: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  modalTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 80,
  },
  modalLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary[500],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  stickerModalCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  stickerCell: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerCellText: {
    fontSize: 32,
  },
});
