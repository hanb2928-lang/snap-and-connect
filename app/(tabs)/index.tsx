import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  PanResponder,
  Animated as RNAnimated,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '@/hooks/useSafeTop';
import { Camera, Image as ImageIcon, RotateCcw, Zap, ZapOff, ScanLine, Layers, Wand as Wand2, Grid3x3, Check, Palette, Sparkles, X, Play, Film, CircleAlert, LayoutTemplate, Share2, FileImage, Upload } from 'lucide-react-native';
import { ARComicCamera } from '@/components/ARComicCamera';
import { VideoImportGenerator } from '@/components/VideoImportGenerator';
import { MobileVideoImport } from '@/components/MobileVideoImport';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '@/lib/theme';
import { uploadImage, analyzeImageQueued, analyzeMultiShotQueued, saveScan, saveManualScan } from '@/lib/analysis';
import { buildDataUrl, cleanBase64, getMimeTypeFromDataUrl } from '@/lib/base64';
import { prepareImageForApi, compressImageToBase64 } from '@/lib/imageEdit';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { OnboardingTooltip } from '@/components/OnboardingTooltip';
import { OnboardingModal } from '@/components/OnboardingModal';
import { RecentWorkButton } from '@/components/RecentWorkButton';
import { WorkflowGuide } from '@/components/WorkflowGuide';
import { StepIndicator } from '@/components/StepIndicator';
import { ProgressOverlay } from '@/components/ProgressOverlay';
import { QueueStatusBadge } from '@/components/QueueStatusBadge';
import { ImageCropModal } from '@/components/ImageCropModal';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import { VerticalSectionCard } from '@/components/VerticalSectionCard';
import { CapturePreviewModal } from '@/components/CapturePreviewModal';
import type { PlatformKey, AnalysisResult } from '@/types/database';

const { width: screenWidth } = Dimensions.get('window');

