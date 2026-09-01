import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Clapperboard, Download, Check, CircleAlert as AlertCircle, Play, RefreshCw } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { theme } from '@/lib/theme';
import { StockVideoClip } from '@/lib/pexelsVideo';
import { EditPlan } from '@/lib/videoEditPlan';
import {
  renderVideo,
  downloadRenderedVideo,
  isVideoRenderingSupported,
  RenderResult,
} from '@/lib/videoRenderer';

interface VideoRenderCardProps {
  clip: StockVideoClip | null;
  plan: EditPlan | null;
  ctaText?: string;
  disclosureText?: string;
  productName?: string;
}

export function VideoRenderCard({
  clip,
  plan,
  ctaText,
  disclosureText,
  productName,
}: VideoRenderCardProps) {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const supported = Platform.OS === 'web' && isVideoRenderingSupported();

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress / 100,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const handleRender = useCallback(async () => {
    if (!clip || !plan) return;
    setRendering(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const res = await renderVideo({
        clip,
        plan,
        ctaText,
        disclosureText,
        productName,
        onProgress: (p) => setProgress(p * 100),
      });
      setResult(res);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 렌더링에 실패했습니다.');
    } finally {
      setRendering(false);
    }
  }, [clip, plan, ctaText, disclosureText, productName]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    if (Platform.OS === 'web') {
      const name = `${productName || 'snapconnect'}-${plan?.duration || 15}s.webm`;
      downloadRenderedVideo(result.url, name);
    }
  }, [result, productName, plan]);

  const handleShare = useCallback(async () => {
    if (!result || Platform.OS !== 'web') return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const file = new File([blob], `${productName || 'snapconnect'}-${plan?.duration || 15}s.webm`, {
        type: 'video/webm',
      });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SnapConnect 영상' });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  }, [result, productName, plan, handleDownload]);

  const handleReset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setProgress(0);
    setError(null);
  }, [result]);

  if (!supported) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Clapperboard size={16} color={theme.colors.dark.textDim} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>영상 렌더링 (실시간 편집)</Text>
            <Text style={styles.subtitle}>웹 브라우저에서 지원되는 기능입니다</Text>
          </View>
        </View>
        <View style={styles.unsupportedBox}>
          <AlertCircle size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={styles.unsupportedText}>
            이 기능은 웹 브라우저(Chrome, Edge, Firefox)에서 사용할 수 있습니다. 모바일 앱에서는 웹 버전을 이용해주세요.
          </Text>
        </View>
      </View>
    );
  }

  if (!clip || !plan) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Clapperboard size={16} color={theme.colors.dark.textDim} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>영상 렌더링 (실시간 편집)</Text>
            <Text style={styles.subtitle}>
              영상을 선택하고 편집 계획을 생성한 후 렌더링할 수 있습니다
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Clapperboard size={16} color={theme.colors.primary[400]} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>영상 렌더링 (실시간 편집)</Text>
          <Text style={styles.subtitle}>
            편집 계획대로 자막·CTA·공정위 문구를 적용한 완성본 영상 생성
          </Text>
        </View>
      </View>

      {/* Plan summary */}
      <View style={styles.planSummaryRow}>
        <View style={styles.planChip}>
          <Text style={styles.planChipText}>{plan.duration}초</Text>
        </View>
        <View style={styles.planChip}>
          <Text style={styles.planChipText}>{plan.segments.length}개 컷</Text>
        </View>
        <View style={styles.planChip}>
          <Text style={styles.planChipText}>{clip.ratio}</Text>
        </View>
        <View style={styles.planChip}>
          <Text style={styles.planChipText}>{plan.musicMood}</Text>
        </View>
      </View>

      {/* Render button */}
      <TouchableOpacity
        style={[styles.renderBtn, rendering && styles.renderBtnDisabled]}
        onPress={handleRender}
        disabled={rendering}
        activeOpacity={0.8}
      >
        {rendering ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.renderBtnText}>렌더링 중...</Text>
          </>
        ) : (
          <>
            <Clapperboard size={16} color="#fff" strokeWidth={2.5} />
            <Text style={styles.renderBtnText}>영상 렌더링 시작</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Progress bar during rendering */}
      {rendering && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>영상 렌더링 진행 중</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }]}
            />
          </View>
          <Text style={styles.progressHint}>
            실시간으로 각 컷에 자막, 줌 효과, CTA 및 공정위 문구를 적용하고 있습니다
          </Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Result preview */}
      {result && !rendering && (
        <View style={styles.resultBox}>
          <View style={styles.resultHeader}>
            <View style={styles.resultBadge}>
              <Check size={12} color="#fff" strokeWidth={2.5} />
              <Text style={styles.resultBadgeText}>렌더링 완료</Text>
            </View>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.videoPreviewWrap}>
            <video
              src={result.url}
              controls
              style={{
                width: '100%',
                borderRadius: 12,
                maxHeight: 400,
              }}
            />
          </View>

          <View style={styles.resultActions}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Download size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.downloadBtnText}>다운로드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Play size={14} color={theme.colors.primary[400]} strokeWidth={2.5} />
              <Text style={styles.shareBtnText}>공유</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.resultHint}>
            WebM 형식으로 저장됩니다. 업로드 시 MP4 변환이 필요할 수 있습니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '25',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.sm + 2,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[400] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  unsupportedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  unsupportedText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  planSummaryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  planChip: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  planChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  renderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  renderBtnDisabled: {
    opacity: 0.6,
  },
  renderBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  progressPercent: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  progressTrack: {
    height: 5,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[400],
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 6,
    lineHeight: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.error[400] + '12',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginTop: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400] + '60',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 17,
  },
  resultBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '25',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.success[500],
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  videoPreviewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
  },
  downloadBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[400] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '40',
  },
  shareBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  resultHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
  },
});
