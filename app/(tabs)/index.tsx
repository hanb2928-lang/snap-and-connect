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
import { Camera, Image as ImageIcon, RotateCcw, Zap, ZapOff, ScanLine, Layers, Wand as Wand2, Grid3x3, Check, Palette, Sparkles, X, Play, Film, CircleAlert } from 'lucide-react-native';
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
import { AnalysisLoadingOverlay } from '@/components/AnalysisLoadingOverlay';
import { QueueStatusBadge } from '@/components/QueueStatusBadge';
import { ImageCropModal } from '@/components/ImageCropModal';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
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
  const [stylePickerVisible, setStylePickerVisible] = useState(false);
  const [showOnboardingStyle, setShowOnboardingStyle] = useState(false);
  const [showOnboardingCapture, setShowOnboardingCapture] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [videoImportVisible, setVideoImportVisible] = useState(false);
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
      setProgressStep(0);
      setProgressText('사진 촬영 중...');
      progressWidth.value = withTiming(0.15, { duration: 300 });
      fadeAnim.value = 0;
      await processImage(compressedB64, photo.uri, compressedMime);
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
      const scanId = await saveScan(imageUrl, analysis, additionalUrls);

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
        setProgressStep(0);
        setProgressText('사진 선택 중...');
        progressWidth.value = withTiming(0.1, { duration: 200 });
        fadeAnim.value = 0;

        const img = images[0];
        const compressed = await prepareImageForApi(buildDataUrl(cleanBase64(img.base64), img.mimeType), 1280, 0.7);
        const compressedMime = getMimeTypeFromDataUrl(compressed);
        await processImage(cleanBase64(compressed), img.uri, compressedMime);
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
      setProgressStep(0);
      setProgressText('사진 선택 중...');
      progressWidth.value = withTiming(0.1, { duration: 200 });
      fadeAnim.value = 0;

      const asset = result.assets[0];
      if (!asset.uri) {
        setProcessing(false);
        return;
      }
      const { base64: compressedB64, mimeType: compressedMime } = await compressImageToBase64(asset.uri, 1280, 0.7);
      await processImage(compressedB64, asset.uri, compressedMime);
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
          analyzeImageQueued(dataUrl, fileName, mimeType, recognitionMode),
        ]);
      } finally {
        clearInterval(progressTimer);
      }

      setProgressStep(2);
      setProgressText('결과 저장 중...');
      progressWidth.value = withTiming(0.85, { duration: 300 });
      const scanId = await saveScan(imageUrl, analysis);

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
      <View style={styles.cameraWrapper}>
        {isActive && (
          <GestureDetector gesture={pinchGesture}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              flash={flash}
              zoom={zoom}
              onCameraReady={() => setCameraReady(true)}
            />
          </GestureDetector>
        )}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frameCornerTL} />
          <View style={styles.frameCornerTR} />
          <View style={styles.frameCornerBL} />
          <View style={styles.frameCornerBR} />
          {gridVisible && (
            <View style={styles.gridOverlay}>
              <View style={styles.gridLineVerticalLeft} />
              <View style={styles.gridLineVerticalRight} />
              <View style={styles.gridLineHorizontalTop} />
              <View style={styles.gridLineHorizontalBottom} />
            </View>
          )}
        </View>

        {focusIndicator.visible && (
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

        <View style={styles.touchLayer} {...cameraPanResponder.panHandlers} pointerEvents={processing ? 'none' : 'auto'} />

        <View style={styles.zoomIndicator} pointerEvents="none">
          <Text style={styles.zoomIndicatorText}>{zoomLabel}</Text>
        </View>

        <View style={[styles.topBar, { top: safeTop + 8 }]}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() => setGridVisible((g) => !g)}
              disabled={processing}
              activeOpacity={0.7}
            >
              <Grid3x3 size={20} color={gridVisible ? theme.colors.primary[400] : theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() =>
                setFlash((f) =>
                  f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off',
                )
              }
              disabled={processing}
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
                <ZapOff size={20} color={theme.colors.dark.text} strokeWidth={2} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              disabled={processing}
              activeOpacity={0.7}
            >
              <RotateCcw size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

      </View>

      <View style={styles.bottomControls}>
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
            onPress={() => {
              setRecognitionMode('single');
              setMultiShots([]);
            }}
            activeOpacity={0.7}
          >
            <ScanLine
              size={14}
              color={recognitionMode === 'single' ? '#fff' : theme.colors.dark.textDim}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.modeButtonText,
                recognitionMode === 'single' && styles.modeButtonTextActive,
              ]}
            >
              단품
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, recognitionMode === 'multi' && styles.modeButtonActive]}
            onPress={() => {
              setRecognitionMode('multi');
              setMultiShots([]);
            }}
            activeOpacity={0.7}
          >
            <Layers
              size={14}
              color={recognitionMode === 'multi' ? '#fff' : theme.colors.dark.textDim}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.modeButtonText,
                recognitionMode === 'multi' && styles.modeButtonTextActive,
              ]}
            >
              다각도 (1~4장)
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.extraButtonsRow}>
          <TouchableOpacity
            style={styles.arModeButton}
            onPress={() => setArMode(true)}
            activeOpacity={0.8}
          >
            <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.arModeText}>AR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.videoImportBtn}
            onPress={() => setVideoImportVisible(true)}
            activeOpacity={0.7}
          >
            <Film size={12} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.videoImportText}>영상</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stylePickerBtn}
            onPress={() => setStylePickerVisible((v) => !v)}
            activeOpacity={0.7}
          >
            <Palette size={12} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.stylePickerLabel}>
              {STYLE_PRESETS.find((s) => s.key === preferredStyle)?.label || '볼드'}
            </Text>
          </TouchableOpacity>
        </View>

        {stylePickerVisible && (
          <View style={styles.stylePickerPanel}>
            <Text style={styles.stylePickerTitle}>템플릿 스타일 선택</Text>
            <Text style={styles.stylePickerSubtitle}>촬영 후 이 스타일이 자동 적용됩니다</Text>
            <ScrollView style={styles.styleOptionScroll}>
              {STYLE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.styleOption, preferredStyle === preset.key && styles.styleOptionActive]}
                  onPress={() => {
                    handleStyleChange(preset.key);
                    setStylePickerVisible(false);
                  }}
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
            </ScrollView>
          </View>
        )}
      </View>

      {arMode && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <ARComicCamera
            onClose={() => setArMode(false)}
            recognitionMode={recognitionMode}
            preferredStyle={preferredStyle}
          />
        </View>
      )}

      {videoImportVisible && Platform.OS === 'web' && (
        <VideoImportGenerator
          affiliatePlatforms={[]}
          shortUrl={''}
          onClose={() => setVideoImportVisible(false)}
        />
      )}

      {videoImportVisible && Platform.OS !== 'web' && (
        <MobileVideoImport
          affiliatePlatforms={[]}
          shortUrl={''}
          onClose={() => setVideoImportVisible(false)}
        />
      )}

      {!arMode && error && (
        <View style={styles.errorBannerInline} pointerEvents="none">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!arMode && recognitionMode === 'multi' && multiShots.length > 0 && (
        <View style={styles.multiShotStripInline} pointerEvents="auto">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.multiShotScroll}>
            {multiShots.map((shot, i) => (
              <View key={`${shot.slice(0, 16)}-${i}`} style={styles.multiShotThumb}>
                <Image source={{ uri: `data:image/jpeg;base64,${shot}` }} style={styles.multiShotImage} />
                <Text style={styles.multiShotBadge}>{i + 1}</Text>
                <TouchableOpacity
                  style={styles.multiShotRemove}
                  onPress={() => handleRemoveShot(i)}
                  activeOpacity={0.7}
                >
                  <X size={12} color="#fff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.analyzeMultiBtn}
            onPress={handleAnalyzeMultiShot}
            disabled={processing}
            activeOpacity={0.8}
          >
            <Play size={16} color="#fff" strokeWidth={2.5} />
            <Text style={styles.analyzeMultiText}>
              {multiShots.length}장 분석 시작
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!arMode && (
        <View style={[styles.controls, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
          <TouchableOpacity
            style={styles.galleryButton}
            onPress={handlePickImage}
            disabled={processing}
            activeOpacity={0.7}
          >
            <ImageIcon size={24} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={processing}
            activeOpacity={0.8}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.templateOnlyButton}
            onPress={handleTemplateOnly}
            disabled={processing}
            activeOpacity={0.7}
          >
            <Wand2 size={22} color={theme.colors.accent[400]} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {!arMode && (
        <Text style={[styles.hintText, { paddingBottom: theme.spacing.xl + insets.bottom }]}>
          {processing
            ? progressText
            : recognitionMode === 'single'
              ? '단품 모드: 한 개의 제품을 정밀하게 분석합니다'
              : multiShots.length === 0
                ? '다각도 모드: 같은 제품을 여러 각도에서 촬영(최대 4장)하면 더 정확하게 분석합니다'
                : `${multiShots.length}장 촬영 완료 — 더 찍거나 분석을 시작하세요`}
        </Text>
      )}

      <OnboardingModal
        visible={showOnboardingModal}
        onComplete={() => {
          setShowOnboardingModal(false);
          setShowOnboardingStyle(true);
        }}
      />

      <OnboardingTooltip
        visible={showOnboardingStyle}
        onDismiss={() => {
          setShowOnboardingStyle(false);
          setShowOnboardingCapture(true);
        }}
        message="여기서 템플릿 스타일을 선택하세요"
        bottom={170}
        direction="down"
        duration={3000}
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

      {processing && (
        <Animated.View style={[styles.processingOverlay, overlayStyle]} onLayout={fadeIn}>
          <AnalysisLoadingOverlay
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
      const scanId = await saveScan(imageUrl, analysis);

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
      const scanId = await saveScan(imageUrl, analysis, additionalUrls);

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
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <View style={styles.webHeroIcon}>
            <Camera size={44} color={theme.colors.primary[400]} strokeWidth={1.5} />
          </View>
          <Text style={styles.webHeroTitle}>제품 사진으로 시작</Text>
          <Text style={styles.webHeroSub}>
            사진을 올리면 AI가 제품을 분석하고 마케팅 소재를 만들어 드립니다
          </Text>
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
            <Text style={styles.webTemplateBtnText}>템플릿만 만들기</Text>
          </TouchableOpacity>
        </View>

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
          <AnalysisLoadingOverlay
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
    top: 40,
    left: 24,
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.primary[400],
    borderTopLeftRadius: 8,
  },
  frameCornerTR: {
    position: 'absolute',
    top: 40,
    right: 24,
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.primary[400],
    borderTopRightRadius: 8,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    width: 36,
    height: 36,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.primary[400],
    borderBottomLeftRadius: 8,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 36,
    height: 36,
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
    width: 44,
    height: 44,
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
  zoomIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  zoomIndicatorText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  bottomControls: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 4,
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
  stylePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[500] + '40',
  },
  arModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[500] + '20',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '60',
  },
  arModeText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
  },
  videoImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[500] + '20',
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '60',
  },
  videoImportText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  stylePickerLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  stylePickerPanel: {
    position: 'absolute',
    bottom: 180,
    left: theme.spacing.md,
    right: theme.spacing.md,
    maxHeight: '60%',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    overflow: 'hidden',
    zIndex: 20,
    ...theme.shadows.elevated,
  },
  styleOptionScroll: {
    maxHeight: '100%',
  },
  stylePickerTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  stylePickerSubtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateOnlyButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    borderWidth: 4,
    borderColor: theme.colors.primary[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[400],
  },
  hintText: {
    textAlign: 'center',
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
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
    ...StyleSheet.absoluteFillObject,
  },
  gridLineVerticalLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.33%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  gridLineVerticalRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.66%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  gridLineHorizontalTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.33%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  gridLineHorizontalBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.66%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
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
    width: 96,
    height: 96,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  webHeroTitle: {
    fontSize: 28,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  webHeroSub: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
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
    maxWidth: 360,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  webUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  webUploadBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  webTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  webTemplateBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  webNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    maxWidth: 360,
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
    maxWidth: 360,
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
});
