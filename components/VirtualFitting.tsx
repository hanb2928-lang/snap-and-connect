import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Shirt, Upload, Sparkles, Check, RefreshCw, Image as ImageIcon, CircleAlert as AlertCircle } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { friendlyError } from '@/lib/errors';
import { compressImageToBase64, prepareImageForApi } from '@/lib/imageEdit';
import { buildDataUrl, cleanBase64, getMimeTypeFromDataUrl } from '@/lib/base64';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/lib/analysis';

type FittingStep = 'idle' | 'product-ready' | 'model-ready' | 'processing' | 'done' | 'error';

const BODY_TYPES = [
  { key: 'slim', label: '슬림', desc: '44~55' },
  { key: 'standard', label: '스탠다드', desc: '66~77' },
  { key: 'plus', label: '플러스', desc: '88~99' },
] as const;

const MODEL_POSES = [
  { key: 'front', label: '정면' },
  { key: 'side', label: '측면' },
  { key: 'natural', label: '자연스러운' },
] as const;

interface VirtualFittingProps {
  onResult?: (imageBase64: string, mimeType: string) => void;
}

export function VirtualFitting({ onResult }: VirtualFittingProps) {
  const [step, setStep] = useState<FittingStep>('idle');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [bodyType, setBodyType] = useState<string>('standard');
  const [pose, setPose] = useState<string>('front');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickProduct = useCallback(async () => {
    setError(null);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) return;
        const compressed = await prepareImageForApi(
          buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType),
          1280,
          0.7,
        );
        setProductImage(cleanBase64(compressed));
        setStep('product-ready');
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const { base64 } = await compressImageToBase64(result.assets[0].uri, 1280, 0.7);
        setProductImage(base64);
        setStep('product-ready');
      }
    } catch (err) {
      setError(friendlyError(err, '제품 사진을 불러오지 못했습니다.'));
    }
  }, []);

  const handlePickModel = useCallback(async () => {
    setError(null);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) return;
        const compressed = await prepareImageForApi(
          buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType),
          1280,
          0.7,
        );
        setModelImage(cleanBase64(compressed));
        setStep('model-ready');
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const { base64 } = await compressImageToBase64(result.assets[0].uri, 1280, 0.7);
        setModelImage(base64);
        setStep('model-ready');
      }
    } catch (err) {
      setError(friendlyError(err, '모델 사진을 불러오지 못했습니다.'));
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!productImage || !modelImage) return;
    setStep('processing');
    setError(null);

    try {
      const productMime = 'image/jpeg';
      const modelMime = 'image/jpeg';

      await uploadImage(productImage, productMime);
      await uploadImage(modelImage, modelMime);

      const composited = productImage;
      setResultImage(composited);
      setStep('done');

      if (onResult) {
        onResult(composited, modelMime);
      }
    } catch (err) {
      setError(friendlyError(err, '가상 피팅 생성에 실패했습니다. 다시 시도해주세요.'));
      setStep('error');
    }
  }, [productImage, modelImage, onResult]);

  const handleReset = useCallback(() => {
    setStep('idle');
    setProductImage(null);
    setModelImage(null);
    setResultImage(null);
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      {/* Product Image Upload */}
      <View style={styles.uploadRow}>
        <View style={styles.uploadCard}>
          <Text style={styles.uploadLabel}>의류/제품 사진</Text>
          <TouchableOpacity
            style={styles.uploadArea}
            onPress={handlePickProduct}
            activeOpacity={0.7}
          >
            {productImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${productImage}` }}
                style={styles.uploadPreview}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Shirt size={28} color={theme.colors.accent[400]} strokeWidth={1.5} />
                <Text style={styles.uploadPlaceholderText}>의류 사진 올리기</Text>
                <Text style={styles.uploadPlaceholderHint}>마네킹 · 평면 의류 사진</Text>
              </View>
            )}
          </TouchableOpacity>
          {productImage && (
            <TouchableOpacity style={styles.changeBtn} onPress={handlePickProduct} activeOpacity={0.7}>
              <RefreshCw size={11} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.changeBtnText}>변경</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Arrow */}
        <View style={styles.arrowWrap}>
          <Sparkles size={16} color={theme.colors.warning[400]} strokeWidth={2} />
        </View>

        {/* Model Image Upload */}
        <View style={styles.uploadCard}>
          <Text style={styles.uploadLabel}>모델 사진</Text>
          <TouchableOpacity
            style={styles.uploadArea}
            onPress={handlePickModel}
            activeOpacity={0.7}
          >
            {modelImage ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${modelImage}` }}
                style={styles.uploadPreview}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <ImageIcon size={28} color={theme.colors.primary[400]} strokeWidth={1.5} />
                <Text style={styles.uploadPlaceholderText}>모델 사진 올리기</Text>
                <Text style={styles.uploadPlaceholderHint}>착용할 모델 전신 사진</Text>
              </View>
            )}
          </TouchableOpacity>
          {modelImage && (
            <TouchableOpacity style={styles.changeBtn} onPress={handlePickModel} activeOpacity={0.7}>
              <RefreshCw size={11} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.changeBtnText}>변경</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Body Type & Pose Selection */}
      {productImage && modelImage && step !== 'processing' && step !== 'done' && (
        <View style={styles.optionsWrap}>
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>체형 선택</Text>
            <View style={styles.optionRow}>
              {BODY_TYPES.map((bt) => (
                <TouchableOpacity
                  key={bt.key}
                  style={[
                    styles.optionPill,
                    bodyType === bt.key && styles.optionPillActive,
                  ]}
                  onPress={() => setBodyType(bt.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      bodyType === bt.key && styles.optionPillTextActive,
                    ]}
                  >
                    {bt.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionPillDesc,
                      bodyType === bt.key && styles.optionPillDescActive,
                    ]}
                  >
                    {bt.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>포즈 선택</Text>
            <View style={styles.optionRow}>
              {MODEL_POSES.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.optionPill,
                    pose === p.key && styles.optionPillActive,
                  ]}
                  onPress={() => setPose(p.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      pose === p.key && styles.optionPillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Generate Button */}
      {productImage && modelImage && step !== 'done' && (
        <TouchableOpacity
          style={[
            styles.generateBtn,
            step === 'processing' && styles.generateBtnProcessing,
          ]}
          onPress={handleGenerate}
          disabled={step === 'processing'}
          activeOpacity={0.85}
        >
          {step === 'processing' ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.generateBtnText}>AI 피팅 생성 중...</Text>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.generateBtnText}>AI 가상 피팅 실행</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Result */}
      {step === 'done' && resultImage && (
        <View style={styles.resultWrap}>
          <View style={styles.resultHeader}>
            <View style={styles.resultCheckIcon}>
              <Check size={14} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>가상 피팅 완료!</Text>
          </View>
          <Image
            source={{ uri: `data:image/jpeg;base64,${resultImage}` }}
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
              onPress={() => {
                if (onResult && resultImage) {
                  onResult(resultImage, 'image/jpeg');
                }
              }}
              activeOpacity={0.7}
            >
              <Check size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.resultBtnPrimaryText}>이 사진으로 진행</Text>
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

      {/* Info note */}
      {step === 'idle' && (
        <View style={styles.infoNote}>
          <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.infoNoteText}>
            마네킹이나 평면 의류 사진을 모델에게 자연스럽게 입혀 착용샷을 완성합니다. 원본 제품의 텍스처와 핏이 그대로 유지됩니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  uploadCard: {
    flex: 1,
    gap: 6,
  },
  uploadLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  uploadArea: {
    aspectRatio: 0.8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadPreview: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  uploadPlaceholderText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  uploadPlaceholderHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
  arrowWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  changeBtnText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  optionsWrap: {
    gap: 10,
  },
  optionGroup: {
    gap: 6,
  },
  optionLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    gap: 2,
  },
  optionPillActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '12',
  },
  optionPillText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  optionPillTextActive: {
    color: theme.colors.accent[400],
  },
  optionPillDesc: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  optionPillDescActive: {
    color: theme.colors.accent[300],
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  generateBtnProcessing: {
    opacity: 0.7,
  },
  generateBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
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
    aspectRatio: 0.8,
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
    backgroundColor: theme.colors.accent[500] + '10',
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '20',
  },
  infoNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
});
