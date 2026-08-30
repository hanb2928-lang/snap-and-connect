import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { Camera, Image as ImageIcon, Flame, ArrowRight, Settings, Sparkles, RotateCcw, Grid3x3, Zap, ZapOff, X, Info, Layers, Sun, Droplet, PenLine, Check, ChevronDown, TrendingUp, Tag, Store } from 'lucide-react-native';
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
import { VoiceCommandFloatingButton } from '@/components/VoiceCommandFloatingButton';
import { WeatherBanner } from '@/components/WeatherBanner';
import type { ParsedVoiceCommand } from '@/hooks/useVoiceCommand';

const CAPTURE_TIMEOUT_MS = 15000;
const PICK_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 120000;

const INSTANT_HOOKS = [
  { key: 'new_menu', label: '오늘 우리 동네 신메뉴 특가!', icon: Store, color: theme.colors.warning[400] },
  { key: 'limited', label: '재료 소진 전 마지막 기회', icon: Flame, color: theme.colors.error[400] },
  { key: 'best_seller', label: '이 동네 1위 베스트셀러', icon: TrendingUp, color: theme.colors.primary[400] },
  { key: 'seasonal', label: '계절 한정! 이맘때만 맛볼 수 있어요', icon: Tag, color: theme.colors.accent[400] },
  { key: 'combo', label: '꿀조합 발견! 같이 시키면 최고', icon: Sparkles, color: theme.colors.success[400] },
];

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
  const safeInsets = useSafeAreaInsets();
  const bottomInset = Math.max(safeInsets.bottom, 0);
  const isMountedRef = useRef(true);
  const voiceCommandInProgressRef = useRef(false);
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
  const [captureMode, setCaptureMode] = useState<'single' | 'multi'>('single');
  const [moodFilter, setMoodFilter] = useState<'none' | 'warm' | 'fresh'>('none');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [funnelStage, setFunnelStage] = useState<'idle' | 'analyzing' | 'selecting_hook'>('idle');
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [manualPromptOpen, setManualPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
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
        setProcessing(false);
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

  useEffect(() => {
    if (funnelStage !== 'analyzing') return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) setFunnelStage('selecting_hook');
    }, 1800);
    return () => clearTimeout(timer);
  }, [funnelStage]);

  const fadeIn = useCallback(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [fadeAnim]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const handleCapture = async () => {
    if (!cameraRef.current || processing || !cameraReady) return;
    setProcessing(true);
    setProgressStep(0);
    setProgressText('사진 촬영 중...');
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
        setSelectedHook(null);
        setCustomPrompt('');
        setManualPromptOpen(false);
        setMultiAngleShots([]);
        setCaptureMode('single');
        setFunnelStage('analyzing');
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
      setSelectedHook(null);
      setCustomPrompt('');
      setManualPromptOpen(false);
      setMultiAngleShots([]);
      setCaptureMode('single');
      setFunnelStage('analyzing');
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

    const hookToSave = customPrompt.trim() || selectedHook || '';
    if (hookToSave) {
      await setItem('marketing_selected_hook', hookToSave);
    }
    await setItem('marketing_custom_prompt', customPrompt.trim());
    await setItem('marketing_mood_filter', moodFilter);

    setFunnelStage('idle');
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
    setSelectedHook(null);
    setCustomPrompt('');
    setManualPromptOpen(false);
    setMultiAngleShots([]);
    setCaptureMode('single');
    setFunnelStage('analyzing');
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
      setSelectedHook(null);
      setCustomPrompt('');
      setManualPromptOpen(false);
      setFunnelStage('analyzing');
    }
  };

  const handleCaptureModeToggle = () => {
    if (captureMode === 'single') {
      setCaptureMode('multi');
      setMultiAngleVisible(true);
    } else {
      setCaptureMode('single');
      setMultiAngleShots([]);
    }
  };

  const handleVoiceCommand = useCallback(async (cmd: ParsedVoiceCommand) => {
    // Prevent re-entry during async capture+navigate
    if (voiceCommandInProgressRef.current) return;
    voiceCommandInProgressRef.current = true;

    // Save voice command data first so marketing screen can pick it up
    await setItem('marketing_voice_command_prompt', cmd.promptText);
    await setItem('marketing_voice_command_intent', cmd.intent || '');
    await setItem('marketing_voice_command_active', 'true');

    // If camera is ready and no image selected yet, auto-capture a photo hands-free
    if (cameraRef.current && cameraReady && !selectedImage && !previewCapture && !processing) {
      try {
        setProcessing(true);
        setProgressText('음성 명령 감지! 사진 촬영 중...');
        progressWidth.value = withTiming(0.15, { duration: 200 });
        fadeAnim.value = 0;
        fadeIn();

        const photo = await withTimeout(
          cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.7,
            shutterSound: false,
            ...({ mute: true } as Record<string, unknown>),
          }) as Promise<{ base64?: string; uri: string }>,
          CAPTURE_TIMEOUT_MS,
          '음성 자동 촬영',
        );
        if (!photo?.base64) throw new Error('auto-capture failed');
        const cleanB64 = cleanBase64(photo.base64);
        const compressedDataUrl = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        if (!isMountedRef.current) return;
        const compressedB64 = cleanBase64(compressedDataUrl);
        const compressedMime = getMimeTypeFromDataUrl(compressedDataUrl);

        // Save captured image so marketing screen can use it
        await setItem('marketing_voice_captured_image', compressedB64);
        await setItem('marketing_voice_captured_mime', compressedMime);
        setProcessing(false);
      } catch {
        if (!isMountedRef.current) return;
        setProcessing(false);
        // Capture failed — still route to marketing without a photo
      }
    }

    // Clear camera tab state before navigating (marketing owns the image via storage)
    setSelectedImage(null);
    setSelectedImageMime('image/jpeg');
    setPreviewCapture(null);
    setFunnelStage('idle');
    setSelectedHook(null);
    setCustomPrompt('');
    setMultiAngleShots([]);
    setCaptureMode('single');

    router.push('/(tabs)/marketing' as never);
    voiceCommandInProgressRef.current = false;
  }, [router, cameraReady, selectedImage, previewCapture, processing, progressWidth, fadeAnim, fadeIn]);

  const moodOverlayColor =
    moodFilter === 'warm' ? 'rgba(255, 180, 80, 0.12)' :
    moodFilter === 'fresh' ? 'rgba(100, 200, 220, 0.12)' :
    'transparent';

  const moodOverlayStyle: { tintColor?: string } =
    moodFilter === 'warm'
      ? { tintColor: 'rgba(255,180,80,0.08)' }
      : moodFilter === 'fresh'
        ? { tintColor: 'rgba(100,200,220,0.08)' }
        : {};

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
        captureMode={captureMode}
        moodFilter={moodFilter}
        onCaptureModeToggle={handleCaptureModeToggle}
        onMoodFilterChange={setMoodFilter}
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

      {/* Weather Emergency Banner */}
      <WeatherBanner />

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

        {/* Capture mode toggle + mood filter */}
        <View style={styles.cameraExtraControls}>
          <View style={styles.captureModeToggle}>
            <TouchableOpacity
              style={[styles.captureModeBtn, captureMode === 'single' && styles.captureModeBtnActive]}
              onPress={() => { setCaptureMode('single'); setMultiAngleShots([]); }}
              activeOpacity={0.7}
            >
              <Camera size={14} color={captureMode === 'single' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.captureModeText, captureMode === 'single' && styles.captureModeTextActive]}>1장 빠른 촬영</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.captureModeBtn, captureMode === 'multi' && styles.captureModeBtnActive]}
              onPress={handleCaptureModeToggle}
              activeOpacity={0.7}
            >
              <Layers size={14} color={captureMode === 'multi' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.captureModeText, captureMode === 'multi' && styles.captureModeTextActive]}>다각도 연사</Text>
              {multiAngleShots.length > 0 && (
                <View style={styles.captureModeBadge}>
                  <Text style={styles.captureModeBadgeText}>{multiAngleShots.length}장</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.moodFilterRow}>
            <TouchableOpacity
              style={[styles.moodChip, moodFilter === 'none' && styles.moodChipActive]}
              onPress={() => setMoodFilter('none')}
              activeOpacity={0.7}
            >
              <Text style={[styles.moodChipText, moodFilter === 'none' && styles.moodChipTextActive]}>원본</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moodChip, moodFilter === 'warm' && styles.moodChipActiveWarm]}
              onPress={() => setMoodFilter(moodFilter === 'warm' ? 'none' : 'warm')}
              activeOpacity={0.7}
            >
              <Sun size={12} color={moodFilter === 'warm' ? '#fff' : theme.colors.warning[400]} strokeWidth={2} />
              <Text style={[styles.moodChipText, moodFilter === 'warm' && styles.moodChipTextActive]}>따뜻한 카페</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moodChip, moodFilter === 'fresh' && styles.moodChipActiveFresh]}
              onPress={() => setMoodFilter(moodFilter === 'fresh' ? 'none' : 'fresh')}
              activeOpacity={0.7}
            >
              <Droplet size={12} color={moodFilter === 'fresh' ? '#fff' : theme.colors.primary[300]} strokeWidth={2} />
              <Text style={[styles.moodChipText, moodFilter === 'fresh' && styles.moodChipTextActive]}>청량 푸드</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mood filter overlay */}
        {moodFilter !== 'none' && (
          <View style={[styles.moodOverlay, { backgroundColor: moodOverlayColor }]} pointerEvents="none" />
        )}

        {/* Selected image preview overlay */}
        {selectedImage && (
          <View style={styles.selectedImageOverlay}>
            <Image source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }} style={[styles.selectedImage, moodOverlayStyle]} resizeMode="cover" />
            <TouchableOpacity
              style={styles.clearImageBtn}
              onPress={() => { setSelectedImage(null); setFunnelStage('idle'); setSelectedHook(null); setCustomPrompt(''); }}
              activeOpacity={0.7}
            >
              <X size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Action Area */}
      <View style={[styles.bottomAction, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.md }]}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Capture quality tip */}
        <View style={styles.captureTip}>
          <Info size={14} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.captureTipText}>
            단품 사진 + 측면/디테일 컷을 함께 올리면 분석 정확도가 높아져요!
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

        {/* Gallery button (secondary, full-width) */}
        <TouchableOpacity
          style={styles.galleryBtnFull}
          onPress={handlePickImage}
          disabled={processing}
          activeOpacity={0.7}
        >
          <ImageIcon size={20} color={theme.colors.dark.text} strokeWidth={2} />
          <Text style={styles.galleryBtnFullText}>사진 선택</Text>
        </TouchableOpacity>

        {/* Main capture/generate button (full-width, centered) */}
        <TouchableOpacity
          style={styles.captureBtnFull}
          onPress={hasImage ? handleGenerate : handleCapture}
          disabled={processing || (!hasImage && !cameraReady)}
          activeOpacity={0.85}
        >
          {hasImage ? (
            <>
              <Flame size={26} color="#fff" strokeWidth={2.5} />
              <Text style={styles.captureBtnText}>홍보 만들기 시작</Text>
              <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
            </>
          ) : (
            <>
              <Camera size={28} color="#fff" strokeWidth={2.5} />
              <Text style={styles.captureBtnText}>사진 촬영</Text>
            </>
          )}
        </TouchableOpacity>
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

      {/* Hands-free voice command */}
      <VoiceCommandFloatingButton onCommand={handleVoiceCommand} />

      {/* AI Instant Analysis Funnel */}
      {funnelStage !== 'idle' && selectedImage && (
        <View style={styles.funnelOverlay}>
          <View style={[styles.funnelTopBar, { paddingTop: safeTop + 8 }]}>
            <TouchableOpacity
              style={styles.funnelBackBtn}
              onPress={() => { setFunnelStage('idle'); setSelectedImage(null); setSelectedHook(null); setCustomPrompt(''); }}
              activeOpacity={0.7}
            >
              <X size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.funnelTitle}>AI 인스턴트 분석</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.funnelImageWrap}>
            <Image
              source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }}
              style={styles.funnelImage}
              resizeMode="cover"
            />
            <View style={styles.funnelImageDim} />
          </View>

          {funnelStage === 'analyzing' && (
            <View style={styles.funnelAnalyzing}>
              <ActivityIndicator size="large" color={theme.colors.primary[400]} />
              <Text style={styles.funnelAnalyzingTitle}>AI가 매장 메뉴와 분위기를 분석 중입니다...</Text>
              <Text style={styles.funnelAnalyzingSub}>잠시만 기다려주세요</Text>
            </View>
          )}

          {funnelStage === 'selecting_hook' && (
            <ScrollView
              style={styles.funnelScroll}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: tabBarHeight + bottomInset + theme.spacing.xl }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.funnelHookSection}>
                <View style={styles.funnelSectionHeader}>
                  <Sparkles size={18} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.funnelSectionTitle}>AI 추천 훅 문구</Text>
                </View>
                <Text style={styles.funnelSectionDesc}>원하는 문구를 골라보세요</Text>

                <View style={styles.funnelChipWrap}>
                  {INSTANT_HOOKS.map((hook) => {
                    const Icon = hook.icon;
                    const isSelected = selectedHook === hook.label;
                    return (
                      <TouchableOpacity
                        key={hook.key}
                        style={[styles.funnelChip, isSelected && { backgroundColor: hook.color + '30', borderColor: hook.color }]}
                        onPress={() => { setSelectedHook(isSelected ? null : hook.label); setCustomPrompt(''); }}
                        activeOpacity={0.7}
                      >
                        <Icon size={16} color={hook.color} strokeWidth={2} />
                        <Text style={[styles.funnelChipText, isSelected && { color: hook.color }]}>{hook.label}</Text>
                        {isSelected && <Check size={16} color={hook.color} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Mood filter chips */}
              <View style={styles.funnelMoodSection}>
                <View style={styles.funnelSectionHeader}>
                  <Sun size={18} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.funnelSectionTitle}>매장 분위기 보정</Text>
                </View>
                <Text style={styles.funnelSectionDesc}>어두운 조명이나 탁한 색감을 한 번에 보정하세요</Text>
                <View style={styles.funnelMoodRow}>
                  <TouchableOpacity
                    style={[styles.funnelMoodChip, moodFilter === 'none' && styles.funnelMoodChipActive]}
                    onPress={() => setMoodFilter('none')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.funnelMoodChipText, moodFilter === 'none' && styles.funnelMoodChipTextActive]}>원본</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.funnelMoodChip, moodFilter === 'warm' && styles.funnelMoodChipWarm]}
                    onPress={() => setMoodFilter(moodFilter === 'warm' ? 'none' : 'warm')}
                    activeOpacity={0.7}
                  >
                    <Sun size={14} color={moodFilter === 'warm' ? '#fff' : theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={[styles.funnelMoodChipText, moodFilter === 'warm' && styles.funnelMoodChipTextActive]}>온기 가득 카페 감성</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.funnelMoodChip, moodFilter === 'fresh' && styles.funnelMoodChipFresh]}
                    onPress={() => setMoodFilter(moodFilter === 'fresh' ? 'none' : 'fresh')}
                    activeOpacity={0.7}
                  >
                    <Droplet size={14} color={moodFilter === 'fresh' ? '#fff' : theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={[styles.funnelMoodChipText, moodFilter === 'fresh' && styles.funnelMoodChipTextActive]}>신선함 청량 푸드</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.funnelManualToggle}
                onPress={() => setManualPromptOpen((v) => !v)}
                activeOpacity={0.7}
              >
                <PenLine size={18} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.funnelManualToggleText}>직접 프롬프트/문구 입력하기</Text>
                <ChevronDown
                  size={18}
                  color={theme.colors.dark.textDim}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: manualPromptOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {manualPromptOpen && (
                <View style={styles.funnelManualInput}>
                  <TextInput
                    style={styles.funnelTextInput}
                    placeholder="예: 숯불돈까스 9천원, 매일 오픈런"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    value={customPrompt}
                    onChangeText={setCustomPrompt}
                    multiline
                    maxLength={200}
                  />
                  {customPrompt.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomPrompt('')} activeOpacity={0.7} style={styles.funnelClearPrompt}>
                      <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.funnelGenerateBtn, (!selectedHook && !customPrompt.trim()) && styles.funnelGenerateBtnDisabled]}
                onPress={handleGenerate}
                disabled={processing || (!selectedHook && !customPrompt.trim())}
                activeOpacity={0.85}
              >
                <Flame size={24} color="#fff" strokeWidth={2.5} />
                <Text style={styles.funnelGenerateBtnText}>홍보 만들기 시작</Text>
                <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

