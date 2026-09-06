import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { Camera, Zap, Layers, RotateCcw, X, Check, Sparkles, ArrowRight, Image as ImageIcon, Square } from 'lucide-react-native';
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
import type { MoodFilterType } from '@/lib/imageEdit';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { OnboardingModal } from '@/components/OnboardingModal';
import { CreditBalanceBadge } from '@/components/CreditBalanceBadge';
import { CreditPurchaseModal } from '@/components/CreditPurchaseModal';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import { WebCameraView, type CaptureModeType } from '@/components/WebCameraView';
import { MultiAngleCaptureGuide, type AngleShot } from '@/components/MultiAngleCaptureGuide';
import { TriggerBanner } from '@/components/TriggerBanner';
import { PostCaptureWorkflow } from '@/components/PostCaptureWorkflow';
import type { UploadPlatformKey } from '@/lib/platformUpload';
import type { ShortFormEditPlan } from '@/lib/shortFormEditEngine';

const CAPTURE_TIMEOUT_MS = 15000;
const PICK_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 45000;
const ONECLICK_RECORD_MAX_S = 15;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} (시간 초과)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type ScreenPhase = 'mode_select' | 'camera';

export default function CameraScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const safeInsets = useSafeAreaInsets();
  const bottomInset = Math.max(safeInsets.bottom, 0);
  const isMountedRef = useRef(true);
  const cameraRef = useRef<CameraView>(null);
  const autoSaveStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSavePulse = useSharedValue(1);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [multiAngleVisible, setMultiAngleVisible] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureModeType>('oneclick');
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);
  const [autoSaveStep, setAutoSaveStep] = useState(1);
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>('mode_select');
  const genIdRef = useRef(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordElapsed, setRecordElapsed] = useState(0);
  const [postCaptureVisible, setPostCaptureVisible] = useState(false);
  const [postCaptureVideoUri, setPostCaptureVideoUri] = useState<string | null>(null);
  const [postCaptureBase64, setPostCaptureBase64] = useState<string | null>(null);
  const [postCaptureMime, setPostCaptureMime] = useState<string>('video/webm');

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
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        genIdRef.current += 1;
        stopAutoSaveAnimation();
        cancelAnimation(autoSavePulse);
      };
    }, [stopAutoSaveAnimation, autoSavePulse]),
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

  const runAutoAnalysis = useCallback(async (base64: string, mimeType: string, additionalB64s: string[] = []) => {
    if (!isOnline()) {
      setError('네트워크 연결을 확인해주세요. 인터넷이 연결되지 않아 AI 분석을 시작할 수 없습니다.');
      return;
    }
    const genId = genIdRef.current;
    setAutoSaving(true);
    setAutoSaveToast(null);
    setError(null);
    startAutoSaveAnimation();
    try {
      const { scanId } = await withTimeout(
        startAsyncAnalysis(base64, mimeType, additionalB64s.length > 0 ? 'multi' : 'single', additionalB64s),
        ANALYSIS_TIMEOUT_MS,
        'AI 자동 분석',
      );
      if (genIdRef.current !== genId) return;
      setAutoSaveToast('숏폼 영상이 보관함에 자동 저장되었습니다!');
      setTimeout(() => setAutoSaveToast(null), 3500);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      if (!isMountedRef.current || genIdRef.current !== genId) return;
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
  }, [router, startAutoSaveAnimation, stopAutoSaveAnimation]);

  const stopRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    if (!cameraRef.current) return;
    try {
      await cameraRef.current.stopRecording();
    } catch {
      // already stopped
    }
  }, []);

  const handleVideoRecorded = useCallback(async (videoUri: string) => {
    setPostCaptureVideoUri(videoUri);
    setPostCaptureBase64(null);
    setPostCaptureMime('video/webm');
    setPostCaptureVisible(true);
  }, []);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isRecording) return;
    try {
      setIsRecording(true);
      setRecordElapsed(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordElapsed((s) => {
          if (s + 1 >= ONECLICK_RECORD_MAX_S) {
            stopRecording();
          }
          return s + 1;
        });
      }, 1000);
      const video = await cameraRef.current.recordAsync({
        maxDuration: ONECLICK_RECORD_MAX_S,
        ...({ mute: true } as Record<string, unknown>),
      }) as { uri: string } | undefined;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      if (video?.uri) {
        await handleVideoRecorded(video.uri);
      }
    } catch (err) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '동영상 녹화에 실패했습니다. 다시 시도해주세요.'));
    }
  }, [cameraReady, isRecording, stopRecording, handleVideoRecorded]);


  const handlePostCaptureProceed = useCallback(async (_customPrompt: string, _platform: UploadPlatformKey, _editPlan: ShortFormEditPlan) => {
    setPostCaptureVisible(false);
    if (postCaptureBase64) {
      await runAutoAnalysis(postCaptureBase64, postCaptureMime);
      return;
    }
    if (!postCaptureVideoUri) return;
    try {
      const { base64, mimeType } = await withTimeout(
        compressImageToBase64(postCaptureVideoUri, 1080, 0.7),
        PICK_TIMEOUT_MS,
        '동영상 압축',
      );
      await runAutoAnalysis(base64, mimeType);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '동영상 처리에 실패했습니다. 다시 시도해주세요.'));
    }
  }, [runAutoAnalysis, postCaptureBase64, postCaptureMime, postCaptureVideoUri]);

  const handlePostCaptureClose = useCallback(() => {
    setPostCaptureVisible(false);
    setPostCaptureVideoUri(null);
    setPostCaptureBase64(null);
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current || processing || !cameraReady || autoSaving) return;

    if (captureMode === 'multi') {
      setMultiAngleVisible(true);
      return;
    }

    if (captureMode === 'oneclick') {
      if (isRecording) {
        await stopRecording();
        return;
      }
      await startRecording();
      return;
    }

    const genId = genIdRef.current;
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
      if (genIdRef.current !== genId) return;
      if (!photo?.base64) throw new Error('Failed to capture image data');
      const cleanB64 = cleanBase64(photo.base64);
      const compressedDataUrl = await withTimeout(
        prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7, 'none' as MoodFilterType),
        PICK_TIMEOUT_MS,
        '이미지 압축',
      );
      if (!isMountedRef.current || genIdRef.current !== genId) return;
      const compressedB64 = cleanBase64(compressedDataUrl);
      const compressedMime = getMimeTypeFromDataUrl(compressedDataUrl);
      await runAutoAnalysis(compressedB64, compressedMime);
    } catch (err) {
      if (!isMountedRef.current || genIdRef.current !== genId) return;
      setError(friendlyError(err, '사진 촬영에 실패했습니다. 다시 시도해주세요.'));
    }
  };

  const handlePickImage = async () => {
    if (processing || autoSaving) return;

    if (isWebPlatform()) {
      try {
        const images = await withTimeout(pickImageWeb(false, 1), PICK_TIMEOUT_MS, '사진 선택');
        if (images.length === 0) return;
        const compressed = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1080, 0.7, 'none' as MoodFilterType),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        await runAutoAnalysis(cleanBase64(compressed), getMimeTypeFromDataUrl(compressed));
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
      await runAutoAnalysis(base64, mimeType);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
    }
  };

  const handleMultiAngleComplete = async (shots: AngleShot[]) => {
    const sorted = [...shots].sort((a, b) => a.orderIndex - b.orderIndex);
    setMultiAngleVisible(false);
    if (sorted[0]?.base64) {
      const additionalB64s = sorted.slice(1).map((s) => s.base64).filter(Boolean) as string[];
      await runAutoAnalysis(sorted[0].base64, sorted[0].mimeType || 'image/jpeg', additionalB64s);
    }
  };

  const handleMultiAngleCapture = async (_angleId: string): Promise<{ base64: string; mimeType: string } | null> => {
    if (isWebPlatform()) {
      try {
        const video = document.querySelector('video') as HTMLVideoElement | null;
        if (video && video.videoWidth > 0 && video.videoHeight > 0) {
          const maxDim = 1080;
          const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.round(video.videoWidth * scale);
          const h = Math.round(video.videoHeight * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('canvas unsupported');
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const compressed = await withTimeout(
            prepareImageForApi(dataUrl, 1080, 0.7, 'none' as MoodFilterType),
            PICK_TIMEOUT_MS,
            '이미지 압축',
          );
          return { base64: cleanBase64(compressed), mimeType: getMimeTypeFromDataUrl(compressed) };
        }
        const images = await withTimeout(pickImageWeb(false, 1, true), PICK_TIMEOUT_MS, '웹 캡처');
        if (images.length === 0) return null;
        const compressed = await withTimeout(
          prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1080, 0.7, 'none' as MoodFilterType),
          PICK_TIMEOUT_MS,
          '이미지 압축',
        );
        return { base64: cleanBase64(compressed), mimeType: getMimeTypeFromDataUrl(compressed) };
      } catch {
        return null;
      }
    }
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
        prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1080, 0.7, 'none' as MoodFilterType),
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
          prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1080, 0.7, 'none' as MoodFilterType),
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

  const handleWebCapture = useCallback(async (payload: string, mimeType: string) => {
    const isVideo = mimeType.startsWith('video/');
    if (isVideo) {
      setPostCaptureBase64(null);
      setPostCaptureMime(mimeType);
      setPostCaptureVideoUri(payload);
    } else {
      setPostCaptureBase64(payload);
      setPostCaptureMime(mimeType);
      setPostCaptureVideoUri(null);
    }
    setPostCaptureVisible(true);
  }, []);

  const handleModeSelect = (mode: CaptureModeType) => {
    setCaptureMode(mode);
    setError(null);
    setScreenPhase('camera');
    if (mode === 'multi') {
      setMultiAngleVisible(true);
    }
  };

  // ─── Mode Selection Screen ───
  if (screenPhase === 'mode_select') {
    return (
      <View style={styles.modeSelectContainer}>
        <View style={[styles.modeSelectHeader, { paddingTop: safeTop + theme.spacing.lg }]}>
          <View style={styles.modeSelectHeaderLeft}>
            <CreditBalanceBadge onPress={() => setCreditModalVisible(true)} compact />
          </View>
          <Text style={styles.modeSelectTitle}>15초 숏폼 만들기</Text>
          <View style={{ width: 80 }} />
        </View>

        <TriggerBanner />

        <View style={styles.modeCardsWrap}>
          <ModeCard
            icon={<Zap size={32} color="#fff" strokeWidth={2.5} />}
            title="원클릭 촬영"
            desc="탭 한 번으로 15초 동영상을 촬영해 바로 숏폼으로 완성"
            color={theme.colors.warning[500]}
            onPress={() => handleModeSelect('oneclick')}
          />
          <ModeCard
            icon={<Camera size={32} color="#fff" strokeWidth={2.5} />}
            title="스틸컷 템플릿"
            desc="상품 사진 한 장으로 완성되는 홍보 영상 템플릿"
            color={theme.colors.primary[600]}
            onPress={() => handleModeSelect('single')}
          />
          <ModeCard
            icon={<Layers size={32} color="#fff" strokeWidth={2.5} />}
            title="다각도 촬영"
            desc="전면, 측면, 디테일을 연달아 촬영해 역동적인 숏폼 생성"
            color={theme.colors.accent[500]}
            onPress={() => handleModeSelect('multi')}
          />
        </View>

        <View style={[styles.modeSelectFooter, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.md }]}>
          <TouchableOpacity style={styles.galleryPickBtn} onPress={handlePickImage} activeOpacity={0.8}>
            <ImageIcon size={22} color={theme.colors.dark.text} strokeWidth={2} />
            <Text style={styles.galleryPickText}>갤러리에서 사진 선택</Text>
          </TouchableOpacity>
        </View>

        <OnboardingModal
          visible={showOnboardingModal}
          onComplete={() => setShowOnboardingModal(false)}
        />
        <CreditPurchaseModal
          visible={creditModalVisible}
          onClose={() => setCreditModalVisible(false)}
        />

        {error && (
          <View style={styles.modeSelectError}>
            <Text style={styles.modeSelectErrorText}>{error}</Text>
          </View>
        )}
      </View>
    );
  }

  // ─── Web Camera Screen ───
  if (isWebPlatform()) {
    return (
      <View style={styles.container}>
        {/* Top bar: back only */}
        <View style={[styles.topBar, { top: safeTop + 8 }]}>
          <TouchableOpacity
            style={styles.topBarBtn}
            onPress={() => { setScreenPhase('mode_select'); setError(null); }}
            activeOpacity={0.7}
          >
            <X size={22} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraPreviewWrap}>
          <WebCameraView
            onCapture={handleWebCapture}
            onPickImage={handlePickImage}
            isActive={isActive}
            safeTop={safeTop}
            tabBarHeight={tabBarHeight}
            bottomInset={bottomInset}
            captureMode={captureMode}
            onCaptureModeChange={() => {}}
            autoSaving={autoSaving}
            autoSaveToast={autoSaveToast}
            autoSaveStep={autoSaveStep}
            onMultiAnglePress={() => setMultiAngleVisible(true)}
            simplified
          />
        </View>

        {error && (
          <View style={[styles.bottomBar, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.sm }]}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        <MultiAngleCaptureGuide
          visible={multiAngleVisible}
          onClose={() => setMultiAngleVisible(false)}
          onComplete={handleMultiAngleComplete}
          onPickImage={handleMultiAnglePick}
          onCaptureImage={handleMultiAngleCapture}
        />

        <PostCaptureWorkflow
          visible={postCaptureVisible}
          videoUri={postCaptureVideoUri}
          onProceedToAnalysis={handlePostCaptureProceed}
          onClose={handlePostCaptureClose}
        />

        <CreditPurchaseModal
          visible={creditModalVisible}
          onClose={() => setCreditModalVisible(false)}
        />
      </View>
    );
  }

  // ─── Native Camera Screen ───
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>카메라 로딩 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>카메라 권한이 필요합니다</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionBtnText}>권한 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backToModeBtn} onPress={() => setScreenPhase('mode_select')} activeOpacity={0.7}>
          <Text style={styles.backToModeText}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar: back button only */}
      <View style={[styles.topBar, { top: safeTop + 8 }]}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => { setScreenPhase('mode_select'); setError(null); setCameraReady(false); }}
          activeOpacity={0.7}
        >
          <X size={22} color={theme.colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => { setCameraReady(false); setFacing((f) => (f === 'back' ? 'front' : 'back')); }}
          activeOpacity={0.7}
        >
          <RotateCcw size={20} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Camera Preview */}
      <View style={styles.cameraPreviewWrap}>
        {isActive ? (
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing={facing}
            onCameraReady={() => setCameraReady(true)}
            mode="video"
          />
        ) : (
          <View style={[styles.cameraPreview, styles.cameraPlaceholder]}>
            <Camera size={36} color={theme.colors.dark.textDim} strokeWidth={1.5} />
          </View>
        )}

        {/* 15s recording guide + timer */}
        {captureMode === 'oneclick' && cameraReady && (
          <View style={styles.recordGuideWrap} pointerEvents="none">
            <View style={styles.recordGuideBadge}>
              {isRecording ? (
                <>
                  <View style={styles.recordDotActive} />
                  <Text style={styles.recordTimerText}>
                    00:{String(recordElapsed).padStart(2, '0')} / 00:{String(ONECLICK_RECORD_MAX_S).padStart(2, '0')}
                  </Text>
                </>
              ) : (
                <>
                  <Zap size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.recordGuideText}>15초 숏폼 최적 촬영 준비</Text>
                </>
              )}
            </View>
            {isRecording && (
              <View style={styles.recordProgressBar}>
                <View style={[styles.recordProgressFill, { width: `${(recordElapsed / ONECLICK_RECORD_MAX_S) * 100}%` }]} />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom: single shutter button only */}
      <View style={[styles.bottomBar, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.md }]}>
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.shutterRow}>
          <View style={{ width: 52 }} />
          <TouchableOpacity
            style={[
              styles.shutterBtn,
              !cameraReady && styles.shutterBtnDisabled,
              captureMode === 'oneclick' && styles.shutterBtnOneclick,
              (autoSaving || processing) && styles.shutterBtnCapturing,
              isRecording && styles.shutterBtnRecording,
            ]}
            onPress={handleCapture}
            disabled={processing || autoSaving || !cameraReady}
            activeOpacity={0.85}
          >
            {isRecording ? (
              <Square size={28} color="#fff" strokeWidth={2.5} />
            ) : captureMode === 'oneclick' ? (
              <Zap size={30} color="#fff" strokeWidth={2.5} />
            ) : (
              <Camera size={30} color="#fff" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
          <View style={{ width: 52 }} />
        </View>

        <Text style={styles.shutterHintText}>
          {autoSaving ? 'AI 자동 분석 중...' :
           isRecording ? `녹화 중 · 15초 후 자동 완료 (${recordElapsed}/${ONECLICK_RECORD_MAX_S}s)` :
           captureMode === 'oneclick' ? '탭하여 15초 동영상 녹화 시작' :
           captureMode === 'single' ? '흔들림 없이 한 장 담아내기' :
           '전면, 측면, 디테일 연달아 촬영'}
        </Text>
      </View>

      {/* Multi-Angle Capture Guide */}
      <MultiAngleCaptureGuide
        visible={multiAngleVisible}
        onClose={() => setMultiAngleVisible(false)}
        onComplete={handleMultiAngleComplete}
        onPickImage={handleMultiAnglePick}
        onCaptureImage={handleMultiAngleCapture}
      />

      {/* Auto-save toast */}
      {autoSaveToast && (
        <View style={styles.autoSaveToastWrap}>
          <View style={styles.autoSaveToastInner}>
            <Check size={18} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.autoSaveToastText}>{autoSaveToast}</Text>
          </View>
        </View>
      )}

      {/* Auto-saving overlay */}
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

      <PostCaptureWorkflow
        visible={postCaptureVisible}
        videoUri={postCaptureVideoUri}
        onProceedToAnalysis={handlePostCaptureProceed}
        onClose={handlePostCaptureClose}
      />

      <CreditPurchaseModal
        visible={creditModalVisible}
        onClose={() => setCreditModalVisible(false)}
      />
    </View>
  );
}

