import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { Camera, Image as ImageIcon, Flame, ArrowRight, Settings, Sparkles, RotateCcw, Grid3x3, Zap, ZapOff, X, Info, Layers } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/lib/theme';
import { startAsyncAnalysis } from '@/lib/asyncAnalysis';
import { buildDataUrl, cleanBase64, getMimeTypeFromDataUrl } from '@/lib/base64';
import { prepareImageForApi, compressImageToBase64 } from '@/lib/imageEdit';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { OnboardingModal } from '@/components/OnboardingModal';
import { ProgressOverlay } from '@/components/ProgressOverlay';
import { CreditBalanceBadge } from '@/components/CreditBalanceBadge';
import { CreditPurchaseModal } from '@/components/CreditPurchaseModal';
import { ImageCropModal } from '@/components/ImageCropModal';
import { CapturePreviewModal } from '@/components/CapturePreviewModal';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import { MultiAngleCaptureGuide, type AngleShot } from '@/components/MultiAngleCaptureGuide';

const CAPTURE_TIMEOUT_MS = 15000;
const PICK_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 120000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} (시간 초과)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export default function CameraScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const isMountedRef = useRef(true);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [gridVisible, setGridVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [previewCapture, setPreviewCapture] = useState<{ base64: string; mimeType: string } | null>(null);
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [multiAngleVisible, setMultiAngleVisible] = useState(false);
  const [multiAngleShots, setMultiAngleShots] = useState<AngleShot[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const fadeAnim = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setIsActive(true);
      return () => {
        isMountedRef.current = false;
        setIsActive(false);
        setCameraReady(false);
      };
    }, []),
  );

  useEffect(() => {
    (async () => {
      const seenOnboarding = await getItem('onboarding_seen');
      if (!seenOnboarding) {
        setShowOnboardingModal(true);
        setItem('onboarding_seen', 'true');
      }
    })();
  }, []);

  const fadeIn = useCallback(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [fadeAnim]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const handleCapture = async () => {
    if (!cameraRef.current || processing || !cameraReady) return;
    setProcessing(true);
    try {
      const photo = await withTimeout(
        cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          shutterSound: false,
          ...({ mute: true } as Record<string, unknown>),
        }) as Promise<{ base64?: string; uri: string }>,
        CAPTURE_TIMEOUT_MS,
        '사진 촬영',
      );
      if (!photo?.base64) throw new Error('Failed to capture image data');
      const cleanB64 = cleanBase64(photo.base64);
      const compressedDataUrl = await withTimeout(
        prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7),
        PICK_TIMEOUT_MS,
        '이미지 압축',
      );
      if (!isMountedRef.current) return;
      const compressedB64 = cleanBase64(compressedDataUrl);
      const compressedMime = getMimeTypeFromDataUrl(compressedDataUrl);
      setError(null);
      setProcessing(false);
      setPreviewCapture({ base64: compressedB64, mimeType: compressedMime });
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '사진 촬영에 실패했습니다. 다시 시도해주세요.'));
      setProcessing(false);
    }
  };

  const handlePickImage = async () => {
    if (processing) return;

    if (isWebPlatform()) {
      try {
        const images = await withTimeout(pickImageWeb(false, 1), PICK_TIMEOUT_MS, '사진 선택');
        if (images.length === 0) return;
        const compressed = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1080, 0.7),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        const compressedMime = getMimeTypeFromDataUrl(compressed);
        setSelectedImage(cleanBase64(compressed));
        setSelectedImageMime(compressedMime);
      } catch (err) {
        setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
      }
      return;
    }

    try {
      const result = await withTimeout(
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        }),
        PICK_TIMEOUT_MS,
        '사진 선택',
      );
      if (!isMountedRef.current) return;
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      const { base64, mimeType } = await withTimeout(
        compressImageToBase64(asset.uri, 1080, 0.7),
        PICK_TIMEOUT_MS,
        '이미지 압축',
      );
      if (!isMountedRef.current) return;
      setSelectedImage(base64);
      setSelectedImageMime(mimeType);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
    }
  };

  const processImage = async (base64: string, mimeType: string) => {
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      setProgressStep(1);
      setProgressText('AI 분석 중...');
      progressWidth.value = withTiming(0.35, { duration: 500 });

      progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      const additionalB64s = multiAngleShots.slice(1).map((s) => s.base64).filter(Boolean) as string[];
      const { scanId } = await withTimeout(
        startAsyncAnalysis(base64, mimeType, additionalB64s.length > 0 ? 'multi' : 'single', additionalB64s),
        ANALYSIS_TIMEOUT_MS,
        'AI 분석',
      );

      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

      setProgressStep(2);
      setProgressText('결과 페이지로 이동 중...');
      progressWidth.value = withTiming(0.9, { duration: 300 });

      setProgressStep(3);
      setProgressText('완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      if (isMountedRef.current) setProcessing(false);
    }
  };

  const lastActionRef = useRef(0);
  const handleGenerate = async () => {
    const now = Date.now();
    if (now - lastActionRef.current < 800) return;
    lastActionRef.current = now;

    const imageBase64 = selectedImage || previewCapture?.base64;
    const imageMime = selectedImage ? selectedImageMime : previewCapture?.mimeType;
    if (!imageBase64) return;

    setPreviewCapture(null);
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('AI 분석 준비 중...');
    progressWidth.value = withTiming(0.1, { duration: 200 });
    fadeAnim.value = 0;
    await processImage(imageBase64, imageMime || 'image/jpeg');
  };

  const handlePreviewConfirm = async (base64: string, mimeType: string) => {
    setPreviewCapture(null);
    setSelectedImage(base64);
    setSelectedImageMime(mimeType);
  };

  const handlePreviewRetake = () => {
    setPreviewCapture(null);
  };

  const handleMultiAngleComplete = (shots: AngleShot[]) => {
    setMultiAngleShots(shots);
    setMultiAngleVisible(false);
    if (shots[0]?.base64) {
      setSelectedImage(shots[0].base64);
      setSelectedImageMime(shots[0].mimeType || 'image/jpeg');
    }
  };

  const handleMultiAnglePick = async (_angleId: string): Promise<{ base64: string; mimeType: string } | null> => {
    if (isWebPlatform()) {
      try {
        const images = await withTimeout(pickImageWeb(false, 1), PICK_TIMEOUT_MS, '사진 선택');
        if (images.length === 0) return null;
        const compressed = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1080, 0.7),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        return { base64: cleanBase64(compressed), mimeType: getMimeTypeFromDataUrl(compressed) };
      } catch {
        return null;
      }
    }
    try {
      const result = await withTimeout(
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        }),
        PICK_TIMEOUT_MS,
        '사진 선택',
      );
      if (result.canceled || !result.assets?.[0]?.uri) return null;
      const { base64, mimeType } = await withTimeout(
        compressImageToBase64(result.assets[0].uri, 1080, 0.7),
        PICK_TIMEOUT_MS,
        '이미지 압축',
      );
      return { base64, mimeType };
    } catch {
      return null;
    }
  };

  const hasImage = selectedImage || previewCapture?.base64;

  if (isWebPlatform()) {
    return (
      <WebSimpleScreen
        selectedImage={selectedImage}
        selectedImageMime={selectedImageMime}
        multiAngleCount={multiAngleShots.length}
        onPickImage={handlePickImage}
        onGenerate={handleGenerate}
        onMultiAnglePress={() => setMultiAngleVisible(true)}
        onSettingsPress={() => router.push('/settings' as never)}
        processing={processing}
        error={error}
        progressStep={progressStep}
        progressText={progressText}
        progressWidth={progressWidth}
        fadeIn={fadeIn}
        overlayStyle={overlayStyle}
        fadeAnim={fadeAnim}
        safeTop={safeTop}
        tabBarHeight={tabBarHeight}
        onCreditPress={() => setCreditModalVisible(true)}
      />
    );
  }

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>카메라 로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar: Settings + Credits */}
      <View style={[styles.topBar, { top: safeTop + 8 }]}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => router.push('/settings' as never)}
          activeOpacity={0.7}
        >
          <Settings size={22} color={theme.colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <CreditBalanceBadge onPress={() => setCreditModalVisible(true)} compact />
      </View>

      {/* Camera Preview — fills most of screen */}
      <View style={styles.cameraPreviewWrap}>
        {isActive ? (
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing={facing}
            flash={flash}
            zoom={zoom}
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={[styles.cameraPreview, styles.cameraPlaceholder]}>
            <Camera size={36} color={theme.colors.dark.textDim} strokeWidth={1.5} />
          </View>
        )}

        {/* Grid overlay */}
        {gridVisible && (
          <View style={styles.gridOverlay} pointerEvents="none">
            <View style={styles.gridLineV1} />
            <View style={styles.gridLineV2} />
            <View style={styles.gridLineH1} />
            <View style={styles.gridLineH2} />
          </View>
        )}

        {/* Camera controls */}
        <View style={styles.cameraControls}>
          <View style={styles.cameraCtrlRow}>
            <TouchableOpacity
              style={styles.cameraCtrlBtn}
              onPress={() => setGridVisible((g) => !g)}
              activeOpacity={0.7}
            >
              {gridVisible ? (
                <Grid3x3 size={18} color={theme.colors.primary[400]} strokeWidth={2} />
              ) : (
                <Grid3x3 size={18} color="#fff" strokeWidth={2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraCtrlBtn}
              onPress={() => setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))}
              activeOpacity={0.7}
            >
              {flash === 'on' ? (
                <Zap size={18} color={theme.colors.warning[400]} strokeWidth={2} />
              ) : flash === 'auto' ? (
                <View style={styles.flashAutoWrap}>
                  <Zap size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.flashAutoLabel}>A</Text>
                </View>
              ) : (
                <ZapOff size={18} color="#fff" strokeWidth={2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraCtrlBtn}
              onPress={() => { setCameraReady(false); setFacing((f) => (f === 'back' ? 'front' : 'back')); }}
              activeOpacity={0.7}
            >
              <RotateCcw size={18} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected image preview overlay */}
        {selectedImage && (
          <View style={styles.selectedImageOverlay}>
            <Image source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }} style={styles.selectedImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.clearImageBtn}
              onPress={() => setSelectedImage(null)}
              activeOpacity={0.7}
            >
              <X size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Action Area */}
      <View style={[styles.bottomAction, { paddingBottom: tabBarHeight + theme.spacing.sm }]}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Capture quality tip */}
        <View style={styles.captureTip}>
          <Info size={14} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.captureTipText}>
            단품 클로즈업 + 측면/디테일 컷을 함께 올리면 AI 분석 정확도가 2배 높아져요!
          </Text>
        </View>

        {/* Multi-angle shortcut */}
        <TouchableOpacity
          style={styles.multiAngleBtn}
          onPress={() => setMultiAngleVisible(true)}
          activeOpacity={0.7}
        >
          <Layers size={16} color={theme.colors.accent[400]} strokeWidth={2.2} />
          <Text style={styles.multiAngleBtnText}>다각도 사진으로 정확도 높이기</Text>
          {multiAngleShots.length > 0 && (
            <View style={styles.multiAngleBadge}>
              <Text style={styles.multiAngleBadgeText}>{multiAngleShots.length}장</Text>
            </View>
          )}
          <ArrowRight size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Two main buttons */}
        <View style={styles.mainBtnRow}>
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={handlePickImage}
            disabled={processing}
            activeOpacity={0.7}
          >
            <ImageIcon size={24} color={theme.colors.dark.text} strokeWidth={2} />
            <Text style={styles.galleryBtnText}>사진 선택</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureBtn}
            onPress={hasImage ? handleGenerate : handleCapture}
            disabled={processing || (!hasImage && !cameraReady)}
            activeOpacity={0.85}
          >
            <View style={styles.captureBtnInner}>
              {hasImage ? (
                <>
                  <Flame size={26} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.captureBtnText}>10초 만에 매장 홍보 숏폼 만들기</Text>
                  <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
                </>
              ) : (
                <>
                  <Camera size={28} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.captureBtnText}>사진 촬영</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview Modal */}
      {previewCapture && (
        <CapturePreviewModal
          visible={!!previewCapture}
          imageBase64={previewCapture.base64}
          mimeType={previewCapture.mimeType}
          onConfirm={handlePreviewConfirm}
          onRetake={handlePreviewRetake}
        />
      )}

      {/* Onboarding */}
      <OnboardingModal
        visible={showOnboardingModal}
        onComplete={() => setShowOnboardingModal(false)}
      />

      {/* Multi-Angle Capture Guide */}
      <MultiAngleCaptureGuide
        visible={multiAngleVisible}
        onClose={() => setMultiAngleVisible(false)}
        onComplete={handleMultiAngleComplete}
        onPickImage={handleMultiAnglePick}
      />

      {/* Processing overlay */}
      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['촬영', '분석', '저장']}
          />
        </Animated.View>
      )}

      {/* Credit Modal */}
      <CreditPurchaseModal
        visible={creditModalVisible}
        onClose={() => setCreditModalVisible(false)}
      />
    </View>
  );
}

