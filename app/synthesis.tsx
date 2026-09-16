import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PlatformModeSelectCard,
  type PlatformMode,
  type OutputMode,
} from '@/components/PlatformModeSelectCard';
import {
  ProductMoodPresetCard,
  type ProductMood,
} from '@/components/ProductMoodPresetCard';
import {
  SourceInputFittingPanel,
  type SourceImage,
} from '@/components/SourceInputFittingPanel';
import {
  GenerationModePanel,
  type GenMode,
} from '@/components/GenerationModePanel';
import { PreviewExportTray } from '@/components/PreviewExportTray';

export default function SynthesisScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const insets = useSafeAreaInsets();

  const [platform, setPlatform] = useState<PlatformMode>('shortform');
  const [outputMode, setOutputMode] = useState<OutputMode>('image');
  const [mood, setMood] = useState<ProductMood>('studio_premium');
  const [productImages, setProductImages] = useState<SourceImage[]>([]);
  const [modelImage, setModelImage] = useState<SourceImage | null>(null);
  const [genMode, setGenMode] = useState<GenMode>('auto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [manualPrompt, setManualPrompt] = useState('');
  const [cameraSpeed, setCameraSpeed] = useState(1.0);
  const [ttsSyncOffset, setTtsSyncOffset] = useState(0);
  const [captionText, setCaptionText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const productInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);

  const fittingReady = productImages.length >= 3 && !!modelImage;

  const handlePlatformChange = useCallback((mode: PlatformMode) => {
    setPlatform(mode);
    const platformHooks: Record<PlatformMode, string> = {
      shortform: '3초 안에 궁금해지는 훅',
      feed: '스크롤 멈추는 한 줄',
      detail: '구매 욕구 자극 카피',
    };
    setCaptionText(platformHooks[mode]);
  }, []);

  const handleWebProductPick = useCallback(() => {
    if (Platform.OS !== 'web' || !productInputRef.current) return;
    productInputRef.current.click();
  }, []);

  const handleWebModelPick = useCallback(() => {
    if (Platform.OS !== 'web' || !modelInputRef.current) return;
    modelInputRef.current.click();
  }, []);

  const handleProductFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: SourceImage[] = [];
    const remaining = 5 - productImages.length;
    const angleLabels = ['정면', '좌측', '우측', '후면', '상부'];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      newImages.push({
        id: `prod-${Date.now()}-${i}`,
        uri: url,
        angle: angleLabels[productImages.length + i] || `사진 ${productImages.length + i + 1}`,
      });
    }
    if (newImages.length > 0) setProductImages((prev) => [...prev, ...newImages]);
    e.target.value = '';
  }, [productImages.length]);

  const handleModelFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    setModelImage({ id: `model-${Date.now()}`, uri: url });
    e.target.value = '';
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return () => {
      productImages.forEach((img) => {
        if (img.uri.startsWith('blob:')) URL.revokeObjectURL(img.uri);
      });
      if (modelImage?.uri.startsWith('blob:')) URL.revokeObjectURL(modelImage.uri);
    };
  }, [productImages, modelImage]);

  const handleGenerate = useCallback(() => {
    if (productImages.length < 3) {
      setError('제품 사진을 최소 3컷 등록해주세요.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setResultImageUrl(null);
    setResultVideoUrl(null);

    setTimeout(() => {
      setIsGenerating(false);
      if (outputMode === 'image') {
        setResultImageUrl(productImages[0]?.uri ?? null);
      } else {
        setResultVideoUrl(productImages[0]?.uri ?? null);
      }
    }, 2000);
  }, [productImages, outputMode]);

  const handleDownload = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => setIsExporting(false), 1000);
  }, []);

  const handleShare = useCallback(() => {
    if (Platform.OS === 'web') {
      Alert.alert('공유', 'SNS 공유 기능이 곧 제공됩니다.');
    }
  }, []);

  const autoDetectedMood: ProductMood | null = productImages.length >= 3 ? mood : null;

  return (
    <View style={styles.container}>
      {/* Hidden file inputs for web */}
      {Platform.OS === 'web' && (
        <>
          <input
            ref={productInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleProductFileChange}
          />
          <input
            ref={modelInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleModelFileChange}
          />
        </>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: safeTop + 12 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Sparkles size={16} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.topTitle}>AI 범용 합성 편집</Text>
        </View>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + theme.spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <PlatformModeSelectCard
          platform={platform}
          outputMode={outputMode}
          onPlatformChange={handlePlatformChange}
          onOutputModeChange={setOutputMode}
        />

        <ProductMoodPresetCard
          autoDetectedMood={autoDetectedMood}
          mood={mood}
          onMoodChange={setMood}
        />

        <SourceInputFittingPanel
          productImages={productImages}
          modelImage={modelImage}
          onProductImageAdd={setProductImages}
          onModelImageSet={setModelImage}
          fittingReady={fittingReady}
          onWebProductPick={handleWebProductPick}
          onWebModelPick={handleWebModelPick}
        />

        <GenerationModePanel
          mode={genMode}
          onModeChange={setGenMode}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          manualPrompt={manualPrompt}
          onManualPromptChange={setManualPrompt}
          cameraSpeed={cameraSpeed}
          onCameraSpeedChange={setCameraSpeed}
          ttsSyncOffset={ttsSyncOffset}
          onTtsSyncOffsetChange={setTtsSyncOffset}
          captionText={captionText}
          onCaptionTextChange={setCaptionText}
        />

        <PreviewExportTray
          outputMode={outputMode}
          resultImageUrl={resultImageUrl}
          resultVideoUrl={resultVideoUrl}
          onDownload={handleDownload}
          onShare={handleShare}
          isExporting={isExporting}
        />

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonPlaceholder: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  } as ViewStyle,
  errorBanner: {
    backgroundColor: theme.colors.error[500] + '20',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
});
