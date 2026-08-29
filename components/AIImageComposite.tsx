import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  ViewStyle,
} from 'react-native';
import { Lightbulb, Check, Sun, Moon, Sparkles, Camera, Store, Palette, Upload, RefreshCw, CircleAlert as AlertCircle, Image as ImageIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import { theme } from '@/lib/theme';
import { friendlyError } from '@/lib/errors';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import * as ImagePicker from 'expo-image-picker';
import { prepareImageForApi } from '@/lib/imageEdit';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';

type CompositeMode = 'background' | 'lighting';
type LightingPreset = 'studio' | 'natural' | 'sunset' | 'cozy' | 'retail' | 'clean';
type BackgroundStyle = 'studio' | 'retail' | 'natural' | 'gradient';

type CompositeStep = 'idle' | 'source-ready' | 'processing' | 'done' | 'error';

const LIGHTING_PRESETS: {
  id: LightingPreset;
  label: string;
  desc: string;
  icon: typeof Sun;
  gradient: [string, string];
}[] = [
  { id: 'studio', label: '스튜디오', desc: '깔끔한 화이트, 부드러운 조명', icon: Camera, gradient: ['#f8f8f8', '#e0e0e0'] },
  { id: 'natural', label: '자연광', desc: '밝은 야외 자연 조명', icon: Sun, gradient: ['#e8f5e9', '#a5d6a7'] },
  { id: 'sunset', label: '선셋', desc: '따뜻한 황금빛 노을', icon: Palette, gradient: ['#fff3e0', '#ffcc80'] },
  { id: 'cozy', label: '감성', desc: '어두운 무드, 따뜻한 실내', icon: Moon, gradient: ['#3e2723', '#5d4037'] },
  { id: 'retail', label: '매장', desc: '쇼핑몰 디스플레이 느낌', icon: Store, gradient: ['#f5f5f5', '#cfd8dc'] },
  { id: 'clean', label: '클린', desc: '순수 백색 미니멀', icon: Sparkles, gradient: ['#ffffff', '#fafafa'] },
];

const BACKGROUND_PRESETS: {
  id: BackgroundStyle;
  label: string;
  desc: string;
  gradient: [string, string];
}[] = [
  { id: 'studio', label: '스튜디오', desc: '화이트 배경', gradient: ['#f8f8f8', '#e0e0e0'] },
  { id: 'retail', label: '매장', desc: '매장 분위기', gradient: ['#f5f5f5', '#cfd8dc'] },
  { id: 'natural', label: '자연광', desc: '야외 느낌', gradient: ['#e8f5e9', '#a5d6a7'] },
  { id: 'gradient', label: '그라디언트', desc: '감성 그라데이션', gradient: ['#e0f2f1', '#80cbc4'] },
];

interface AIImageCompositeProps {
  onResult?: (imageBase64: string, mimeType: string) => void;
}

export function AIImageComposite({ onResult }: AIImageCompositeProps) {
  const [step, setStep] = useState<CompositeStep>('idle');
  const [mode, setMode] = useState<CompositeMode>('lighting');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<LightingPreset | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundStyle | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileGradient, setMobileGradient] = useState<[string, string]>(['#ffffff', '#f0f0f0']);
  const compositeRef = useRef<View>(null);

  const handlePickSource = useCallback(async () => {
    setError(null);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) return;
        const compressed = await prepareImageForApi(
          buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType),
          1080,
          0.7,
        );
        setSourceImage(cleanBase64(compressed));
        setStep('source-ready');
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const compressed = await prepareImageForApi(result.assets[0].uri, 1080, 0.7);
        setSourceImage(cleanBase64(compressed));
        setStep('source-ready');
      }
      setResultImage(null);
      setSelectedPreset(null);
      setSelectedBackground(null);
    } catch (err) {
      setError(friendlyError(err, '이미지를 불러오지 못했습니다.'));
    }
  }, []);

  const handleComposite = useCallback(
    async (presetId: LightingPreset | BackgroundStyle) => {
      if (!sourceImage) return;
      setStep('processing');
      setError(null);
      setResultImage(null);

      try {
        let result: string | null = null;

        if (Platform.OS === 'web') {
          if (mode === 'lighting') {
            const preset = LIGHTING_PRESETS.find((p) => p.id === presetId);
            result = await compositeWithLightingWeb(
              buildDataUrl(sourceImage, 'image/jpeg'),
              presetId as LightingPreset,
              preset?.gradient ?? ['#ffffff', '#f0f0f0'],
            );
          } else {
            const bg = BACKGROUND_PRESETS.find((b) => b.id === presetId);
            result = await compositeWithBackgroundWeb(
              buildDataUrl(sourceImage, 'image/jpeg'),
              bg?.gradient ?? ['#ffffff', '#f0f0f0'],
            );
          }
        } else {
          const gradient: [string, string] =
            mode === 'lighting'
              ? (LIGHTING_PRESETS.find((p) => p.id === presetId)?.gradient ?? ['#ffffff', '#f0f0f0'])
              : (BACKGROUND_PRESETS.find((b) => b.id === presetId)?.gradient ?? ['#ffffff', '#f0f0f0']);
          setMobileGradient(gradient);
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!compositeRef.current) throw new Error('합성 뷰를 초기화하지 못했습니다.');
          const uri = await captureRef(compositeRef, {
            format: 'png',
            quality: 0.95,
            width: 1080,
            height: 1080,
          });
          result = buildDataUrl(cleanBase64(uri), 'image/png');
        }

        if (!result) throw new Error('합성 결과를 생성하지 못했습니다.');
        setResultImage(cleanBase64(result));
        setStep('done');

        if (onResult) {
          onResult(cleanBase64(result), 'image/png');
        }
      } catch (err) {
        setError(friendlyError(err, '이미지 합성에 실패했습니다.'));
        setStep('error');
      }
    },
    [sourceImage, mode, onResult, mobileGradient],
  );

  const handleReset = useCallback(() => {
    setStep('idle');
    setSourceImage(null);
    setResultImage(null);
    setSelectedPreset(null);
    setSelectedBackground(null);
    setError(null);
  }, []);

  const sourceDataUrl = sourceImage
    ? buildDataUrl(sourceImage, 'image/jpeg')
    : null;

  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'lighting' && styles.modeTabActive]}
          onPress={() => { setMode('lighting'); setResultImage(null); setSelectedPreset(null); }}
          activeOpacity={0.7}
        >
          <Lightbulb size={14} color={mode === 'lighting' ? theme.colors.accent[400] : theme.colors.dark.textFaint} strokeWidth={2} />
          <Text style={[styles.modeTabText, mode === 'lighting' && styles.modeTabTextActive]}>조명 스튜디오</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'background' && styles.modeTabActive]}
          onPress={() => { setMode('background'); setResultImage(null); setSelectedBackground(null); }}
          activeOpacity={0.7}
        >
          <ImageIcon size={14} color={mode === 'background' ? theme.colors.primary[400] : theme.colors.dark.textFaint} strokeWidth={2} />
          <Text style={[styles.modeTabText, mode === 'background' && styles.modeTabTextActive]}>배경 교체</Text>
        </TouchableOpacity>
      </View>

      {/* Source Upload */}
      {!sourceImage && step === 'idle' && (
        <TouchableOpacity style={styles.sourceUpload} onPress={handlePickSource} activeOpacity={0.7}>
          <View style={styles.sourceUploadIcon}>
            <Upload size={24} color={mode === 'lighting' ? theme.colors.accent[400] : theme.colors.primary[400]} strokeWidth={2} />
          </View>
          <Text style={styles.sourceUploadTitle}>원본 사진 올리기</Text>
          <Text style={styles.sourceUploadDesc}>
            촬영하거나 앨범에서 불러온 제품 사진을 업로드하세요
          </Text>
        </TouchableOpacity>
      )}

      {/* Source Preview + Change */}
      {sourceImage && (
        <View style={styles.sourcePreviewWrap}>
          <Image source={{ uri: sourceDataUrl! }} style={styles.sourcePreview} resizeMode="contain" />
          <TouchableOpacity style={styles.sourceChangeBtn} onPress={handlePickSource} activeOpacity={0.7}>
            <RefreshCw size={11} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.sourceChangeText}>사진 변경</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Preset Selection */}
      {sourceImage && step !== 'processing' && step !== 'done' && (
        <View style={styles.presetGroup}>
          <Text style={styles.presetGroupLabel}>
            {mode === 'lighting' ? '조명 / 배경 프리셋' : '배경 스타일'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetList}>
            {mode === 'lighting'
              ? LIGHTING_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isActive = selectedPreset === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[styles.presetCard, isActive && styles.presetCardActive]}
                      onPress={() => {
                        setSelectedPreset(preset.id);
                        handleComposite(preset.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.presetIconBox, { backgroundColor: preset.gradient[0] }]}>
                        <Icon size={14} color={theme.colors.dark.text} strokeWidth={2} />
                      </View>
                      <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>{preset.label}</Text>
                    </TouchableOpacity>
                  );
                })
              : BACKGROUND_PRESETS.map((bg) => {
                  const isActive = selectedBackground === bg.id;
                  return (
                    <TouchableOpacity
                      key={bg.id}
                      style={[styles.presetCard, isActive && styles.presetCardActive]}
                      onPress={() => {
                        setSelectedBackground(bg.id);
                        handleComposite(bg.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.presetIconBox, { backgroundColor: bg.gradient[0] }]}>
                        <ImageIcon size={14} color={theme.colors.dark.text} strokeWidth={2} />
                      </View>
                      <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>{bg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
          </ScrollView>
        </View>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <View style={styles.processingBox}>
          <ActivityIndicator size="small" color={mode === 'lighting' ? theme.colors.accent[400] : theme.colors.primary[400]} />
          <Text style={styles.processingText}>
            {mode === 'lighting' ? '조명 연출 합성 중...' : '배경 교체 합성 중...'}
          </Text>
        </View>
      )}

      {/* Result */}
      {step === 'done' && resultImage && (
        <View style={styles.resultWrap}>
          <View style={styles.resultHeader}>
            <View style={styles.resultCheckIcon}>
              <Check size={14} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>
              {mode === 'lighting' ? '조명 스튜디오 합성 완료!' : '배경 교체 완료!'}
            </Text>
          </View>
          <Image
            source={{ uri: buildDataUrl(resultImage, 'image/png') }}
            style={styles.resultImage}
            resizeMode="contain"
          />
          <View style={styles.resultBtnRow}>
            <TouchableOpacity style={styles.resultBtnSecondary} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.resultBtnSecondaryText}>다시하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resultBtnPrimary}
              onPress={() => onResult?.(resultImage, 'image/png')}
              activeOpacity={0.7}
            >
              <Check size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.resultBtnPrimaryText}>이 이미지로 진행</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Mobile composite capture target (hidden off-screen) */}
      {Platform.OS !== 'web' && sourceImage && step === 'processing' && (
        <View
          ref={compositeRef}
          style={styles.mobileCaptureTarget as ViewStyle}
          collapsable={false}
        >
          <LinearGradient
            colors={mobileGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Image
            source={{ uri: buildDataUrl(sourceImage, 'image/jpeg') }}
            style={styles.mobileCaptureImage}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Info note */}
      {step === 'idle' && (
        <View style={styles.infoNote}>
          <Lightbulb size={12} color={mode === 'lighting' ? theme.colors.accent[400] : theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.infoNoteText}>
            {mode === 'lighting'
              ? '제품은 원본 그대로, 조명과 배경만 AI로 변경하여 전문 스튜디오 촬영 효과를 낼 수 있습니다. 6가지 조명 프리셋을 한 번에 적용하세요.'
              : '누끼(배경 제거)가 된 제품 사진을 새로운 배경 위에 자연스럽게 합성합니다. 스튜디오, 매장, 자연광, 그라디언트 중 선택하세요.'}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Web-only: composite product with lighting preset */
async function compositeWithLightingWeb(
  productDataUrl: string,
  preset: LightingPreset,
  gradient: [string, string],
): Promise<string> {
  const img = await loadImage(productDataUrl);
  const canvas = document.createElement('canvas');
  const size = 1080;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, gradient[0]);
  grad.addColorStop(1, gradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (preset === 'sunset') {
    const r = ctx.createRadialGradient(size * 0.3, size * 0.2, 0, size * 0.3, size * 0.2, size * 0.8);
    r.addColorStop(0, 'rgba(255, 200, 100, 0.3)');
    r.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
  } else if (preset === 'cozy') {
    const r = ctx.createRadialGradient(size * 0.5, size * 0.4, 0, size * 0.5, size * 0.4, size * 0.6);
    r.addColorStop(0, 'rgba(255, 180, 80, 0.15)');
    r.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
  } else if (preset === 'studio') {
    const v = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.3, size * 0.5, size * 0.5, size * 0.7);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, size, size);
  } else if (preset === 'natural') {
    const n = ctx.createLinearGradient(0, 0, 0, size);
    n.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    n.addColorStop(0.5, 'rgba(200, 230, 200, 0.05)');
    n.addColorStop(1, 'rgba(150, 200, 150, 0.1)');
    ctx.fillStyle = n;
    ctx.fillRect(0, 0, size, size);
  }

  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight) * 0.82;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(img, x, y, w, h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  return canvas.toDataURL('image/png', 0.95);
}

/** Web-only: composite product on new background */
async function compositeWithBackgroundWeb(
  productDataUrl: string,
  gradient: [string, string],
): Promise<string> {
  const img = await loadImage(productDataUrl);
  const canvas = document.createElement('canvas');
  const size = 1080;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 생성할 수 없습니다');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, gradient[0]);
  grad.addColorStop(1, gradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight) * 0.78;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 15;
  ctx.drawImage(img, x, y, w, h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  return canvas.toDataURL('image/png', 0.95);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
    el.src = src;
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  modeTabActive: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  modeTabText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  modeTabTextActive: {
    fontFamily: theme.typography.fontFamily.bold,
  },
  sourceUpload: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    borderStyle: 'dashed',
  },
  sourceUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceUploadTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  sourceUploadDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 15,
  },
  sourcePreviewWrap: {
    alignItems: 'center',
    gap: 6,
  },
  sourcePreview: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 200,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
  },
  sourceChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  sourceChangeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  presetGroup: {
    gap: 6,
  },
  presetGroupLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  presetList: {
    gap: 6,
    paddingVertical: 2,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetCardActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '15',
  },
  presetIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  presetLabelActive: {
    color: theme.colors.dark.text,
    fontFamily: theme.typography.fontFamily.bold,
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  processingText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  resultWrap: {
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultCheckIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 280,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
  },
  resultBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  resultBtnSecondaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  resultBtnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  resultBtnPrimaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '12',
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 16,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  mobileCaptureTarget: {
    position: 'absolute',
    width: 1080,
    height: 1080,
    left: -9999,
    top: 0,
    overflow: 'hidden',
  },
  mobileCaptureImage: {
    width: '82%',
    height: '82%',
    alignSelf: 'center',
    marginTop: '9%',
  },
});
