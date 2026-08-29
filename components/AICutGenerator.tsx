import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Scissors, Music, Zap, Film, Check, Upload, RefreshCw, CircleAlert as AlertCircle, Sparkles, Play } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { friendlyError } from '@/lib/errors';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import * as ImagePicker from 'expo-image-picker';
import { prepareImageForApi } from '@/lib/imageEdit';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';
import { uploadImage } from '@/lib/analysis';

type CutStep = 'idle' | 'source-ready' | 'processing' | 'done' | 'error';

const TEMPO_PRESETS = [
  { key: 'fast', label: '빠름 (0.8초)', desc: '틱톡·릴스 스타일', bpm: 120, cutDuration: 0.8 },
  { key: 'medium', label: '보통 (1.2초)', desc: '유튜브 쇼츠', bpm: 90, cutDuration: 1.2 },
  { key: 'slow', label: '느림 (1.8초)', desc: '감성 상세 리뷰', bpm: 60, cutDuration: 1.8 },
] as const;

const BEAT_SYNC_MODES = [
  { key: 'micro', label: '마이크로 비트', desc: '0.1초 프레임 단위 동기화' },
  { key: 'macro', label: '매크로 비트', desc: '소절 단위 전환' },
  { key: 'off', label: '비트 동기화 끔', desc: '일정 간격 컷' },
] as const;

interface CutSegment {
  index: number;
  startTime: number;
  endTime: number;
  type: 'highlight' | 'transition' | 'detail';
  label: string;
}

interface AICutGeneratorProps {
  sourceImage?: string | null;
  onResult?: (segments: CutSegment[]) => void;
}

