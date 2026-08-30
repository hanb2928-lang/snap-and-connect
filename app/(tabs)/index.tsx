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
import { Camera, Image as ImageIcon, Flame, ArrowRight, Settings, Sparkles, RotateCcw, Grid3x3, Zap, ZapOff, X, Layers, Sun, Droplet, PenLine, Check, ChevronDown, TrendingUp, Tag, Store } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '@/lib/theme';
import { startAsyncAnalysis } from '@/lib/asyncAnalysis';
import { isOnline } from '@/hooks/useNetworkStatus';
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
import { WebCameraView, type CaptureModeType } from '@/components/WebCameraView';
import { MultiAngleCaptureGuide, type AngleShot } from '@/components/MultiAngleCaptureGuide';
import { VoiceCommandFloatingButton } from '@/components/VoiceCommandFloatingButton';
import { TriggerBanner } from '@/components/TriggerBanner';
import type { ParsedVoiceCommand } from '@/hooks/useVoiceCommand';

const CAPTURE_TIMEOUT_MS = 15000;
const PICK_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 45000;

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

const MAX_PROMPT_LENGTH = 200;

function sanitizeTextInput(raw: string, maxLength: number): string {
  return raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLength);
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
  const autoSaveStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSavePulse = useSharedValue(1);
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
  const [captureMode, setCaptureMode] = useState<CaptureModeType>('oneclick');
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);
  const [autoSaveStep, setAutoSaveStep] = useState(1);
  const [moodFilter, setMoodFilter] = useState<'none' | 'warm' | 'fresh'>('none');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [funnelStage, setFunnelStage] = useState<'idle' | 'analyzing' | 'selecting_hook'>('idle');
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [manualPromptOpen, setManualPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const fadeAnim = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const genIdRef = useRef(0);

  // Auto-save step animation: cycle 1→2→3 every 800ms, pulse the icon
  const startAutoSaveAnimation = useCallback(() => {
    setAutoSaveStep(1);
    autoSavePulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
    autoSaveStepTimer.current = setInterval(() => {
      setAutoSaveStep((s) => (s >= 3 ? 3 : s + 1));
    }, 800);
  }, [autoSavePulse]);
  const stopAutoSaveAnimation = useCallback(() => {
    if (autoSaveStepTimer.current) {
      clearInterval(autoSaveStepTimer.current);
      autoSaveStepTimer.current = null;
    }
    autoSavePulse.value = 1;
  }, [autoSavePulse]);

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      setIsActive(true);
      return () => {
        isMountedRef.current = false;
        setIsActive(false);
        setCameraReady(false);
        setProcessing(false);
        setAutoSaving(false);
        genIdRef.current += 1;
        stopAutoSaveAnimation();
        cancelAnimation(progressWidth);
        cancelAnimation(fadeAnim);
        cancelAnimation(autoSavePulse);
      };
    }, [stopAutoSaveAnimation, progressWidth, fadeAnim, autoSavePulse]),
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
    if (!cameraRef.current || processing || !cameraReady || autoSaving) return;

    // multi mode: open multi-angle guide instead of single capture
    if (captureMode === 'multi') {
      setMultiAngleVisible(true);
      return;
    }

    // oneclick mode: capture + auto-save in one step, skip funnel
    if (captureMode === 'oneclick') {
      if (!isOnline()) {
        setError('네트워크 연결을 확인해주세요. 인터넷이 연결되지 않아 AI 분석을 시작할 수 없습니다.');
        return;
      }
      const genId = genIdRef.current;
      let retryB64: string | null = null;
      let retryMime: string | null = null;
      setAutoSaving(true);
      setAutoSaveToast(null);
      startAutoSaveAnimation();
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
        if (genIdRef.current !== genId) return; // mode changed mid-capture
        if (!photo?.base64) throw new Error('Failed to capture image data');
        const cleanB64 = cleanBase64(photo.base64);
        const compressedDataUrl = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        if (!isMountedRef.current || genIdRef.current !== genId) return;
        const compressedB64 = cleanBase64(compressedDataUrl);
        const compressedMime = getMimeTypeFromDataUrl(compressedDataUrl);
        retryB64 = compressedB64;
        retryMime = compressedMime;
        setError(null);

        const { scanId } = await withTimeout(
          startAsyncAnalysis(compressedB64, compressedMime, 'single', []),
          ANALYSIS_TIMEOUT_MS,
          'AI 자동 분석',
        );
        if (genIdRef.current !== genId) return; // mode changed during AI analysis
        setAutoSaveToast('숏폼 영상이 보관함에 자동 저장되었습니다!');
        setTimeout(() => setAutoSaveToast(null), 3500);
        router.push({ pathname: '/result/[id]', params: { id: scanId } });
      } catch (err) {
        if (!isMountedRef.current || genIdRef.current !== genId) return;
        const isTimeout = err instanceof Error && (err.message.includes('시간 초과') || err.message.includes('timeout'));
        if (isTimeout && retryB64) {
          try {
            await setItem('pending_retry_image', retryB64);
            await setItem('pending_retry_mime', retryMime || 'image/jpeg');
          } catch { /* ignore */ }
          setError('네트워크 연결이 원활하지 않습니다. 사진을 임시 저장했습니다. 연결이 복구되면 다시 시도해 주세요.');
        } else {
          setError(friendlyError(err, 'AI 자동 분석 중 오류가 발생했습니다. 다시 시도해주세요.'));
        }
      } finally {
        if (genIdRef.current === genId) {
          stopAutoSaveAnimation();
          setAutoSaving(false);
        }
      }
      return;
    }

    // single mode: normal capture → preview
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
    if (!isOnline()) {
      setError('네트워크 연결을 확인해주세요. 인터넷이 연결되지 않아 AI 분석을 시작할 수 없습니다.');
      return;
    }
    const genId = genIdRef.current;
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      setProgressStep(1);
      setProgressText('📸 매장 사진 비전 분석 중... (AI가 메뉴 및 공간 인식)');
      progressWidth.value = withTiming(0.3, { duration: 500 });

      progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      // Sort by orderIndex to guarantee front=main, rest=additional
      const sortedShots = [...multiAngleShots].sort((a, b) => a.orderIndex - b.orderIndex);
      const additionalB64s = sortedShots.slice(1).map((s) => s.base64).filter(Boolean) as string[];
      const { scanId } = await withTimeout(
        startAsyncAnalysis(base64, mimeType, additionalB64s.length > 0 ? 'multi' : 'single', additionalB64s),
        ANALYSIS_TIMEOUT_MS,
        'AI 분석',
      );

      if (genIdRef.current !== genId) return; // mode changed during analysis
      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

      setProgressStep(2);
      setProgressText('✨ 인싸 감성 훅 문구 및 템플릿 매칭 중...');
      progressWidth.value = withTiming(0.7, { duration: 300 });

      setProgressStep(3);
      setProgressText('🚀 숏폼 영상 렌더링 및 보관함 저장 완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      if (!isMountedRef.current || genIdRef.current !== genId) return;
      const isTimeout = err instanceof Error && (err.message.includes('시간 초과') || err.message.includes('timeout'));
      if (isTimeout) {
        try {
          await setItem('pending_retry_image', base64);
          await setItem('pending_retry_mime', mimeType);
        } catch { /* ignore */ }
        setError('네트워크 연결이 원활하지 않습니다. 사진을 임시 저장했습니다. 연결이 복구되면 다시 시도해 주세요.');
      } else {
        setError(friendlyError(err, '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      }
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
    setProgressText('📸 매장 사진 비전 분석 중...');
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
    // Sort by orderIndex to guarantee front (0) → side (1) → detail (2) ordering
    const sorted = [...shots].sort((a, b) => a.orderIndex - b.orderIndex);
    setMultiAngleShots(sorted);
    setMultiAngleVisible(false);
    if (sorted[0]?.base64) {
      setSelectedImage(sorted[0].base64);
      setSelectedImageMime(sorted[0].mimeType || 'image/jpeg');
      setSelectedHook(null);
      setCustomPrompt('');
      setManualPromptOpen(false);
      setFunnelStage('analyzing');
    }
  };

  const handleCaptureModeChange = (mode: CaptureModeType) => {
    if (mode === captureMode) return;
    // Invalidate any in-flight async operations from the previous mode
    genIdRef.current += 1;
    setAutoSaving(false);
    stopAutoSaveAnimation();
    setCaptureMode(mode);
    // Reset all capture-related state to prevent mode-to-mode state leak
    setSelectedImage(null);
    setSelectedImageMime('image/jpeg');
    setPreviewCapture(null);
    setFunnelStage('idle');
    setSelectedHook(null);
    setCustomPrompt('');
    setManualPromptOpen(false);
    setMoodFilter('none');
    setError(null);
    setMultiAngleShots([]);
    if (mode === 'multi') {
      setMultiAngleVisible(true);
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

  const handleMultiAngleCapture = async (_angleId: string): Promise<{ base64: string; mimeType: string } | null> => {
    if (!cameraRef.current || !cameraReady) return null;
    try {
      const photo = await withTimeout(
        cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
          shutterSound: false,
          ...({ mute: true } as Record<string, unknown>),
        }) as Promise<{ base64?: string; uri: string }>,
        CAPTURE_TIMEOUT_MS,
        '다각도 촬영',
      );
      if (!photo?.base64) return null;
      const cleanB64 = cleanBase64(photo.base64);
      const compressedDataUrl = await withTimeout(
        prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7),
        PICK_TIMEOUT_MS,
        '이미지 압축',
      );
      return { base64: cleanBase64(compressedDataUrl), mimeType: getMimeTypeFromDataUrl(compressedDataUrl) };
    } catch {
      return null;
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

  const handleWebCapture = async (base64: string, mimeType: string) => {
    // oneclick mode: auto-save to 보관함 in background, show toast, skip funnel
    if (captureMode === 'oneclick') {
      if (!isOnline()) {
        setError('네트워크 연결을 확인해주세요. 인터넷이 연결되지 않아 AI 분석을 시작할 수 없습니다.');
        return;
      }
      const genId = genIdRef.current;
      setAutoSaving(true);
      setAutoSaveToast(null);
      startAutoSaveAnimation();
      try {
        const { scanId } = await withTimeout(
          startAsyncAnalysis(base64, mimeType, 'single', []),
          ANALYSIS_TIMEOUT_MS,
          'AI 자동 분석',
        );
        if (genIdRef.current !== genId) return; // mode changed during analysis
        setAutoSaveToast('숏폼 영상이 보관함에 자동 저장되었습니다!');
        setTimeout(() => setAutoSaveToast(null), 3500);
        router.push({ pathname: '/result/[id]', params: { id: scanId } });
      } catch (err) {
        if (genIdRef.current !== genId) return;
        const isTimeout = err instanceof Error && (err.message.includes('시간 초과') || err.message.includes('timeout'));
        if (isTimeout) {
          try {
            await setItem('pending_retry_image', base64);
            await setItem('pending_retry_mime', mimeType);
          } catch { /* ignore */ }
          setError('네트워크 연결이 원활하지 않습니다. 사진을 임시 저장했습니다. 연결이 복구되면 다시 시도해 주세요.');
        } else {
          setError(friendlyError(err, 'AI 자동 분석 중 오류가 발생했습니다. 다시 시도해주세요.'));
        }
      } finally {
        if (genIdRef.current === genId) {
          stopAutoSaveAnimation();
          setAutoSaving(false);
        }
      }
      return;
    }
    // single mode: go to funnel for hook selection
    setSelectedImage(base64);
    setSelectedImageMime(mimeType);
    setSelectedHook(null);
    setCustomPrompt('');
    setManualPromptOpen(false);
    setMultiAngleShots([]);
    setFunnelStage('analyzing');
  };

  const hasImage = selectedImage || previewCapture?.base64;

  if (isWebPlatform()) {
    return (
      <WebCameraScreen
        selectedImage={selectedImage}
        selectedImageMime={selectedImageMime}
        multiAngleCount={multiAngleShots.length}
        captureMode={captureMode}
        moodFilter={moodFilter}
        onCaptureModeChange={handleCaptureModeChange}
        onMoodFilterChange={setMoodFilter}
        onPickImage={handlePickImage}
        onWebCapture={handleWebCapture}
        onGenerate={handleGenerate}
        onMultiAnglePress={() => setMultiAngleVisible(true)}
        onSettingsPress={() => router.push('/settings' as never)}
        onCreditPress={() => setCreditModalVisible(true)}
        processing={processing}
        autoSaving={autoSaving}
        autoSaveToast={autoSaveToast}
        autoSaveStep={autoSaveStep}
        error={error}
        progressStep={progressStep}
        progressText={progressText}
        progressWidth={progressWidth}
        fadeIn={fadeIn}
        overlayStyle={overlayStyle}
        safeTop={safeTop}
        tabBarHeight={tabBarHeight}
        bottomInset={bottomInset}
        isActive={isActive}
        funnelStage={funnelStage}
        selectedHook={selectedHook}
        onSelectHook={setSelectedHook}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
        manualPromptOpen={manualPromptOpen}
        onToggleManualPrompt={() => setManualPromptOpen((v) => !v)}
        onClearImage={() => { setSelectedImage(null); setFunnelStage('idle'); setSelectedHook(null); setCustomPrompt(''); }}
        onDismissFunnel={() => { setFunnelStage('idle'); setSelectedImage(null); setSelectedHook(null); setCustomPrompt(''); }}
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
      {/* Top Bar: Settings (left) + Flash & Flip (right) */}
      <View style={[styles.topBar, { top: safeTop + 8 }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => router.push('/settings' as never)}
            activeOpacity={0.7}
          >
            <Settings size={22} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
          <CreditBalanceBadge onPress={() => setCreditModalVisible(true)} compact />
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))}
            activeOpacity={0.7}
          >
            {flash === 'on' ? (
              <Zap size={20} color={theme.colors.warning[400]} strokeWidth={2} />
            ) : flash === 'auto' ? (
              <View style={styles.flashAutoWrap}>
                <Zap size={18} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.flashAutoLabel}>A</Text>
              </View>
            ) : (
              <ZapOff size={20} color="#fff" strokeWidth={2} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => { setCameraReady(false); setFacing((f) => (f === 'back' ? 'front' : 'back')); }}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Unified Trigger Banner (Weather + Inventory + Breaktime alerts) */}
      <TriggerBanner />

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

        {/* Mood filter overlay */}
        {moodFilter !== 'none' && (
          <View style={[styles.moodOverlay, { backgroundColor: moodOverlayColor }]} pointerEvents="none" />
        )}

        {/* Selected image preview overlay */}
        {selectedImage && (
          <View style={styles.selectedImageOverlay}>
            <Image source={{ uri: `data:${selectedImageMime};base64,${selectedImage}` }} style={[styles.selectedImage, moodOverlayStyle]} resizeMode="cover" />
            <TouchableOpacity
              style={[styles.clearImageBtn, { top: safeTop + 56 }]}
              onPress={() => { setSelectedImage(null); setFunnelStage('idle'); setSelectedHook(null); setCustomPrompt(''); }}
              activeOpacity={0.7}
            >
              <X size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Camera Bar — Instagram style */}
      <View style={[styles.bottomBar, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.sm }]}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Capture mode segment — 3 modes */}
        <View style={styles.modeSegmentWrap}>
          <View style={styles.modeSegment}>
            <TouchableOpacity
              style={[styles.modeSegmentBtn, captureMode === 'oneclick' && styles.modeSegmentBtnActive, (processing || autoSaving) && styles.modeSegmentBtnDisabled]}
              onPress={() => handleCaptureModeChange('oneclick')}
              disabled={processing || autoSaving}
              activeOpacity={0.7}
            >
              <Zap size={13} color={captureMode === 'oneclick' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.modeSegmentText, captureMode === 'oneclick' && styles.modeSegmentTextActive]}>원클릭</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeSegmentBtn, captureMode === 'single' && styles.modeSegmentBtnActive, (processing || autoSaving) && styles.modeSegmentBtnDisabled]}
              onPress={() => handleCaptureModeChange('single')}
              disabled={processing || autoSaving}
              activeOpacity={0.7}
            >
              <Camera size={13} color={captureMode === 'single' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.modeSegmentText, captureMode === 'single' && styles.modeSegmentTextActive]}>1장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeSegmentBtn, captureMode === 'multi' && styles.modeSegmentBtnActive, (processing || autoSaving) && styles.modeSegmentBtnDisabled]}
              onPress={() => handleCaptureModeChange('multi')}
              disabled={processing || autoSaving}
              activeOpacity={0.7}
            >
              <Layers size={13} color={captureMode === 'multi' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.modeSegmentText, captureMode === 'multi' && styles.modeSegmentTextActive]}>다각도</Text>
              {multiAngleShots.length > 0 && (
                <View style={styles.modeSegmentBadge}>
                  <Text style={styles.modeSegmentBadgeText}>{multiAngleShots.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom controls row: Gallery | Shutter | Grid */}
        <View style={styles.bottomControlsRow}>
          {/* Gallery thumbnail (left) */}
          <TouchableOpacity
            style={styles.galleryThumb}
            onPress={handlePickImage}
            disabled={processing}
            activeOpacity={0.8}
          >
            <ImageIcon size={22} color="#fff" strokeWidth={2} />
          </TouchableOpacity>

          {/* Shutter button (center) */}
          <TouchableOpacity
            style={[
              styles.shutterBtn,
              hasImage && styles.shutterBtnGenerate,
              (!hasImage && !cameraReady) && styles.shutterBtnDisabled,
              captureMode === 'oneclick' && !hasImage && styles.shutterBtnOneclickMobile,
              (autoSaving || processing) && styles.shutterBtnCapturing,
            ]}
            onPress={hasImage ? handleGenerate : handleCapture}
            disabled={processing || autoSaving || (!hasImage && !cameraReady)}
            activeOpacity={0.85}
          >
            {hasImage ? (
              <Flame size={28} color="#fff" strokeWidth={2.5} />
            ) : captureMode === 'oneclick' ? (
              <Zap size={30} color="#fff" strokeWidth={2.5} />
            ) : (
              <Camera size={30} color="#fff" strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          {/* Grid toggle (right) */}
          <TouchableOpacity
            style={styles.gridToggleBtn}
            onPress={() => setGridVisible((g) => !g)}
            activeOpacity={0.7}
          >
            {gridVisible ? (
              <Grid3x3 size={24} color={theme.colors.primary[400]} strokeWidth={2} />
            ) : (
              <Grid3x3 size={24} color="#fff" strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>

        {/* Generate hint text */}
        {hasImage && (
          <Text style={styles.shutterHintText}>홍보 만들기 시작</Text>
        )}
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
        onCaptureImage={handleMultiAngleCapture}
      />

      {/* Auto-save toast (mobile) */}
      {autoSaveToast && (
        <View style={styles.autoSaveToastWrap}>
          <View style={styles.autoSaveToastInner}>
            <Check size={18} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.autoSaveToastText}>{autoSaveToast}</Text>
          </View>
        </View>
      )}

      {/* Auto-saving overlay (mobile oneclick) */}
      {autoSaving && (
        <View style={styles.autoSavingOverlay}>
          <View style={styles.autoSavingCard}>
            <Animated.View style={{ transform: [{ scale: autoSavePulse }] }}>
              <Sparkles size={28} color={theme.colors.primary[400]} strokeWidth={2} />
            </Animated.View>
            <Text style={styles.autoSavingTitle}>AI가 메뉴를 분석 중입니다</Text>
            <View style={styles.autoSavingStepRow}>
              <View style={[styles.autoSavingStepDot, autoSaveStep >= 1 && styles.autoSavingStepDotActive]} />
              <View style={[styles.autoSavingStepDot, autoSaveStep >= 2 && styles.autoSavingStepDotActive]} />
              <View style={[styles.autoSavingStepDot, autoSaveStep >= 3 && styles.autoSavingStepDotActive]} />
            </View>
            <Text style={styles.autoSavingSub}>
              {autoSaveStep === 1 ? '사진 촬영 완료! 메뉴 인식 중...' :
               autoSaveStep === 2 ? 'AI 비전 분석 중, 숏폼 생성 준비 중...' :
               '보관함에 자동 저장 중, 거의 다 됐어요!'}
            </Text>
          </View>
        </View>
      )}

      {/* Processing overlay */}
      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['비전 분석', '훅 매칭', '렌더링']}
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
                    onChangeText={(t) => setCustomPrompt(sanitizeTextInput(t, MAX_PROMPT_LENGTH))}
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

interface WebCameraScreenProps {
  selectedImage: string | null;
  selectedImageMime: string;
  multiAngleCount: number;
  captureMode: CaptureModeType;
  moodFilter: 'none' | 'warm' | 'fresh';
  onCaptureModeChange: (mode: CaptureModeType) => void;
  onMoodFilterChange: (m: 'none' | 'warm' | 'fresh') => void;
  onPickImage: () => void;
  onWebCapture: (base64: string, mimeType: string) => void;
  onGenerate: () => void;
  onMultiAnglePress: () => void;
  onSettingsPress: () => void;
  onCreditPress: () => void;
  processing: boolean;
  autoSaving: boolean;
  autoSaveToast: string | null;
  autoSaveStep: number;
  error: string | null;
  progressStep: number;
  progressText: string;
  progressWidth: ReturnType<typeof useSharedValue<number>>;
  fadeIn: () => void;
  overlayStyle: ReturnType<typeof useAnimatedStyle>;
  safeTop: number;
  tabBarHeight: number;
  bottomInset: number;
  isActive: boolean;
  funnelStage: 'idle' | 'analyzing' | 'selecting_hook';
  selectedHook: string | null;
  onSelectHook: (h: string | null) => void;
  customPrompt: string;
  onCustomPromptChange: (s: string) => void;
  manualPromptOpen: boolean;
  onToggleManualPrompt: () => void;
  onClearImage: () => void;
  onDismissFunnel: () => void;
}

function WebCameraScreen({
  selectedImage,
  selectedImageMime,
  multiAngleCount,
  captureMode,
  moodFilter,
  onCaptureModeChange,
  onMoodFilterChange,
  onPickImage,
  onWebCapture,
  onGenerate,
  onMultiAnglePress,
  onSettingsPress,
  onCreditPress,
  processing,
  autoSaving,
  autoSaveToast,
  autoSaveStep,
  error,
  progressStep,
  progressText,
  progressWidth,
  fadeIn,
  overlayStyle,
  safeTop,
  tabBarHeight,
  bottomInset,
  isActive,
  funnelStage,
  selectedHook,
  onSelectHook,
  customPrompt,
  onCustomPromptChange,
  manualPromptOpen,
  onToggleManualPrompt,
  onClearImage,
  onDismissFunnel,
}: WebCameraScreenProps) {
  const moodOverlayColor =
    moodFilter === 'warm' ? 'rgba(255, 180, 80, 0.12)' :
    moodFilter === 'fresh' ? 'rgba(100, 200, 220, 0.12)' :
    'transparent';

  // When an image is selected, show the funnel (same as mobile)
  if (selectedImage && funnelStage !== 'idle') {
    return (
      <View style={styles.container}>
        {/* Funnel top bar */}
        <View style={[styles.funnelTopBar, { paddingTop: safeTop + 8 }]}>
          <TouchableOpacity style={styles.funnelBackBtn} onPress={onDismissFunnel} activeOpacity={0.7}>
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
          <TouchableOpacity
            style={[styles.clearImageBtn, { top: safeTop + 56 }]}
            onPress={onClearImage}
            activeOpacity={0.7}
          >
            <X size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
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
                      onPress={() => { onSelectHook(isSelected ? null : hook.label); onCustomPromptChange(''); }}
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
                  onPress={() => onMoodFilterChange('none')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.funnelMoodChipText, moodFilter === 'none' && styles.funnelMoodChipTextActive]}>원본</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.funnelMoodChip, moodFilter === 'warm' && styles.funnelMoodChipWarm]}
                  onPress={() => onMoodFilterChange(moodFilter === 'warm' ? 'none' : 'warm')}
                  activeOpacity={0.7}
                >
                  <Sun size={14} color={moodFilter === 'warm' ? '#fff' : theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={[styles.funnelMoodChipText, moodFilter === 'warm' && styles.funnelMoodChipTextActive]}>온기 가득 카페 감성</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.funnelMoodChip, moodFilter === 'fresh' && styles.funnelMoodChipFresh]}
                  onPress={() => onMoodFilterChange(moodFilter === 'fresh' ? 'none' : 'fresh')}
                  activeOpacity={0.7}
                >
                  <Droplet size={14} color={moodFilter === 'fresh' ? '#fff' : theme.colors.primary[300]} strokeWidth={2} />
                  <Text style={[styles.funnelMoodChipText, moodFilter === 'fresh' && styles.funnelMoodChipTextActive]}>신선함 청량 푸드</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.funnelManualToggle} onPress={onToggleManualPrompt} activeOpacity={0.7}>
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
                  onChangeText={(t) => onCustomPromptChange(sanitizeTextInput(t, MAX_PROMPT_LENGTH))}
                  multiline
                  maxLength={200}
                />
                {customPrompt.length > 0 && (
                  <TouchableOpacity onPress={() => onCustomPromptChange('')} activeOpacity={0.7} style={styles.funnelClearPrompt}>
                    <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.funnelGenerateBtn, (!selectedHook && !customPrompt.trim()) && styles.funnelGenerateBtnDisabled]}
              onPress={onGenerate}
              disabled={processing || (!selectedHook && !customPrompt.trim())}
              activeOpacity={0.85}
            >
              <Flame size={24} color="#fff" strokeWidth={2.5} />
              <Text style={styles.funnelGenerateBtnText}>홍보 만들기 시작</Text>
              <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </ScrollView>
        )}

        {processing && (
          <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
            <ProgressOverlay
              progressSV={progressWidth}
              step={progressStep as 0 | 1 | 2 | 3}
              text={progressText}
              stepLabels={['업로드', '비전 분석', '렌더링']}
            />
          </Animated.View>
        )}
      </View>
    );
  }

  // No image selected yet — show live camera viewfinder
  return (
    <View style={styles.container}>
      {/* Top bar with settings + credits */}
      <View style={[styles.topBar, { top: safeTop + 8 }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.topBarBtn} onPress={onSettingsPress} activeOpacity={0.7}>
            <Settings size={22} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
          <CreditBalanceBadge onPress={onCreditPress} compact />
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity style={styles.topBarBtn} onPress={onMultiAnglePress} activeOpacity={0.7}>
            <Layers size={20} color="#fff" strokeWidth={2} />
            {multiAngleCount > 0 && (
              <View style={styles.webAngleBadge}>
                <Text style={styles.webAngleBadgeText}>{multiAngleCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <TriggerBanner />

      {/* Live camera viewfinder */}
      <View style={styles.cameraPreviewWrap}>
        <WebCameraView
          onCapture={onWebCapture}
          onPickImage={onPickImage}
          isActive={isActive}
          safeTop={safeTop}
          tabBarHeight={tabBarHeight}
          bottomInset={bottomInset}
          captureMode={captureMode}
          onCaptureModeChange={onCaptureModeChange}
          autoSaving={autoSaving}
          autoSaveToast={autoSaveToast}
          autoSaveStep={autoSaveStep}
          onMultiAnglePress={onMultiAnglePress}
        />

        {/* Mood filter overlay */}
        {moodFilter !== 'none' && (
          <View style={[styles.moodOverlay, { backgroundColor: moodOverlayColor }]} pointerEvents="none" />
        )}
      </View>

      {error && (
        <View style={[styles.bottomBar, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.sm }]}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      )}

      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['비전 분석', '훅 매칭', '렌더링']}
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
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  topBarBtn: {
    width: 40,
    height: 40,
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
    top: 56,
    right: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    backgroundColor: 'rgba(5, 8, 18, 0.85)',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
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
  modeSegmentWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  modeSegment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    borderRadius: theme.radius.full,
    padding: 3,
    gap: 3,
  },
  modeSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  modeSegmentBtnActive: {
    backgroundColor: theme.colors.primary[600],
  },
  modeSegmentBtnDisabled: {
    opacity: 0.4,
  },
  modeSegmentText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modeSegmentTextActive: {
    color: '#fff',
  },
  modeSegmentBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  modeSegmentBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  galleryThumb: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  shutterBtnGenerate: {
    backgroundColor: theme.colors.accent[500],
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  shutterBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shutterBtnCapturing: {
    opacity: 0.6,
  },
  shutterBtnOneclickMobile: {
    backgroundColor: theme.colors.warning[500],
  },
  // Auto-save toast (mobile)
  autoSaveToastWrap: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 150,
  },
  autoSaveToastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  autoSaveToastText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  // Auto-saving overlay (mobile oneclick)
  autoSavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 8, 18, 0.7)',
    zIndex: 140,
  },
  autoSavingCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    maxWidth: 320,
  },
  autoSavingTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  autoSavingSub: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  autoSavingStepRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  autoSavingStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  autoSavingStepDotActive: {
    backgroundColor: theme.colors.primary[400],
  },
  gridToggleBtn: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(10, 15, 30, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterHintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    marginTop: 4,
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
  webAngleBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  webAngleBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
