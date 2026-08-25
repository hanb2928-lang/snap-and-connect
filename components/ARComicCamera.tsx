import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated as RNAnimated,
  PanResponder,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  Sparkles,
  Camera as CameraIcon,
  Zap,
  ZapOff,
  X,
  CircleAlert as AlertCircle,
  Grid3x3,
  ScanLine,
  Layers,
  Image as ImageIcon,
  Wand as Wand2,
  Play,
  RotateCcw,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  uploadImage,
  analyzeImageQueued,
  analyzeMultiShotQueued,
  saveScan,
  saveManualScan,
} from '@/lib/analysis';
import { buildDataUrl, cleanBase64, getMimeTypeFromDataUrl } from '@/lib/base64';
import { prepareImageForApi } from '@/lib/imageEdit';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { AnalysisLoadingOverlay } from '@/components/AnalysisLoadingOverlay';
import { QueueStatusBadge } from '@/components/QueueStatusBadge';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import type { PlatformKey, AnalysisResult } from '@/types/database';

type MagicMode = 'lineart' | 'popart' | 'cartoon' | 'off';
type RecognitionMode = 'single' | 'multi';

const MAGIC_MODES: { label: string; value: MagicMode; color: string }[] = [
  { label: 'OFF', value: 'off', color: theme.colors.dark.textDim },
  { label: '웹툰', value: 'lineart', color: theme.colors.primary[400] },
  { label: '팝아트', value: 'popart', color: theme.colors.warning[400] },
  { label: '카툰', value: 'cartoon', color: theme.colors.accent[400] },
];

const ZOOM_LEVELS = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.5 },
  { label: '3x', value: 1 },
] as const;

interface ARComicCameraProps {
  onClose: () => void;
  recognitionMode?: RecognitionMode;
  preferredStyle?: PlatformKey;
}