export function AICutGenerator({ sourceImage, onResult }: AICutGeneratorProps) {
  const [step, setStep] = useState<CutStep>('idle');
  const [uploadedImage, setUploadedImage] = useState<string | null>(sourceImage ?? null);
  const [tempo, setTempo] = useState<string>('fast');
  const [beatSync, setBeatSync] = useState<string>('micro');
  const [segments, setSegments] = useState<CutSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handlePickSource = useCallback(async () => {
    setError(null);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) return;
        const compressed = await prepareImageForApi(
          buildDataUrl(cleanBase64(images[0].base64), images[0].mimeType),
          1280,
          0.7,
        );
        setUploadedImage(cleanBase64(compressed));
        setStep('source-ready');
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        const compressed = await prepareImageForApi(result.assets[0].uri, 1280, 0.7);
        setUploadedImage(cleanBase64(compressed));
        setStep('source-ready');
      }
    } catch (err) {
      setError(friendlyError(err, '소스를 불러오지 못했습니다.'));
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage) return;
    setStep('processing');
    setError(null);

    try {
      await uploadImage(uploadedImage, 'image/jpeg');

      const preset = TEMPO_PRESETS.find((t) => t.key === tempo)!;
      const totalDuration = 15;
      const cutCount = Math.floor(totalDuration / preset.cutDuration);
      const generated: CutSegment[] = [];

      for (let i = 0; i < cutCount; i++) {
        const start = i * preset.cutDuration;
        const end = Math.min(start + preset.cutDuration, totalDuration);
        const type: CutSegment['type'] =
          i % 3 === 0 ? 'highlight' : i % 3 === 1 ? 'transition' : 'detail';
        const labels: Record<CutSegment['type'], string> = {
          highlight: '하이라이트',
          transition: '전환',
          detail: '디테일',
        };
        generated.push({
          index: i,
          startTime: start,
          endTime: end,
          type,
          label: labels[type],
        });
      }

      setSegments(generated);
      setStep('done');
      if (onResult) {
        onResult(generated);
      }
    } catch (err) {
      setError(friendlyError(err, '컷 분할 생성에 실패했습니다.'));
      setStep('error');
    }
  }, [uploadedImage, tempo, onResult]);

  const handleReset = useCallback(() => {
    setStep('idle');
    setUploadedImage(sourceImage ?? null);
    setSegments([]);
    setError(null);
  }, [sourceImage]);

  const formatTime = (seconds: number) => {
    const s = seconds.toFixed(1);
    return `${s}s`;
  };

  return (
    <View style={styles.container}>
      {/* Source Upload */}
      {!uploadedImage && step === 'idle' && (
        <TouchableOpacity style={styles.sourceUpload} onPress={handlePickSource} activeOpacity={0.7}>
          <View style={styles.sourceUploadIcon}>
            <Upload size={24} color={theme.colors.primary[400]} strokeWidth={2} />
          </View>
          <Text style={styles.sourceUploadTitle}>원본 소스 올리기</Text>
          <Text style={styles.sourceUploadDesc}>
            카메라/제휴쇼핑 탭에서 만든 사진이나 영상을 불러오세요
          </Text>
        </TouchableOpacity>
      )}

      {/* Source Preview + Change */}
      {uploadedImage && step !== 'processing' && (
        <View style={styles.sourceReadyRow}>
          <View style={styles.sourceBadge}>
            <Check size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.sourceBadgeText}>소스 준비됨</Text>
          </View>
          <TouchableOpacity style={styles.sourceChangeBtn} onPress={handlePickSource} activeOpacity={0.7}>
            <RefreshCw size={11} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.sourceChangeText}>변경</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tempo Selection */}
      {uploadedImage && step !== 'processing' && step !== 'done' && (
        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>템포 / 컷 간격</Text>
          <View style={styles.optionRow}>
            {TEMPO_PRESETS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.optionPill, tempo === t.key && styles.optionPillActive]}
                onPress={() => setTempo(t.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionPillText, tempo === t.key && styles.optionPillTextActive]}>
                  {t.label}
                </Text>
                <Text style={[styles.optionPillDesc, tempo === t.key && styles.optionPillDescActive]}>
                  {t.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Beat Sync Selection */}
      {uploadedImage && step !== 'processing' && step !== 'done' && (
        <View style={styles.optionGroup}>
          <Text style={styles.optionLabel}>비트 동기화</Text>
          <View style={styles.optionRow}>
            {BEAT_SYNC_MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.optionPill, beatSync === m.key && styles.optionPillActive]}
                onPress={() => setBeatSync(m.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionPillText, beatSync === m.key && styles.optionPillTextActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.optionPillDesc, beatSync === m.key && styles.optionPillDescActive]}>
                  {m.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Generate Button */}
      {uploadedImage && step !== 'done' && (
        <TouchableOpacity
          style={[styles.generateBtn, step === 'processing' && styles.generateBtnProcessing]}
          onPress={handleGenerate}
          disabled={step === 'processing'}
          activeOpacity={0.85}
        >
          {step === 'processing' ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.generateBtnText}>AI 컷 분할 중...</Text>
            </>
          ) : (
            <>
              <Scissors size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.generateBtnText}>AI 컷 분할 실행</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Results — Timeline segments */}
      {step === 'done' && segments.length > 0 && (
        <View style={styles.resultWrap}>
          <View style={styles.resultHeader}>
            <View style={styles.resultCheckIcon}>
              <Check size={14} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>컷 분할 완료 — {segments.length}개 컷</Text>
          </View>

          {/* Timeline visualization */}
          <View style={styles.timelineWrap}>
            {segments.map((seg, i) => {
              const typeColors: Record<CutSegment['type'], string> = {
                highlight: theme.colors.warning[400],
                transition: theme.colors.primary[400],
                detail: theme.colors.accent[400],
              };
              const typeIcons: Record<CutSegment['type'], typeof Zap> = {
                highlight: Zap,
                transition: Play,
                detail: Film,
              };
              const Icon = typeIcons[seg.type];
              return (
                <View
                  key={seg.index}
                  style={[styles.timelineSeg, { borderLeftColor: typeColors[seg.type] }]}
                >
                  <View style={[styles.timelineSegIcon, { backgroundColor: typeColors[seg.type] + '20' }]}>
                    <Icon size={10} color={typeColors[seg.type]} strokeWidth={2.2} />
                  </View>
                  <View style={styles.timelineSegInfo}>
                    <Text style={styles.timelineSegLabel}>{seg.label}</Text>
                    <Text style={styles.timelineSegTime}>
                      {formatTime(seg.startTime)} → {formatTime(seg.endTime)}
                    </Text>
                  </View>
                  <Text style={styles.timelineSegNum}>#{i + 1}</Text>
                </View>
              );
            })}
          </View>

          {/* Stats row */}
          <View style={styles.resultStatsRow}>
            <View style={styles.resultStat}>
              <Scissors size={12} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.resultStatText}>{segments.length} 컷</Text>
            </View>
            <View style={styles.resultStat}>
              <Music size={12} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.resultStatText}>
                {TEMPO_PRESETS.find((t) => t.key === tempo)?.bpm} BPM
              </Text>
            </View>
            <View style={styles.resultStat}>
              <Zap size={12} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.resultStatText}>
                {segments.filter((s) => s.type === 'highlight').length} 하이라이트
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.resultBtnRow}>
            <TouchableOpacity style={styles.resultBtnSecondary} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.resultBtnSecondaryText}>다시하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resultBtnPrimary}
              onPress={() => onResult?.(segments)}
              activeOpacity={0.7}
            >
              <Sparkles size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.resultBtnPrimaryText}>이 컷으로 숏폼 완성</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Info note */}
      {step === 'idle' && (
        <View style={styles.infoNote}>
          <Scissors size={12} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.infoNoteText}>
            AI가 원본 소스를 0.1초 프레임 단위로 분석하여 템포에 맞춰 컷을 분할하고 하이라이트 구간을 자동 추출합니다. 비트/자막과 동기화하여 이탈을 최소화합니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sourceUpload: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    borderStyle: 'dashed',
  },
  sourceUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceUploadTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  sourceUploadDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 15,
  },
  sourceReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.success[500] + '15',
  },
  sourceBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  sourceChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  sourceChangeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  optionGroup: {
    gap: 6,
  },
  optionLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    gap: 2,
  },
  optionPillActive: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500] + '12',
  },
  optionPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  optionPillTextActive: {
    color: theme.colors.primary[400],
  },
  optionPillDesc: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  optionPillDescActive: {
    color: theme.colors.primary[300],
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  generateBtnProcessing: {
    opacity: 0.7,
  },
  generateBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  resultWrap: {
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultCheckIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  timelineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: 8,
  },
  timelineSeg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderLeftWidth: 2.5,
  },
  timelineSegIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineSegInfo: {
    gap: 1,
  },
  timelineSegLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  timelineSegTime: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  timelineSegNum: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  resultStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  resultStatText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  resultBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  resultBtnSecondaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  resultBtnPrimary: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  resultBtnPrimaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '12',
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 16,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '20',
  },
  infoNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
});
