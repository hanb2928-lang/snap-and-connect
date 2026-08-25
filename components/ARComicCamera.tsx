import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Sparkles, Camera as CameraIcon, Zap, RefreshCw, X, CircleAlert as AlertCircle } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadImage, analyzeImage, saveScan } from '@/lib/analysis';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { useRouter } from 'expo-router';
import type { PlatformKey } from '@/types/database';

type MagicMode = 'lineart' | 'popart' | 'cartoon' | 'off';
type RecognitionMode = 'single' | 'multi';

const MAGIC_MODES: { label: string; value: MagicMode; color: string }[] = [
  { label: 'OFF', value: 'off', color: theme.colors.dark.textDim },
  { label: '웹툰', value: 'lineart', color: theme.colors.primary[400] },
  { label: '팝아트', value: 'popart', color: theme.colors.warning[400] },
  { label: '카툰', value: 'cartoon', color: theme.colors.accent[400] },
];

interface ARComicCameraProps {
  onClose: () => void;
  recognitionMode?: RecognitionMode;
  preferredStyle?: PlatformKey;
}

export function ARComicCamera({ onClose, recognitionMode = 'single', preferredStyle = 'shortform' }: ARComicCameraProps) {
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [magicMode, setMagicMode] = useState<MagicMode>('lineart');
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [sfxPulse, setSfxPulse] = useState(false);
  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const scanAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;
  const filterAnim = useRef(new RNAnimated.Value(0)).current;
  const screenH = Dimensions.get('window').height;
  const scanTop = screenH * 0.1;
  const scanBottom = screenH * 0.85;

  useEffect(() => {
    if (magicMode !== 'off') {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          RNAnimated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => { loop.stop(); };
    }
    filterAnim.setValue(magicMode === 'off' ? 0 : 1);
  }, [magicMode, scanAnim, filterAnim]);

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
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
          RNAnimated.timing(pulseAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
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
      const dataUrl = buildDataUrl(cleanB64, 'image/jpeg');
      const fileName = `ar-scan-${Date.now()}`;

      const [imageUrl, analysis] = await Promise.all([
        uploadImage(cleanB64, 'image/jpeg'),
        analyzeImage(dataUrl, fileName, 'image/jpeg', recognitionMode),
      ]);
      const scanId = await saveScan(imageUrl, analysis);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
      onClose();
    } catch (err) {
      setError(friendlyError(err, '촬영에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setProcessing(false);
    }
  }, [processing, cameraReady, recognitionMode, router, onClose]);

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
        <Text style={styles.permissionText}>AR 매직 컷을 사용하려면 카메라 권한이 필요합니다.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.8}>
          <Text style={styles.permissionButtonText}>카메라 접근 허용</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filterOverlay = magicMode === 'off' ? null : (
    <View style={styles.filterOverlay} pointerEvents="none">
      {magicMode === 'lineart' && <View style={[styles.colorFilter, { backgroundColor: 'rgba(20,30,60,0.15)' }]} />}
      {magicMode === 'popart' && <View style={[styles.colorFilter, { backgroundColor: 'rgba(255,200,0,0.08)' }]} />}
      {magicMode === 'cartoon' && <View style={[styles.colorFilter, { backgroundColor: 'rgba(100,180,255,0.10)' }]} />}

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
            transform: [{
              translateY: scanAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [scanTop, scanBottom],
              }),
            }],
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
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          flash="off"
          ratio="16:9"
          onCameraReady={() => setCameraReady(true)}
        />
        {filterOverlay}
      </View>

      <View style={[styles.topBar, { top: safeTop + 8 }]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
          <X size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.modeTitleWrap}>
          <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.modeTitle}>AR 매직 컷</Text>
        </View>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.magicModeBar}>
        {MAGIC_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[styles.magicPill, magicMode === mode.value && { backgroundColor: mode.color + '30', borderColor: mode.color }]}
            onPress={() => setMagicMode(mode.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.magicPillText, magicMode === mode.value && { color: mode.color }]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={[styles.controls, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        <View style={styles.captureWrap}>
          <TouchableOpacity
            style={[styles.captureButton, magicMode !== 'off' && styles.captureButtonMagic]}
            onPress={handleCapture}
            disabled={processing}
            activeOpacity={0.8}
          >
            <View style={[styles.captureButtonInner, magicMode !== 'off' && styles.captureButtonInnerMagic]} />
          </TouchableOpacity>
          {magicMode !== 'off' && (
            <View style={styles.captureGlow} pointerEvents="none" />
          )}
        </View>
      </View>

      <Text style={[styles.hintText, { paddingBottom: theme.spacing.xl + insets.bottom }]}>
        {processing
          ? 'AI 분석 중...'
          : magicMode === 'off'
            ? '만화 필터를 선택하면 실시간 AR 효과가 적용됩니다'
            : '실시간 만화 필터가 적용되고 있어요! 셔터를 누르면 AI 분석이 시작됩니다'}
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
                <Text style={styles.guideDesc}>아래 만화 필터(웹툰·팝아트·카툰)를 선택하세요</Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>2</Text>
                <Text style={styles.guideDesc}>실시간으로 말풍선, 효과음, 스캔 라인이 오버레이됩니다</Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>3</Text>
                <Text style={styles.guideDesc}>필터가 적용된 상태에서 셔터를 누르면 AI 분석이 시작됩니다</Text>
              </View>
              <View style={styles.guideRow}>
                <Text style={styles.guideNum}>4</Text>
                <Text style={styles.guideDesc}>분석 완료 후 결과 화면에서 바이럴 예측과 글로벌 번역을 이용하세요</Text>
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
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
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
    top: '15%',
    left: '10%',
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.accent[400],
    borderTopLeftRadius: 8,
  },
  frameCornerTR: {
    position: 'absolute',
    top: '15%',
    right: '10%',
    width: 32,
    height: 32,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: theme.colors.accent[400],
    borderTopRightRadius: 8,
  },
  frameCornerBL: {
    position: 'absolute',
    bottom: '15%',
    left: '10%',
    width: 32,
    height: 32,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: theme.colors.accent[400],
    borderBottomLeftRadius: 8,
  },
  frameCornerBR: {
    position: 'absolute',
    bottom: '15%',
    right: '10%',
    width: 32,
    height: 32,
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
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  magicModeBar: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
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
  errorBanner: {
    position: 'absolute',
    bottom: 180,
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
  },
  errorText: {
    flex: 1,
    color: theme.colors.error[400],
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  captureWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 58,
    height: 58,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[400],
  },
  captureButtonInnerMagic: {
    backgroundColor: theme.colors.accent[400],
  },
  captureGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[400] + '20',
  },
  hintText: {
    textAlign: 'center',
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    paddingHorizontal: theme.spacing.xl,
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