export function ARComicCamera({
  onClose,
  recognitionMode: initialMode = 'single',
  preferredStyle = 'shortform',
}: ARComicCameraProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [magicMode, setMagicMode] = useState<MagicMode>('lineart');
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [sfxPulse, setSfxPulse] = useState(false);
  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const [closing, setClosing] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [zoomLabel, setZoomLabel] = useState('1x');
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>(initialMode);
  const [multiShots, setMultiShots] = useState<string[]>([]);
  const [progressText, setProgressText] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const [focusIndicator, setFocusIndicator] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  const scanAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;
  const focusAnim = useRef(new RNAnimated.Value(0)).current;
  const screenH = Dimensions.get('window').height;
  const scanTop = screenH * 0.1;
  const scanBottom = screenH * 0.85;

  const fadeAnim = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const pinchActive = useSharedValue(false);
  const zoomShared = useSharedValue(0);

  const updateZoom = useCallback(
    (newZoom: number) => {
      const clamped = Math.max(0, Math.min(1, newZoom));
      zoomShared.value = clamped;
      setZoom(clamped);
      const label =
        clamped === 0
          ? '1x'
          : clamped >= 0.75
            ? '3x'
            : clamped >= 0.35
              ? '2x'
              : `${(1 + clamped).toFixed(1)}x`;
      setZoomLabel(label);
    },
    [zoomShared],
  );

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

  useEffect(() => {
    if (magicMode !== 'off') {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(scanAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          RNAnimated.timing(scanAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => {
        loop.stop();
      };
    }
  }, [magicMode, scanAnim]);

  useEffect(() => {
    if (cameraReady) {
      getItem('ar_guide_seen').then((seen) => {
        if (!seen) {
          setShowFirstGuide(true);
          setItem('ar_guide_seen', 'true');
        }
      });
    }
  }, [cameraReady]);

  useEffect(() => {
    if (magicMode !== 'off' && cameraReady) {
      setBubbleVisible(true);
      const bubbleTimer = setInterval(() => {
        setSfxPulse(true);
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          RNAnimated.timing(pulseAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start(() => setSfxPulse(false));
      }, 3500);
      return () => {
        clearInterval(bubbleTimer);
        pulseAnim.stopAnimation();
      };
    } else {
      setBubbleVisible(false);
    }
  }, [magicMode, cameraReady, pulseAnim]);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setCameraReady(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [closing, onClose]);

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

  const showFocusIndicator = useCallback(
    (x: number, y: number) => {
      setFocusIndicator({ x, y, visible: true });
      RNAnimated.timing(focusAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        RNAnimated.timing(focusAnim, {
          toValue: 0,
          duration: 600,
          delay: 400,
          useNativeDriver: false,
        }).start(() => {
          setFocusIndicator((prev) => ({ ...prev, visible: false }));
        });
      });
    },
    [focusAnim],
  );

  const cameraPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !processing,
      onPanResponderGrant: (e) => {
        showFocusIndicator(e.nativeEvent.locationX, e.nativeEvent.locationY);
      },
    }),
  ).current;

  const processImage = async (base64: string, mimeType: string) => {
    const dataUrl = buildDataUrl(base64, mimeType);
    const fileName = `ar-scan-${Date.now()}`;

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
      setClosing(true);
      setCameraReady(false);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      setError(friendlyError(err, '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || processing || !cameraReady) return;
    setProcessing(true);
    setError(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        shutterSound: false,
        ...({ mute: true } as Record<string, unknown>),
      }) as { base64?: string; uri: string };
      if (!photo?.base64) throw new Error('Failed to capture image data');
      const cleanB64 = cleanBase64(photo.base64);
      const compressedDataUrl = await prepareImageForApi(
        buildDataUrl(cleanB64, 'image/jpeg'),
        1280,
        0.7,
      );
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

      setProgressStep(0);
      setProgressText('사진 촬영 중...');
      progressWidth.value = withTiming(0.15, { duration: 300 });
      fadeAnim.value = 0;
      await processImage(compressedB64, compressedMime);
    } catch (err) {
      setError(friendlyError(err, '촬영에 실패했습니다. 다시 시도해주세요.'));
      setProcessing(false);
    }
  }, [
    processing,
    cameraReady,
    recognitionMode,
    multiShots.length,
    router,
    onClose,
  ]);

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
          analyzeMultiShotQueued(multiShots, `ar-scan-${Date.now()}`),
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
      setClosing(true);
      setCameraReady(false);
      setTimeout(() => {
        onClose();
      }, 300);
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
        const images = await pickImageWeb(
          recognitionMode === 'multi',
          4 - multiShots.length,
        );
        if (images.length === 0) return;

        if (recognitionMode === 'multi') {
          const newShots: string[] = [];
          for (const img of images) {
            const compressed = await prepareImageForApi(
              buildDataUrl(cleanBase64(img.base64), img.mimeType),
              1280,
              0.7,
            );
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
        const compressed = await prepareImageForApi(
          buildDataUrl(cleanBase64(img.base64), img.mimeType),
          1280,
          0.7,
        );
        const compressedMime = getMimeTypeFromDataUrl(compressed);
        await processImage(cleanBase64(compressed), compressedMime);
      } catch (err) {
        setError(friendlyError(err, '사진 선택에 실패했습니다. 다시 시도해주세요.'));
        setProcessing(false);
      }
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.7,
        allowsMultipleSelection: recognitionMode === 'multi',
        selectionLimit: 4,
      });

      if (result.canceled || !result.assets?.[0]?.base64) return;

      if (recognitionMode === 'multi') {
        const newShots: string[] = [];
        for (const a of result.assets) {
          if (!a.base64) continue;
          const mt = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressed = await prepareImageForApi(
            buildDataUrl(cleanBase64(a.base64), mt),
            1280,
            0.7,
          );
          newShots.push(cleanBase64(compressed));
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
      const b64 = asset.base64;
      if (!b64) {
        setProcessing(false);
        return;
      }
      const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const compressed = await prepareImageForApi(
        buildDataUrl(cleanBase64(b64), mimeType),
        1280,
        0.7,
      );
      const compressedMime = getMimeTypeFromDataUrl(compressed);
      await processImage(cleanBase64(compressed), compressedMime);
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
          base64: true,
          quality: 0.7,
        });

        if (result.canceled || !result.assets?.[0]?.base64) {
          setProcessing(false);
          return;
        }

        const asset = result.assets[0];
        const b64 = asset.base64;
        if (!b64) {
          setProcessing(false);
          return;
        }
        mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        cleanB64 = cleanBase64(b64);
      }

      setProgressText('이미지 업로드 중...');
      const imageUrl = await uploadImage(cleanB64, mimeType);

      setProgressText('템플릿 준비 중...');
      const scanId = await saveManualScan(imageUrl);

      router.push({ pathname: '/result/[id]', params: { id: scanId } });
      setClosing(true);
      setCameraReady(false);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (err) {
      setError(friendlyError(err, '이미지를 불러오지 못했습니다. 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>카메라 로딩 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <CameraIcon size={56} color={theme.colors.primary[400]} strokeWidth={1.5} />
        <Text style={styles.permissionTitle}>카메라 접근이 필요해요</Text>
        <Text style={styles.permissionText}>
          AR 매직 컷을 사용하려면 카메라 권한이 필요합니다.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>카메라 접근 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadAltButton}
          onPress={handlePickImage}
          activeOpacity={0.8}
        >
          <ImageIcon size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={styles.uploadAltText}>갤러리에서 사진 선택</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filterOverlay = magicMode === 'off' ? null : (
    <View style={styles.filterOverlay} pointerEvents="none">
      {magicMode === 'lineart' && (
        <View style={[styles.colorFilter, { backgroundColor: 'rgba(20,30,60,0.15)' }]} />
      )}
      {magicMode === 'popart' && (
        <View style={[styles.colorFilter, { backgroundColor: 'rgba(255,200,0,0.08)' }]} />
      )}
      {magicMode === 'cartoon' && (
        <View style={[styles.colorFilter, { backgroundColor: 'rgba(100,180,255,0.10)' }]} />
      )}

      {bubbleVisible && (
        <View style={styles.bubbleContainer}>
          <View style={styles.speechBubble}>
            <Text style={styles.bubbleText}>이거 진짜 대박!</Text>
          </View>
          <View style={styles.bubbleTail} />
        </View>
      )}

      {sfxPulse && (
        <View style={styles.sfxContainer}>
          <Text style={styles.sfxText}>KWAANG!</Text>
        </View>
      )}

      <RNAnimated.View
        style={[
          styles.scanLine,
          {
            transform: [
              {
                translateY: scanAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [scanTop, scanBottom],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.frameCornerTL} />
      <View style={styles.frameCornerTR} />
      <View style={styles.frameCornerBL} />
      <View style={styles.frameCornerBR} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        {!closing && (
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
        {filterOverlay}

        <View style={styles.overlay} pointerEvents="none">
          {magicMode === 'off' && (
            <>
              <View style={styles.frameCornerTL} />
              <View style={styles.frameCornerTR} />
              <View style={styles.frameCornerBL} />
              <View style={styles.frameCornerBR} />
            </>
          )}
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

        <View
          style={styles.touchLayer}
          {...cameraPanResponder.panHandlers}
          pointerEvents={processing ? 'none' : 'auto'}
        />

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
              <Grid3x3
                size={20}
                color={gridVisible ? theme.colors.primary[400] : theme.colors.dark.text}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.modeTitleWrap}>
            <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.modeTitle}>AR 매직 컷</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() =>
                setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'))
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
            <TouchableOpacity
              style={styles.topButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <X size={22} color="#fff" strokeWidth={2} />
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
                zoom >= level.value - 0.01 &&
                  zoom <= level.value + 0.01 &&
                  styles.zoomButtonActive,
              ]}
              onPress={() => updateZoom(level.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.zoomButtonText,
                  zoom >= level.value - 0.01 &&
                    zoom <= level.value + 0.01 &&
                    styles.zoomButtonTextActive,
                ]}
              >
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.magicModeBar}>
          {MAGIC_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.value}
              style={[
                styles.magicPill,
                magicMode === mode.value && {
                  backgroundColor: mode.color + '30',
                  borderColor: mode.color,
                },
              ]}
              onPress={() => setMagicMode(mode.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.magicPillText,
                  magicMode === mode.value && { color: mode.color },
                ]}
              >
                {mode.label}
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
      </View>

      {error && (
        <View style={styles.errorBannerInline}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {recognitionMode === 'multi' && multiShots.length > 0 && (
        <View style={styles.multiShotStripInline} pointerEvents="auto">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.multiShotScroll}>
            {multiShots.map((shot, i) => (
              <View key={`${shot.slice(0, 16)}-${i}`} style={styles.multiShotThumb}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${shot}` }}
                  style={styles.multiShotImage}
                />
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
            <Text style={styles.analyzeMultiText}>{multiShots.length}장 분석 시작</Text>
          </TouchableOpacity>
        </View>
      )}

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
          style={[
            styles.captureButton,
            magicMode !== 'off' && styles.captureButtonMagic,
          ]}
          onPress={handleCapture}
          disabled={processing}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.captureButtonInner,
              magicMode !== 'off' && styles.captureButtonInnerMagic,
            ]}
          />
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

      <Text style={[styles.hintText, { paddingBottom: theme.spacing.xl + insets.bottom }]}>
        {processing
          ? progressText
          : recognitionMode === 'single'
            ? magicMode === 'off'
              ? '만화 필터를 선택하면 실시간 AR 효과가 적용됩니다'
              : '실시간 만화 필터 적용 중! 셔터를 누르면 AI 분석이 시작됩니다'
            : multiShots.length === 0
              ? '다각도 모드: 같은 제품을 여러 각도에서 촬영(최대 4장)하면 더 정확하게 분석합니다'
              : `${multiShots.length}장 촬영 완료 — 더 찍거나 분석을 시작하세요`}
      </Text>

      {showFirstGuide && (
        <View style={styles.guideOverlay}>
          <View style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <Sparkles size={20} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.guideTitle}>AR 매직 컷 사용법</Text>
            </View>
            <View style={styles.guideContent}>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>1</Text>
                <Text style={styles.guideDesc}>
                  아래 만화 필터(웹툰·팝아트·카툰)를 선택하세요
                </Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>2</Text>
                <Text style={styles.guideDesc}>
                  실시간으로 말풍선, 효과음, 스캔 라인이 오버레이됩니다
                </Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>3</Text>
                <Text style={styles.guideDesc}>
                  필터가 적용된 상태에서 셔터를 누르면 AI 분석이 시작됩니다
                </Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>4</Text>
                <Text style={styles.guideDesc}>
                  분석 완료 후 결과 화면에서 바이럴 예측과 글로벌 번역을 이용하세요
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.guideCloseBtn}
              onPress={() => setShowFirstGuide(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.guideCloseText}>확인했어요</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {processing && (
        <Animated.View
          style={[styles.processingOverlay, overlayStyle]}
          onLayout={fadeIn}
        >
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
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  loadingText: {
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.body,
  },
  permissionTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  permissionText: {
    fontSize: theme.typography.body,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: theme.colors.primary[500],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
  },
  permissionButtonText: {
    color: '#fff',
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
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorFilter: {
    ...StyleSheet.absoluteFillObject,
  },
  scanLine: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: theme.colors.accent[400],
    shadowColor: theme.colors.accent[400],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  frameCornerTL: {
    position: 'absolute',
    top: 40,
    left: 24,
    width: 36,
    height: 36,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.accent[400],
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
    borderColor: theme.colors.accent[400],
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
    borderColor: theme.colors.accent[400],
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
    borderColor: theme.colors.accent[400],
    borderBottomRightRadius: 8,
  },
  bubbleContainer: {
    position: 'absolute',
    top: '25%',
    left: '15%',
  },
  speechBubble: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: theme.colors.accent[400],
  },
  bubbleText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#1a1a2e',
  },
  bubbleTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.accent[400],
    marginLeft: 20,
    marginTop: -2,
  },
  sfxContainer: {
    position: 'absolute',
    top: '40%',
    right: '15%',
  },
  sfxText: {
    fontSize: 36,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    textShadowColor: '#1a1a2e',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    transform: [{ rotate: '-15deg' }],
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    zIndex: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
  modeTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
  },
  modeTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
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
  magicModeBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  magicPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  magicPillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
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
  captureButtonMagic: {
    borderColor: theme.colors.accent[400],
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[400],
  },
  captureButtonInnerMagic: {
    backgroundColor: theme.colors.accent[400],
  },
  hintText: {
    textAlign: 'center',
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.xl,
  },
  errorBanner: {
    position: 'absolute',
    bottom: 200,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
    zIndex: 15,
  },
  errorBannerInline: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  errorText: {
    flex: 1,
    color: theme.colors.error[400],
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: theme.spacing.xl,
  },
  guideCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 340,
    ...theme.shadows.elevated,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  guideTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
  },
  guideContent: {
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guideNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.accent[500] + '30',
    color: theme.colors.accent[400],
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  guideDesc: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 17,
  },
  guideCloseBtn: {
    backgroundColor: theme.colors.accent[500],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  guideCloseText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