interface WebSimpleScreenProps {
  selectedImage: string | null;
  selectedImageMime: string;
  multiAngleCount: number;
  onPickImage: () => void;
  onGenerate: () => void;
  onMultiAnglePress: () => void;
  onSettingsPress: () => void;
  processing: boolean;
  error: string | null;
  progressStep: number;
  progressText: string;
  progressWidth: ReturnType<typeof useSharedValue<number>>;
  fadeIn: () => void;
  overlayStyle: ReturnType<typeof useAnimatedStyle>;
  fadeAnim: ReturnType<typeof useSharedValue<number>>;
  safeTop: number;
  tabBarHeight: number;
  onCreditPress: () => void;
}

function WebSimpleScreen({
  selectedImage,
  selectedImageMime,
  multiAngleCount,
  onPickImage,
  onGenerate,
  onMultiAnglePress,
  onSettingsPress,
  processing,
  error,
  progressStep,
  progressText,
  progressWidth,
  fadeIn,
  overlayStyle,
  safeTop,
  tabBarHeight,
  onCreditPress,
}: WebSimpleScreenProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: safeTop + theme.spacing.lg, paddingHorizontal: theme.spacing.lg, paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <View style={styles.webTopBar}>
          <TouchableOpacity onPress={onSettingsPress} activeOpacity={0.7}>
            <Settings size={24} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
          <CreditBalanceBadge onPress={onCreditPress} compact />
        </View>

        {/* Hero */}
        <View style={styles.webHero}>
          <View style={styles.webHeroIcon}>
            <Sparkles size={40} color={theme.colors.primary[400]} strokeWidth={1.8} />
          </View>
          <Text style={styles.webHeroTitle}>10초 만에 매장 홍보 숏폼 만들기</Text>
          <Text style={styles.webHeroSub}>
            매장 사진을 올리면 AI가 분석해서 동네 손님을 부르는 숏폼을 자동으로 만들어드려요
          </Text>
        </View>

        {/* Capture quality tip */}
        <View style={styles.webCaptureTip}>
          <Info size={16} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.webCaptureTipText}>
            단품 클로즈업 + 측면/디테일 컷을 함께 올리면 AI 분석 정확도가 2배 높아져요!
          </Text>
        </View>

        {/* Selected image preview */}
        {selectedImage && (
          <View style={styles.webImagePreview}>
            <Image source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }} style={styles.webPreviewImg} resizeMode="contain" />
          </View>
        )}

        {/* Multi-angle shortcut */}
        <TouchableOpacity style={styles.multiAngleBtn} onPress={onMultiAnglePress} activeOpacity={0.7}>
          <Layers size={16} color={theme.colors.accent[400]} strokeWidth={2.2} />
          <Text style={styles.multiAngleBtnText}>다각도 사진으로 정확도 높이기</Text>
          {multiAngleCount > 0 && (
            <View style={styles.multiAngleBadge}>
              <Text style={styles.multiAngleBadgeText}>{multiAngleCount}장</Text>
            </View>
          )}
          <ArrowRight size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Main action buttons */}
        <TouchableOpacity style={styles.webPickBtn} onPress={onPickImage} disabled={processing} activeOpacity={0.8}>
          <ImageIcon size={22} color="#fff" strokeWidth={2} />
          <Text style={styles.webPickBtnText}>사진 선택 / 업로드</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.webGenerateBtn, !selectedImage && styles.webGenerateBtnDisabled]}
          onPress={onGenerate}
          disabled={!selectedImage || processing}
          activeOpacity={0.85}
        >
          <Flame size={24} color="#fff" strokeWidth={2.5} />
          <Text style={styles.webGenerateBtnText}>10초 만에 매장 홍보 숏폼 만들기</Text>
          <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>

        {!selectedImage && (
          <Text style={styles.webHint}>사진을 먼저 선택해주세요</Text>
        )}

        {error && (
          <View style={styles.webErrorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['업로드', '분석', '저장']}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.bg,
    gap: theme.spacing.md,
  },
  permissionText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 20,
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPreviewWrap: {
    flex: 1,
    position: 'relative',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraPlaceholder: {
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  gridLineV1: {
    position: 'absolute',
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineH1: {
    position: 'absolute',
    top: '33.33%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.66%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  cameraControls: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  cameraCtrlRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  cameraCtrlBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashAutoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  flashAutoLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    marginTop: -6,
  },
  selectedImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.dark.bg,
    zIndex: 8,
  },
  selectedImage: {
    flex: 1,
  },
  clearImageBtn: {
    position: 'absolute',
    top: 60,
    right: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomAction: {
    backgroundColor: theme.colors.dark.surface,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
  },
  errorBanner: {
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  captureTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
  },
  captureTipText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.primary[300],
    lineHeight: 15,
  },
  multiAngleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  multiAngleBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  multiAngleBadge: {
    backgroundColor: theme.colors.accent[500] + '30',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  multiAngleBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[300],
  },
  mainBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  galleryBtn: {
    width: 100,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  galleryBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  captureBtn: {
    flex: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  captureBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.radius.lg,
  },
  captureBtnText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 18, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  // Web styles
  webTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  webHero: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  webHeroIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primary[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  webHeroTitle: {
    fontSize: 26,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  webHeroSub: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  webCaptureTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[500] + '12',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: theme.spacing.md,
  },
  webCaptureTipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.primary[300],
    lineHeight: 18,
  },
  webImagePreview: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    maxHeight: 300,
  },
  webPreviewImg: {
    width: '100%',
    height: 300,
  },
  webPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.sm,
  },
  webPickBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  webGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.radius.lg,
    paddingVertical: 18,
  },
  webGenerateBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  webGenerateBtnText: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  webHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  webErrorBanner: {
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: theme.spacing.md,
  },
});