const ZOOM_LEVELS = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.5 },
  { label: '3x', value: 1 },
] as const;

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);
  const [zoomLabel, setZoomLabel] = useState('1x');
  const [recognitionMode, setRecognitionMode] = useState<'single' | 'multi'>('single');
  const [multiShots, setMultiShots] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [gridVisible, setGridVisible] = useState(false);
  const [focusIndicator, setFocusIndicator] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const focusAnim = useRef(new RNAnimated.Value(0)).current;
  const progressWidth = useSharedValue(0);
  const [preferredStyle, setPreferredStyle] = useState<PlatformKey>('shortform');
  const [templateMode, setTemplateMode] = useState<'manual' | 'auto'>('auto');
  const [stylePickerVisible, setStylePickerVisible] = useState(false);
  const [showOnboardingCapture, setShowOnboardingCapture] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [videoImportVisible, setVideoImportVisible] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [workflowGuideVisible, setWorkflowGuideVisible] = useState(false);
  const [previewCapture, setPreviewCapture] = useState<{ base64: string; mimeType: string } | null>(null);
  const fadeAnim = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const pinchActive = useSharedValue(false);
  const zoomShared = useSharedValue(0);
  const updateZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(0, Math.min(1, newZoom));
    zoomShared.value = clamped;
    setZoom(clamped);
    const label = clamped === 0 ? '1x' : clamped >= 0.75 ? '3x' : clamped >= 0.35 ? '2x' : `${(1 + clamped).toFixed(1)}x`;
    setZoomLabel(label);
  }, [zoomShared]);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchActive.value = true;
    })
    .onUpdate((e) => {
      pinchScale.value = e.scale;
    })
    .onEnd(() => {
      pinchActive.value = false;
      const currentZoom = zoomShared.value;
      const scale = pinchScale.value;
      const newZoom = Math.max(0, Math.min(1, currentZoom + (scale - 1) * 0.5));
      pinchScale.value = 1;
      runOnJS(updateZoom)(newZoom);
    });

  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      return () => {
        setIsActive(false);
        setCameraReady(false);
      };
    }, []),
  );

  const STYLE_PRESETS: { key: PlatformKey; label: string; desc: string }[] = [
    { key: 'shortform', label: '볼드', desc: '숏폼용 임팩트' },
    { key: 'instagram', label: '피드', desc: '인스타 피드' },
    { key: 'naverBlog', label: '매거진', desc: '블로그용' },
    { key: 'twitter', label: '미니멀', desc: '트위터용' },
  ];

  useEffect(() => {
    (async () => {
      const saved = await getItem('preferred_template_style');
      if (saved) setPreferredStyle(saved as PlatformKey);
      const savedMode = await getItem('template_mode');
      if (savedMode === 'auto' || savedMode === 'manual') setTemplateMode(savedMode);
      const seenOnboarding = await getItem('onboarding_seen');
      if (!seenOnboarding) {
        setShowOnboardingModal(true);
        setItem('onboarding_seen', 'true');
      }
    })();
  }, []);

  const handleStyleChange = useCallback((style: PlatformKey) => {
    setPreferredStyle(style);
    setItem('preferred_template_style', style);
  }, []);

  const handleTemplateModeChange = useCallback((mode: 'manual' | 'auto') => {
    setTemplateMode(mode);
    setItem('template_mode', mode);
  }, []);

  const fadeIn = useCallback(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [fadeAnim]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const focusBoxSize = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 60],
  });
  const focusOpacity = focusAnim.interpolate({
    inputRange: [0, 0.3, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  const showFocusIndicator = useCallback((x: number, y: number) => {
    setFocusIndicator({ x, y, visible: true });
    RNAnimated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start(() => {
      RNAnimated.timing(focusAnim, { toValue: 0, duration: 600, delay: 400, useNativeDriver: false }).start(() => {
        setFocusIndicator((prev) => ({ ...prev, visible: false }));
      });
    });
  }, [focusAnim]);

  const cameraPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !processing,
      onPanResponderGrant: (e) => {
        showFocusIndicator(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
    })
  ).current;

  const handleCapture = async () => {
    if (!cameraRef.current || processing || !cameraReady) return;
    setProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        shutterSound: false,
        ...({ mute: true } as Record<string, unknown>),
      }) as { base64?: string; uri: string };
      if (!photo?.base64) {
        throw new Error('Failed to capture image data');
      }
      const cleanB64 = cleanBase64(photo.base64);
      const compressedDataUrl = await prepareImageForApi(buildDataUrl(cleanB64, 'image/jpeg'), 1280, 0.7);
      const compressedB64 = cleanBase64(compressedDataUrl);
      const compressedMime = getMimeTypeFromDataUrl(compressedDataUrl);

      if (recognitionMode === 'multi') {
        if (multiShots.length >= 4) {
          setError('최대 4장까지 촬영할 수 있습니다. 분석을 시작하거나 사진을 삭제해주세요.');
          setProcessing(false);
          return;
        }
        setMultiShots((prev) => [...prev, compressedB64]);
        setProcessing(false);
        return;
      }

      setError(null);
      setProcessing(false);
      setPreviewCapture({ base64: compressedB64, mimeType: compressedMime });
    } catch (err) {
      setError(friendlyError(err, '사진 촬영에 실패했습니다. 다시 시도해주세요.'));
      setProcessing(false);
    }
  };

  const handleAnalyzeMultiShot = async () => {
    if (multiShots.length === 0 || processing) return;
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('다각도 사진 분석 중...');
    progressWidth.value = withTiming(0.15, { duration: 300 });
    fadeAnim.value = 0;

    try {
      const firstB64 = multiShots[0];
      setProgressStep(1);
      setProgressText('AI 다각도 분석 중...');
      progressWidth.value = withTiming(0.35, { duration: 500 });

      const progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      let imageUrl: string, analysis: AnalysisResult;
      try {
        [imageUrl, analysis] = await Promise.all([
          uploadImage(firstB64, 'image/jpeg'),
          analyzeMultiShotQueued(multiShots, `scan-${Date.now()}`),
        ]);
      } finally {
        clearInterval(progressTimer);
      }

      const additionalUrls: string[] = [];
      if (multiShots.length > 1) {
        for (let i = 1; i < multiShots.length; i++) {
          try {
            const url = await uploadImage(multiShots[i], 'image/jpeg');
            additionalUrls.push(url);
          } catch {
            // individual angle upload failure shouldn't block the whole scan
          }
        }
      }

      setProgressStep(2);
      setProgressText('결과 저장 중...');
      progressWidth.value = withTiming(0.85, { duration: 300 });
      const scanId = await saveScan(imageUrl, analysis, additionalUrls, 'multi');

      setProgressStep(3);
      setProgressText('완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      setMultiShots([]);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '다각도 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveShot = (index: number) => {
    setMultiShots((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickImage = async () => {
    if (processing) return;

    if (isWebPlatform()) {
      try {
        const images = await pickImageWeb(recognitionMode === 'multi', 4 - multiShots.length);
        if (images.length === 0) return;

        if (recognitionMode === 'multi') {
          const newShots: string[] = [];
          for (const img of images) {
            const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(img.base64), img.mimeType), 1280, 0.7);
            newShots.push(cleanBase64(compressed));
          }
          setMultiShots((prev) => [...prev, ...newShots].slice(0, 4));
          return;
        }

        setProcessing(true);
        setError(null);
        const img = images[0];
        const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(img.base64), img.mimeType), 1280, 0.7);
        const compressedMime = getMimeTypeFromDataUrl(compressed);
        setProcessing(false);
        setPreviewCapture({ base64: cleanBase64(compressed), mimeType: compressedMime });
      } catch (err) {
        setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
        setProcessing(false);
      }
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: false,
        quality: 0.7,
        allowsMultipleSelection: recognitionMode === 'multi',
        selectionLimit: 4,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      if (recognitionMode === 'multi') {
        const newShots: string[] = [];
        for (const a of result.assets) {
          if (!a.uri) continue;
          const { base64 } = await compressImageToBase64(a.uri, 1280, 0.7);
          newShots.push(base64);
          if (newShots.length >= 4 - multiShots.length) break;
        }
        setMultiShots((prev) => [...prev, ...newShots].slice(0, 4));
        return;
      }

      setProcessing(true);
      setError(null);

      const asset = result.assets[0];
      if (!asset.uri) {
        setProcessing(false);
        return;
      }
      const { base64: compressedB64, mimeType: compressedMime } = await compressImageToBase64(asset.uri, 1280, 0.7);
      setProcessing(false);
      setPreviewCapture({ base64: compressedB64, mimeType: compressedMime });
    } catch (err) {
      setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
      setProcessing(false);
    }
  };

  const handleTemplateOnly = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('사진 선택 중...');
    progressWidth.value = withTiming(0.1, { duration: 200 });
    fadeAnim.value = 0;

    try {
      let cleanB64: string;
      let mimeType: string;

      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) {
          setProcessing(false);
          return;
        }
        cleanB64 = cleanBase64(images[0].base64);
        mimeType = images[0].mimeType;
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });

        if (result.canceled || !result.assets?.[0]?.uri) {
          setProcessing(false);
          return;
        }

        const asset = result.assets[0];
        if (!asset.uri) {
          setProcessing(false);
          return;
        }
        const compressed = await compressImageToBase64(asset.uri, 1280, 0.7);
        cleanB64 = compressed.base64;
        mimeType = compressed.mimeType;
      }

      setProgressText('이미지 업로드 중...');
      const imageUrl = await uploadImage(cleanB64, mimeType);

      setProgressText('템플릿 준비 중...');
      const scanId = await saveManualScan(imageUrl);

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '이미지를 불러오지 못했습니다. 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const processImage = async (
    base64: string,
    _uri: string,
    mimeType: string,
  ) => {
    const dataUrl = buildDataUrl(base64, mimeType);
    const fileName = `scan-${Date.now()}`;

    try {
      setProgressStep(1);
      setProgressText('AI 분석 중...');
      progressWidth.value = withTiming(0.35, { duration: 500 });

      const progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      let imageUrl: string, analysis: AnalysisResult;
      try {
        [imageUrl, analysis] = await Promise.all([
          uploadImage(base64, mimeType),
          analyzeImageQueued(dataUrl, fileName, mimeType, recognitionMode, templateMode === 'auto' ? undefined : preferredStyle),
        ]);
      } finally {
        clearInterval(progressTimer);
      }

      setProgressStep(2);
      setProgressText('결과 저장 중...');
      progressWidth.value = withTiming(0.85, { duration: 300 });
      const scanId = await saveScan(imageUrl, analysis, [], 'single');

      setProgressStep(3);
      setProgressText('완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handlePreviewConfirm = async (base64: string, mimeType: string) => {
    setPreviewCapture(null);
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('AI 분석 준비 중...');
    progressWidth.value = withTiming(0.1, { duration: 200 });
    fadeAnim.value = 0;
    await processImage(base64, '', mimeType);
  };

  const handlePreviewRetake = () => {
    setPreviewCapture(null);
  };

  if (isWebPlatform()) {
    return <WebUploadScreen />;
  }

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
        <Camera size={56} color={theme.colors.primary[400]} strokeWidth={1.5} />
        <Text style={styles.permissionTitle}>카메라 접근이 필요해요</Text>
        <Text style={styles.permissionText}>
          실시간으로 사진을 촬영하고 AI 분석을 하려면 카메라 접근 권한이 필요합니다.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionButtonText}>카메라 접근 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadAltButton} onPress={handlePickImage} activeOpacity={0.8}>
          <ImageIcon size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={styles.uploadAltText}>갤러리에서 사진 선택</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {arMode && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <ARComicCamera
            onClose={() => { setCameraReady(false); setArMode(false); }}
            recognitionMode={recognitionMode}
            preferredStyle={preferredStyle}
          />
        </View>
      )}

      {videoImportVisible && Platform.OS !== 'web' && (
        <MobileVideoImport
          affiliatePlatforms={[]}
          shortUrl={''}
          onClose={() => setVideoImportVisible(false)}
        />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.verticalScroll,
          { paddingTop: safeTop + theme.spacing.sm, paddingBottom: theme.spacing.xxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!arMode}
      >
        <View style={styles.verticalHeader}>
          <Text style={styles.verticalTitle}>제품 촬영부터 공유까지</Text>
          <Text style={styles.verticalSubtitle}>
            아래 순서대로 따라 하시면 됩니다. 각 단계를 탭하여 진행하세요.
          </Text>
        </View>

        <View style={{ alignSelf: 'center', marginBottom: theme.spacing.md }}>
          <StepIndicator activeStep={1} />
        </View>

        <VerticalSectionCard
          icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
          title="1. 사진 촬영"
          desc="제품을 카메라에 맞추고 셔터 버튼을 눌러주세요."
          iconBg={theme.colors.primary[500] + '18'}
          accentColor={theme.colors.primary[400]}
          stepNumber={1}
        >
          <View style={styles.cameraPreviewWrap}>
            {isActive && !arMode ? (
              <GestureDetector gesture={pinchGesture}>
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraPreview}
                  facing={facing}
                  flash={flash}
                  zoom={zoom}
                  onCameraReady={() => setCameraReady(true)}
                />
              </GestureDetector>
            ) : (
              <View style={[styles.cameraPreview, styles.cameraPlaceholder]}>
                <Camera size={36} color={theme.colors.dark.textDim} strokeWidth={1.5} />
              </View>
            )}

            {!arMode && (
              <View style={styles.cameraOverlay} pointerEvents="none">
                <View style={styles.frameCornerTL} />
                <View style={styles.frameCornerTR} />
                <View style={styles.frameCornerBL} />
                <View style={styles.frameCornerBR} />
                {gridVisible && (
                  <View style={styles.gridOverlaySmall}>
                    <View style={styles.gridLineVerticalLeft} />
                    <View style={styles.gridLineVerticalRight} />
                    <View style={styles.gridLineHorizontalTop} />
                    <View style={styles.gridLineHorizontalBottom} />
                  </View>
                )}
              </View>
            )}

            {focusIndicator.visible && !arMode && (
              <RNAnimated.View
                pointerEvents="none"
                style={[
                  styles.focusIndicator,
                  {
                    left: focusIndicator.x - 30,
                    top: focusIndicator.y - 30,
                    width: focusBoxSize,
                    height: focusBoxSize,
                    opacity: focusOpacity,
                  },
                ]}
              />
            )}

            {!arMode && (
              <View
                style={styles.cameraTouchLayer}
                {...cameraPanResponder.panHandlers}
                pointerEvents={processing ? 'none' : 'auto'}
              />
            )}

            {!arMode && (
              <View style={styles.cameraTopControls}>
                <TouchableOpacity
                  style={[styles.topButton, gridVisible && styles.topButtonActive]}
                  onPress={() => setGridVisible((g) => !g)}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <Grid3x3 size={18} color={gridVisible ? theme.colors.primary[400] : theme.colors.dark.text} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.topButton, flash !== 'off' && styles.topButtonActive]}
                  onPress={() => setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  {flash === 'on' ? (
                    <Zap size={18} color={theme.colors.warning[400]} strokeWidth={2.2} />
                  ) : flash === 'auto' ? (
                    <View style={styles.flashAutoWrap}>
                      <Zap size={16} color={theme.colors.warning[400]} strokeWidth={2.2} />
                      <Text style={styles.flashAutoLabel}>A</Text>
                    </View>
                  ) : (
                    <ZapOff size={18} color={theme.colors.dark.text} strokeWidth={2.2} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.topButton}
                  onPress={() => { setCameraReady(false); setFacing((f) => (f === 'back' ? 'front' : 'back')); }}
                  disabled={processing}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={18} color={theme.colors.dark.text} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            )}

            {!arMode && (
              <View style={styles.cameraZoomBadge} pointerEvents="none">
                <Text style={styles.zoomIndicatorText}>{zoomLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.zoomBar}>
            {ZOOM_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.label}
                style={[
                  styles.zoomButton,
                  zoom >= level.value - 0.01 && zoom <= level.value + 0.01 && styles.zoomButtonActive,
                ]}
                onPress={() => updateZoom(level.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.zoomButtonText,
                    zoom >= level.value - 0.01 && zoom <= level.value + 0.01 && styles.zoomButtonTextActive,
                  ]}
                >
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modeToggleContainer}>
            <TouchableOpacity
              style={[styles.modeButton, recognitionMode === 'single' && styles.modeButtonActive]}
              onPress={() => { setRecognitionMode('single'); setMultiShots([]); }}
              activeOpacity={0.7}
            >
              <ScanLine size={14} color={recognitionMode === 'single' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2.2} />
              <Text style={[styles.modeButtonText, recognitionMode === 'single' && styles.modeButtonTextActive]}>단품</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, recognitionMode === 'multi' && styles.modeButtonActive]}
              onPress={() => { setRecognitionMode('multi'); setMultiShots([]); }}
              activeOpacity={0.7}
            >
              <Layers size={14} color={recognitionMode === 'multi' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2.2} />
              <Text style={[styles.modeButtonText, recognitionMode === 'multi' && styles.modeButtonTextActive]}>다각도 (1~4장)</Text>
            </TouchableOpacity>
          </View>

          {recognitionMode === 'multi' && multiShots.length === 0 && !processing && (
            <View style={styles.angleGuideInline}>
              {[
                { num: '1', label: '정면' },
                { num: '2', label: '측면' },
                { num: '3', label: '후면' },
                { num: '4', label: '디테일' },
              ].map((item) => (
                <View key={item.num} style={styles.angleGuideItemInline}>
                  <View style={styles.angleGuideCircleInline}>
                    <Text style={styles.angleGuideNumInline}>{item.num}</Text>
                  </View>
                  <Text style={styles.angleGuideLabelInline}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}

          {recognitionMode === 'multi' && multiShots.length > 0 && (
            <View style={styles.multiShotStripInline}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.multiShotScroll}>
                {multiShots.map((shot, i) => (
                  <View key={`${shot.slice(0, 16)}-${i}`} style={styles.multiShotThumb}>
                    <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={styles.multiShotImage} />
                    <Text style={styles.multiShotBadge}>{i + 1}</Text>
                    <TouchableOpacity style={styles.multiShotRemove} onPress={() => handleRemoveShot(i)} activeOpacity={0.7}>
                      <X size={12} color="#fff" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.analyzeMultiBtn} onPress={handleAnalyzeMultiShot} disabled={processing} activeOpacity={0.8}>
                <Play size={16} color="#fff" strokeWidth={2.5} />
                <Text style={styles.analyzeMultiText}>{multiShots.length}장 분석 시작</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={processing}
            activeOpacity={0.85}
          >
            <View style={styles.captureButtonRing}>
              <View style={styles.captureButtonInner}>
                <Camera size={32} color="#fff" strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.captureHint}>
            {recognitionMode === 'multi'
              ? multiShots.length === 0
                ? '앞 · 옆 · 뒤 · 디테일 순서로 촬영하세요 (최대 4장)'
                : `${multiShots.length}장 촬영 완료 — 더 찍거나 분석을 시작하세요`
              : '사진을 찍으면 미리보기에서 확인하고 편집한 뒤 AI 분석을 시작합니다'}
          </Text>

          {error && (
            <View style={styles.errorBannerInline} pointerEvents="none">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </VerticalSectionCard>

        <VerticalSectionCard
          icon={<ImageIcon size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
          title="2. 갤러리에서 불러오기"
          desc="촬영 대신 앨범에 있는 사진이나 영상을 사용할 수 있어요."
          iconBg={theme.colors.accent[500] + '18'}
          accentColor={theme.colors.accent[400]}
          stepNumber={2}
        >
          <View style={styles.verticalBtnRow}>
            <TouchableOpacity
              style={styles.verticalBtn}
              onPress={handlePickImage}
              disabled={processing}
              activeOpacity={0.7}
            >
              <ImageIcon size={18} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.verticalBtnText}>사진 선택</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.verticalBtn}
              onPress={() => setVideoImportVisible(true)}
              activeOpacity={0.7}
            >
              <Film size={18} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.verticalBtnText}>동영상 선택</Text>
            </TouchableOpacity>
          </View>
        </VerticalSectionCard>

        <VerticalSectionCard
          icon={<Palette size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
          title="3. 템플릿 스타일 선택"
          desc="AI 자동 추천 또는 원하는 스타일을 직접 골라보세요."
          iconBg={theme.colors.warning[500] + '18'}
          accentColor={theme.colors.warning[400]}
          stepNumber={3}
        >
          <View style={styles.templateModeRow}>
            <TouchableOpacity
              style={[styles.templateModePill, templateMode === 'manual' && styles.templateModePillActive]}
              onPress={() => handleTemplateModeChange('manual')}
              activeOpacity={0.7}
            >
              <Text style={[styles.templateModePillText, templateMode === 'manual' && styles.templateModePillTextActive]}>
                수동 선택
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.templateModePill, templateMode === 'auto' && styles.templateModePillActive]}
              onPress={() => handleTemplateModeChange('auto')}
              activeOpacity={0.7}
            >
              <Text style={[styles.templateModePillText, templateMode === 'auto' && styles.templateModePillTextActive]}>
                자동 추천
              </Text>
            </TouchableOpacity>
          </View>

          {templateMode === 'manual' ? (
            <View style={styles.styleListInline}>
              {STYLE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.styleOption, preferredStyle === preset.key && styles.styleOptionActive]}
                  onPress={() => handleStyleChange(preset.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.styleOptionTextWrap}>
                    <Text style={[styles.styleOptionLabel, preferredStyle === preset.key && styles.styleOptionLabelActive]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.styleOptionDesc}>{preset.desc}</Text>
                  </View>
                  {preferredStyle === preset.key && (
                    <Check size={16} color={theme.colors.accent[400]} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.autoTemplateInfo}>
              <Sparkles size={24} color={theme.colors.accent[400]} strokeWidth={1.5} />
              <Text style={styles.autoTemplateDescSmall}>
                AI가 사진을 분석하여 가장 어울리는 스타일을 자동으로 선택합니다.
              </Text>
            </View>
          )}
        </VerticalSectionCard>

        <VerticalSectionCard
          icon={<Wand2 size={20} color={theme.colors.success[400]} strokeWidth={2} />}
          title="4. 편집만 하기 (AI 분석 생략)"
          desc="분석 없이 사진만 업로드하고 직접 꾸미고 싶을 때 사용하세요."
          iconBg={theme.colors.success[500] + '18'}
          accentColor={theme.colors.success[400]}
          stepNumber={4}
        >
          <TouchableOpacity
            style={styles.verticalSingleBtn}
            onPress={handleTemplateOnly}
            disabled={processing}
            activeOpacity={0.7}
          >
            <Wand2 size={18} color={theme.colors.success[400]} strokeWidth={2} />
            <Text style={styles.verticalSingleBtnText}>템플릿만 만들기</Text>
          </TouchableOpacity>
        </VerticalSectionCard>

        <VerticalSectionCard
          icon={<Sparkles size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
          title="5. AR 모드"
          desc="실시간 AR 효과를 적용하며 촬영할 수 있어요."
          iconBg={theme.colors.accent[500] + '18'}
          accentColor={theme.colors.accent[400]}
          stepNumber={5}
        >
          <TouchableOpacity
            style={styles.verticalSingleBtn}
            onPress={() => { setArMode(true); setMediaPickerVisible(false); setStylePickerVisible(false); }}
            activeOpacity={0.8}
          >
            <Sparkles size={18} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.verticalSingleBtnText}>AR 촬영 시작</Text>
          </TouchableOpacity>
        </VerticalSectionCard>

        <VerticalSectionCard
          icon={<Share2 size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
          title="6. 플랫폼 업로드 및 공유"
          desc="완성된 콘텐츠를 SNS, 블로그 등에 바로 공유하고 제휴 링크를 관리하세요."
          iconBg={theme.colors.primary[500] + '18'}
          accentColor={theme.colors.primary[300]}
          stepNumber={6}
        >
          <TouchableOpacity
            style={styles.verticalSingleBtn}
            onPress={() => router.push('/affiliate' as never)}
            activeOpacity={0.7}
          >
            <Share2 size={18} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.verticalSingleBtnText}>제휴 마케팅 / 공유하기</Text>
          </TouchableOpacity>
        </VerticalSectionCard>

        <TouchableOpacity
          style={styles.guideBtnInline}
          onPress={() => setWorkflowGuideVisible(true)}
          activeOpacity={0.7}
        >
          <LayoutTemplate size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={styles.guideBtnText}>작업 순서 가이드 보기</Text>
        </TouchableOpacity>
      </ScrollView>

      {previewCapture && (
        <CapturePreviewModal
          visible={!!previewCapture}
          imageBase64={previewCapture.base64}
          mimeType={previewCapture.mimeType}
          onConfirm={handlePreviewConfirm}
          onRetake={handlePreviewRetake}
        />
      )}

      <OnboardingModal
        visible={showOnboardingModal}
        onComplete={() => {
          setShowOnboardingModal(false);
          setShowOnboardingCapture(true);
        }}
      />

      <OnboardingTooltip
        visible={showOnboardingCapture}
        onDismiss={() => setShowOnboardingCapture(false)}
        message="이 버튼으로 사진을 찍으면 AI가 자동 분석합니다"
        bottom={120 + insets.bottom}
        direction="down"
        duration={3000}
      />

      <RecentWorkButton />

      {workflowGuideVisible && (
        <View style={styles.guideOverlay}>
          <View style={styles.guideOverlayCard}>
            <View style={styles.guideOverlayHeader}>
              <Text style={styles.guideOverlayTitle}>작업 순서 가이드</Text>
              <TouchableOpacity
                onPress={() => setWorkflowGuideVisible(false)}
                style={styles.guideCloseBtn}
                activeOpacity={0.7}
              >
                <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <WorkflowGuide />
          </View>
        </View>
      )}

      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['촬영', '분석', '저장']}
          />
          {progressStep === 1 && (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <QueueStatusBadge status="processing" label="서버 큐에서 처리 중" />
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

function WebUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const [recognitionMode, setRecognitionMode] = useState<'single' | 'multi'>('single');
  const [multiShots, setMultiShots] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [cropState, setCropState] = useState<{ base64: string; mimeType: string } | null>(null);
  const [showMultiTip, setShowMultiTip] = useState(true);
  const fadeAnim = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  const fadeIn = useCallback(() => {
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [fadeAnim]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  const processImage = async (base64: string, mimeType: string) => {
    const dataUrl = buildDataUrl(base64, mimeType);
    const fileName = `scan-${Date.now()}`;

    try {
      setProgressStep(1);
      setProgressText('AI 분석 중...');
      progressWidth.value = withTiming(0.35, { duration: 500 });

      const progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      let imageUrl: string, analysis: AnalysisResult;
      try {
        [imageUrl, analysis] = await Promise.all([
          uploadImage(base64, mimeType),
          analyzeImageQueued(dataUrl, fileName, mimeType, recognitionMode),
        ]);
      } finally {
        clearInterval(progressTimer);
      }

      setProgressStep(2);
      setProgressText('결과 저장 중...');
      progressWidth.value = withTiming(0.85, { duration: 300 });
      const scanId = await saveScan(imageUrl, analysis, [], 'single');

      setProgressStep(3);
      setProgressText('완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (processing) return;
    setError(null);

    try {
      const images = await pickImageWeb(recognitionMode === 'multi', 4);
      if (images.length === 0) return;

      if (recognitionMode === 'multi') {
        const newShots: string[] = [];
        for (const img of images) {
          const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(img.base64), img.mimeType), 1280, 0.7);
          newShots.push(cleanBase64(compressed));
        }
        setMultiShots((prev) => [...prev, ...newShots].slice(0, 4));
        setShowMultiTip(false);
        return;
      }

      const img = images[0];
      const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(img.base64), img.mimeType), 1280, 0.7);
      const compressedMime = getMimeTypeFromDataUrl(compressed);
      setCropState({ base64: cleanBase64(compressed), mimeType: compressedMime });
    } catch (err) {
      setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
      setProcessing(false);
    }
  };

  const handleAnalyzeMultiShot = async () => {
    if (multiShots.length === 0 || processing) return;
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('다각도 사진 분석 중...');
    progressWidth.value = withTiming(0.15, { duration: 300 });
    fadeAnim.value = 0;

    try {
      setProgressStep(1);
      setProgressText('AI 다각도 분석 중...');
      progressWidth.value = withTiming(0.35, { duration: 500 });

      const progressTimer = setInterval(() => {
        progressWidth.value = withTiming(
          Math.min(progressWidth.value + 0.04, 0.75),
          { duration: 800 },
        );
      }, 3000);

      let imageUrl: string, analysis: AnalysisResult;
      try {
        [imageUrl, analysis] = await Promise.all([
          uploadImage(multiShots[0], 'image/jpeg'),
          analyzeMultiShotQueued(multiShots, `scan-${Date.now()}`),
        ]);
      } finally {
        clearInterval(progressTimer);
      }

      const additionalUrls: string[] = [];
      if (multiShots.length > 1) {
        for (let i = 1; i < multiShots.length; i++) {
          try {
            const url = await uploadImage(multiShots[i], 'image/jpeg');
            additionalUrls.push(url);
            await new Promise((r) => setTimeout(r, 100));
          } catch {
            // individual angle upload failure shouldn't block the whole scan
          }
        }
      }

      setProgressStep(2);
      setProgressText('결과 저장 중...');
      progressWidth.value = withTiming(0.85, { duration: 300 });
      const scanId = await saveScan(imageUrl, analysis, additionalUrls, 'multi');

      setProgressStep(3);
      setProgressText('완료!');
      progressWidth.value = withTiming(1, { duration: 200 });

      setMultiShots([]);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '다각도 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleTemplateOnly = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    setProgressStep(0);
    setProgressText('사진 선택 중...');
    progressWidth.value = withTiming(0.1, { duration: 200 });
    fadeAnim.value = 0;

    try {
      const images = await pickImageWeb(false, 1);
      if (images.length === 0) {
        setProcessing(false);
        return;
      }
      const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType), 1280, 0.7);
      const compressedMime = getMimeTypeFromDataUrl(compressed);
      const cleanB64 = cleanBase64(compressed);
      setProgressText('이미지 업로드 중...');
      const imageUrl = await uploadImage(cleanB64, compressedMime);
      setProgressText('템플릿 준비 중...');
      const scanId = await saveManualScan(imageUrl);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setError(friendlyError(err, '이미지를 불러오지 못했습니다. 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveShot = (index: number) => {
    setMultiShots((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: safeTop + theme.spacing.xl, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
          <View style={styles.webHeroIcon}>
            <Camera size={44} color={theme.colors.primary[400]} strokeWidth={1.5} />
          </View>
          <Text style={styles.webHeroTitle}>제품 사진으로 시작</Text>
          <Text style={styles.webHeroSub}>
            사진을 올리면 AI가 제품을 분석하고 마케팅 소재를 만들어 드립니다
          </Text>
        </View>

        <View style={{ alignSelf: 'center', marginBottom: theme.spacing.md }}>
          <StepIndicator activeStep={1} />
        </View>

        <View style={styles.webGuideSection}>
          <Text style={styles.webGuideHeading}>이렇게 진행하세요</Text>
          <Text style={styles.webGuideSubheading}>
            1번부터 4번까지 순서대로 따라 하시면 됩니다. 각 단계를 탭하면 해당 화면으로 이동합니다.
          </Text>
          <WorkflowGuide />
        </View>

        <View style={styles.webModeRow}>
          <TouchableOpacity
            style={[styles.webModePill, recognitionMode === 'single' && styles.webModePillActive]}
            onPress={() => { setRecognitionMode('single'); setMultiShots([]); }}
            activeOpacity={0.7}
          >
            <ScanLine size={14} color={recognitionMode === 'single' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={[styles.modeButtonText, recognitionMode === 'single' && styles.modeButtonTextActive]}>단품</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.webModePill, recognitionMode === 'multi' && styles.webModePillActive]}
            onPress={() => { setRecognitionMode('multi'); setMultiShots([]); }}
            activeOpacity={0.7}
          >
            <Layers size={14} color={recognitionMode === 'multi' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={[styles.modeButtonText, recognitionMode === 'multi' && styles.modeButtonTextActive]}>다각도 (1~4장)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webUploadCard}>
          <TouchableOpacity style={styles.webUploadBtn} onPress={handleUpload} disabled={processing} activeOpacity={0.8}>
            <ImageIcon size={22} color="#fff" strokeWidth={2} />
            <Text style={styles.webUploadBtnText}>
              {recognitionMode === 'multi' ? '사진 여러 장 올리기' : '사진 올리기'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.webTemplateBtn} onPress={handleTemplateOnly} disabled={processing} activeOpacity={0.7}>
            <Wand2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />
            <View style={styles.webTemplateBtnContent}>
              <Text style={styles.webTemplateBtnText}>템플릿만 만들기</Text>
              <Text style={styles.webTemplateBtnSub}>AI 분석 없이 사진만 업로드하고 직접 꾸미기</Text>
            </View>
          </TouchableOpacity>
        </View>

        {recognitionMode === 'multi' && multiShots.length === 0 && (
          <View style={styles.angleGuideBox}>
            <Text style={styles.angleGuideTitle}>촬영 가이드</Text>
            <View style={styles.angleGuideGrid}>
              <View style={styles.angleGuideItem}>
                <View style={styles.angleGuideIcon}>
                  <Text style={styles.angleGuideEmoji}>1</Text>
                </View>
                <Text style={styles.angleGuideLabel}>정면</Text>
              </View>
              <View style={styles.angleGuideItem}>
                <View style={styles.angleGuideIcon}>
                  <Text style={styles.angleGuideEmoji}>2</Text>
                </View>
                <Text style={styles.angleGuideLabel}>측면</Text>
              </View>
              <View style={styles.angleGuideItem}>
                <View style={styles.angleGuideIcon}>
                  <Text style={styles.angleGuideEmoji}>3</Text>
                </View>
                <Text style={styles.angleGuideLabel}>후면</Text>
              </View>
              <View style={styles.angleGuideItem}>
                <View style={styles.angleGuideIcon}>
                  <Text style={styles.angleGuideEmoji}>4</Text>
                </View>
                <Text style={styles.angleGuideLabel}>디테일</Text>
              </View>
            </View>
            <Text style={styles.angleGuideDesc}>
              같은 제품을 앞·옆·뒤에서 2~4장 촬영하면 더 정확하게 분석합니다.
            </Text>
          </View>
        )}

        {recognitionMode === 'multi' && multiShots.length > 0 && (
          <View style={[styles.multiShotStrip, { position: 'relative', bottom: undefined, left: undefined, right: undefined, marginTop: theme.spacing.md }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.multiShotScroll}>
              {multiShots.map((shot, i) => (
                <View key={`${shot.slice(0, 16)}-${i}`} style={styles.multiShotThumb}>
                  <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={styles.multiShotImage} />
                  <Text style={styles.multiShotBadge}>{i + 1}</Text>
                  <TouchableOpacity style={styles.multiShotRemove} onPress={() => handleRemoveShot(i)} activeOpacity={0.7}>
                    <X size={12} color="#fff" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.analyzeMultiBtn} onPress={handleAnalyzeMultiShot} disabled={processing} activeOpacity={0.8}>
              <Play size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.analyzeMultiText}>{multiShots.length}장 분석 시작</Text>
            </TouchableOpacity>
          </View>
        )}

        {recognitionMode === 'single' && showMultiTip && (
          <View style={styles.multiTipBox}>
            <Layers size={16} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.multiTipText}>
              앞/옆/뒤 등 2장 이상 올리면 더 정교한 결과를 받을 수 있어요. 상단에서 '다각도' 모드를 선택해 보세요.
            </Text>
            <TouchableOpacity onPress={() => setShowMultiTip(false)} activeOpacity={0.7}>
              <X size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.webNoteBox}>
          <CircleAlert size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.webNoteText}>
            브라우저 미리보기에서는 카메라 직접 촬영이 제한됩니다. 사진 파일을 올려서 AI 분석을 이용하세요. 실제 스마트폰 앱(APK)에서는 카메라 촬영이 완벽하게 작동합니다.
          </Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { position: 'relative', bottom: undefined, left: undefined, right: undefined, marginTop: theme.spacing.md }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <RecentWorkButton />

      {cropState && (
        <ImageCropModal
          visible={!!cropState}
          imageBase64={cropState.base64}
          mimeType={cropState.mimeType}
          onConfirm={(b64, mt) => {
            setCropState(null);
            setProcessing(true);
            setProgressStep(0);
            setProgressText('사진 업로드 중...');
            progressWidth.value = withTiming(0.1, { duration: 200 });
            fadeAnim.value = 0;
            processImage(b64, mt);
          }}
          onCancel={() => setCropState(null)}
        />
      )}

      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <ProgressOverlay
            progressSV={progressWidth}
            step={progressStep as 0 | 1 | 2 | 3}
            text={progressText}
            stepLabels={['업로드', '분석', '저장']}
          />
          {progressStep === 1 && (
            <View style={{ marginTop: 8, alignItems: 'center' }}>
              <QueueStatusBadge status="processing" label="서버 큐에서 처리 중" />
            </View>
          )}
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
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameCornerTL: {
    position: 'absolute',
    top: 112,
    left: 28,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.primary[400],
    borderTopLeftRadius: 8,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 112,
    right: 28,
    width: 40,
    height: 40,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.primary[400],
    borderTopRightRadius: 8,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 120,
    left: 28,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.primary[400],
    borderBottomLeftRadius: 8,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 120,
    right: 28,
    width: 40,
    height: 40,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.primary[400],
    borderBottomRightRadius: 8,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
  },
  topButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonActive: {
    backgroundColor: 'rgba(89, 189, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '60',
  },
  topBadgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary[400],
    borderWidth: 1.5,
    borderColor: theme.colors.dark.bg,
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
  zoomIndicator: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    zIndex: 8,
  },
  stepIndicatorWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 7,
  },
  zoomIndicatorText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  bottomControls: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 4,
    zIndex: 10,
  },
  extraButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  zoomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 4,
  },
  zoomButton: {
    width: 36,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  zoomButtonActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  zoomButtonText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  zoomButtonTextActive: {
    color: '#fff',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  modeButton: {
    flex: 1,
    maxWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  modeButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  pillButtonActive: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderColor: theme.colors.accent[400] + '80',
  },
  pillButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  pillButtonTextActive: {
    color: theme.colors.accent[300],
  },
  stylePickerPanel: {
    position: 'absolute',
    bottom: 220,
    left: theme.spacing.md,
    right: theme.spacing.md,
    maxHeight: '55%',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    overflow: 'hidden',
    zIndex: 25,
    ...theme.shadows.elevated,
  },
  templateModeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  templateModePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    alignItems: 'center',
  },
  templateModePillActive: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderColor: theme.colors.accent[400],
  },
  templateModePillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  templateModePillTextActive: {
    color: theme.colors.accent[300],
  },
  autoTemplateInfo: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  autoTemplateTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
    marginTop: theme.spacing.xs,
  },
  autoTemplateDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },
  autoTemplateConfirmBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.accent[500],
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.full,
  },
  autoTemplateConfirmText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  styleOptionScroll: {
    maxHeight: '100%',
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    marginBottom: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  styleOptionActive: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400],
  },
  styleOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  styleOptionLabel: {
    flexShrink: 1,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  styleOptionLabelActive: {
    color: theme.colors.accent[300],
  },
  styleOptionDesc: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  bottomControlsWrap: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  mediaPickerPanel: {
    position: 'absolute',
    bottom: 140,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    zIndex: 30,
    ...theme.shadows.elevated,
  },
  mediaPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  mediaPickerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPickerLabel: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  mediaPickerDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonRing: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.full,
    borderWidth: 3,
    borderColor: theme.colors.accent[400],
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.elevated,
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  hintText: {
    textAlign: 'center',
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.sm,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 200,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    backgroundColor: theme.colors.error[500] + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
    zIndex: 15,
  },
  errorBannerInline: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.error[500] + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  errorText: {
    color: theme.colors.error[400],
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  permissionTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.md,
  },
  permissionText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary[500],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.md,
  },
  permissionButtonText: {
    color: theme.colors.neutral[0],
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  uploadAltButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  uploadAltText: {
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarLeft: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  gridOverlay: {
    position: 'absolute',
    top: 112,
    bottom: 120,
    left: 0,
    right: 0,
  },
  gridLineVerticalLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridLineVerticalRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridLineHorizontalTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridLineHorizontalBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  touchLayer: {
    position: 'absolute',
    top: 112,
    bottom: 120,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  focusIndicator: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.warning[400],
    zIndex: 10,
  },
  multiShotStrip: {
    position: 'absolute',
    bottom: 200,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    zIndex: 15,
  },
  multiShotStripInline: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
  },
  multiShotScroll: {
    gap: 8,
    alignItems: 'center',
  },
  multiShotThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: theme.colors.primary[400],
  },
  multiShotImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  multiShotBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  multiShotRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeMultiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  analyzeMultiText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  webHeroIcon: {
    width: 84,
    height: 84,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500] + '15',
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
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  webGuideSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  webGuideHeading: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 4,
  },
  webGuideSubheading: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  webModeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  webModePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  webModePillActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  webUploadCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing.xl + 8,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  webUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  webUploadBtnText: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  webTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    width: '100%',
    paddingVertical: theme.spacing.md - 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '60',
  },
  webTemplateBtnContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  webTemplateBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  webTemplateBtnSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  angleGuideBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary[500] + '30',
  },
  angleGuideTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
    marginBottom: theme.spacing.md,
  },
  angleGuideGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  angleGuideItem: {
    alignItems: 'center',
    gap: 6,
  },
  angleGuideIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500] + '18',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  angleGuideEmoji: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  angleGuideLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  angleGuideDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
    textAlign: 'center',
  },
  webNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  webNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
  },
  multiTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.accent[500] + '14',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  multiTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[300],
    lineHeight: 18,
  },
  nativeAngleGuide: {
    position: 'absolute',
    bottom: 220,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    alignItems: 'center',
    zIndex: 8,
  },
  nativeAngleTooltip: {
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '40',
  },
  nativeAngleTooltipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  nativeAngleTooltipArrow: {
    position: 'absolute',
    bottom: -5,
    width: 10,
    height: 10,
    backgroundColor: 'rgba(10, 15, 30, 0.9)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.primary[400] + '40',
    transform: [{ rotate: '45deg' }],
  },
  nativeAngleGuideRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(10, 15, 30, 0.75)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  nativeAngleGuideItem: {
    alignItems: 'center',
    gap: 4,
  },
  nativeAngleGuideCircle: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '80',
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeAngleGuideNum: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  nativeAngleGuideLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 60,
    paddingHorizontal: theme.spacing.lg,
  },
  guideOverlayCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 440,
    ...theme.shadows.elevated,
  },
  guideOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  guideOverlayTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  guideCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalScroll: {
    paddingHorizontal: theme.spacing.lg,
    gap: 0,
  },
  verticalHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 4,
  },
  verticalTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  verticalSubtitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: theme.spacing.md,
  },
  cameraPreviewWrap: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  cameraPreview: {
    flex: 1,
  },
  cameraPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surface,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTouchLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  cameraTopControls: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  cameraZoomBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    zIndex: 8,
  },
  gridOverlaySmall: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  captureHint: {
    textAlign: 'center',
    color: theme.colors.dark.textDim,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs,
    lineHeight: 17,
  },
  verticalBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  verticalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  verticalBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  verticalSingleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  verticalSingleBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  styleListInline: {
    gap: 6,
  },
  autoTemplateDescSmall: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: theme.spacing.sm,
  },
  angleGuideInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  angleGuideItemInline: {
    alignItems: 'center',
    gap: 4,
  },
  angleGuideCircleInline: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '80',
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  angleGuideNumInline: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  angleGuideLabelInline: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  guideBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  guideBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
});