// ─── Mode Card Component ───
interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onPress: () => void;
}

function ModeCard({ icon, title, desc, color, onPress }: ModeCardProps) {
  return (
    <TouchableOpacity
      style={styles.modeCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.modeCardIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <View style={styles.modeCardTextWrap}>
        <Text style={styles.modeCardTitle}>{title}</Text>
        <Text style={styles.modeCardDesc}>{desc}</Text>
      </View>
      <ArrowRight size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  // Mode selection screen
  modeSelectContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  modeSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  modeSelectHeaderLeft: {
    width: 80,
  },
  modeSelectTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  modeCardsWrap: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md + 2,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  modeCardIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCardTextWrap: {
    flex: 1,
    gap: 4,
  },
  modeCardTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modeCardDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
  },
  modeSelectFooter: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  galleryPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  galleryPickText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  modeSelectError: {
    position: 'absolute',
    bottom: theme.spacing.xxl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 30,
  },
  modeSelectErrorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  // Permission
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
  permissionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.radius.lg,
  },
  permissionBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  backToModeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backToModeText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  // Camera screen
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
  bottomBar: {
    backgroundColor: 'rgba(5, 8, 18, 0.85)',
    paddingTop: theme.spacing.xs,
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
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
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
  shutterBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shutterBtnCapturing: {
    opacity: 0.6,
  },
  shutterBtnOneclick: {
    backgroundColor: theme.colors.warning[500],
  },
  shutterBtnRecording: {
    backgroundColor: theme.colors.error[500],
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  recordGuideWrap: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
    gap: 6,
  },
  recordGuideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordGuideText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  recordTimerText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  recordDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error[400],
  },
  recordProgressBar: {
    width: 200,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  recordProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.warning[400],
    borderRadius: 1.5,
  },
  shutterHintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    marginTop: 4,
  },
  // Auto-save toast
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
  // Auto-saving overlay
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
});