interface WebSimpleScreenProps {
  selectedImage: string | null;
  selectedImageMime: string;
  multiAngleCount: number;
  captureMode: 'single' | 'multi';
  moodFilter: 'none' | 'warm' | 'fresh';
  onCaptureModeToggle: () => void;
  onMoodFilterChange: (m: 'none' | 'warm' | 'fresh') => void;
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
  captureMode,
  moodFilter,
  onCaptureModeToggle,
  onMoodFilterChange,
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
          <Text style={styles.webHeroTitle}>매장 홍보 숏폼 만들기</Text>
          <Text style={styles.webHeroSub}>
            사진 한 장으로 매장 홍보 숏폼을 만들어요
          </Text>
        </View>

        {/* Capture quality tip */}
        <View style={styles.webCaptureTip}>
          <Info size={16} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.webCaptureTipText}>
            단품 사진 + 측면/디테일 컷을 함께 올리면 분석 정확도가 높아져요!
          </Text>
        </View>

        {/* Selected image preview */}
        {selectedImage && (
          <View style={styles.webImagePreview}>
            <Image
              source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }}
              style={[
                styles.webPreviewImg,
                moodFilter === 'warm' && { tintColor: 'rgba(255,180,80,0.1)' },
                moodFilter === 'fresh' && { tintColor: 'rgba(100,200,220,0.1)' },
              ]}
              resizeMode="contain"
            />
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
          <Text style={styles.webGenerateBtnText}>홍보 만들기 시작</Text>
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
  galleryBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.sm,
  },
  galleryBtnFullText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  captureBtnFull: {
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
  funnelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.dark.bg,
    zIndex: 200,
  },
  funnelTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
  },
  funnelBackBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  funnelTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  funnelImageWrap: {
    width: '100%',
    height: 200,
    position: 'relative',
    marginTop: theme.spacing.sm,
  },
  funnelImage: {
    width: '100%',
    height: '100%',
  },
  funnelImageDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 18, 0.3)',
  },
  funnelAnalyzing: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  funnelAnalyzingTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  funnelAnalyzingSub: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  funnelScroll: {
    flex: 1,
  },
  funnelHookSection: {
    marginTop: theme.spacing.lg,
  },
  funnelSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  funnelSectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  funnelSectionDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.md,
  },
  funnelChipWrap: {
    gap: 8,
  },
  funnelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  funnelChipText: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  funnelManualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  funnelManualToggleText: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  funnelManualInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  funnelTextInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 40,
    maxHeight: 100,
  },
  funnelClearPrompt: {
    padding: 4,
  },
  funnelGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.radius.lg,
    marginTop: theme.spacing.lg,
  },
  funnelGenerateBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  funnelGenerateBtnText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  funnelMoodSection: {
    marginTop: theme.spacing.lg,
  },
  funnelMoodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  funnelMoodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  funnelMoodChipActive: {
    backgroundColor: theme.colors.dark.surface,
    borderColor: theme.colors.dark.text,
  },
  funnelMoodChipWarm: {
    backgroundColor: theme.colors.warning[500],
    borderColor: theme.colors.warning[400],
  },
  funnelMoodChipFresh: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[400],
  },
  funnelMoodChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  funnelMoodChipTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 18, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  cameraExtraControls: {
    position: 'absolute',
    top: 112,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    gap: 8,
  },
  captureModeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
    borderRadius: theme.radius.full,
    padding: 4,
    gap: 4,
  },
  captureModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  captureModeBtnActive: {
    backgroundColor: theme.colors.primary[600],
  },
  captureModeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  captureModeTextActive: {
    color: '#fff',
  },
  captureModeBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  captureModeBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  moodFilterRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  moodChipActive: {
    backgroundColor: theme.colors.dark.surface,
  },
  moodChipActiveWarm: {
    backgroundColor: theme.colors.warning[500],
  },
  moodChipActiveFresh: {
    backgroundColor: theme.colors.primary[500],
  },
  moodChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  moodChipTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  moodOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  // Web capture mode + mood styles
  webCaptureModeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 4,
    marginBottom: theme.spacing.sm,
  },
  webMoodFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
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
