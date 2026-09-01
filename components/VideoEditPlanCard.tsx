import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Scissors,
  Brain,
  ShieldOff,
  Copy,
  Check,
  Clock,
  Music,
  Camera,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { theme } from '@/lib/theme';
import {
  EditPlan,
  CopyVariant,
  PsychologyPreset,
  fetchVideoEditPlan,
} from '@/lib/videoEditPlan';

interface VideoEditPlanCardProps {
  productName?: string;
  productCategory?: string;
  platform?: string;
  accentColor?: string;
  hook?: string;
  oneLiner?: string;
  hasVideoSelected: boolean;
}

const PSYCHOLOGY_OPTIONS: { key: PsychologyPreset; label: string; desc: string }[] = [
  { key: 'auto', label: '자동 추천', desc: 'AI가 제품에 맞는 전략 선택' },
  { key: 'loss_aversion', label: '손실 회피', desc: '놓치면 후회' },
  { key: 'curiosity_gap', label: '호기심 갭', desc: '궁금증으로 끝까지' },
  { key: 'fomo', label: 'FOMO', desc: '다들 쓴다는 압박' },
  { key: 'social_proof', label: '소셜 증명', desc: '리뷰·평점 신뢰' },
];

export function VideoEditPlanCard({
  productName,
  productCategory,
  platform,
  accentColor,
  hook,
  oneLiner,
  hasVideoSelected,
}: VideoEditPlanCardProps) {
  const [duration, setDuration] = useState<15 | 30>(15);
  const [psychPreset, setPsychPreset] = useState<PsychologyPreset>('auto');
  const [plan, setPlan] = useState<EditPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCopy, setExpandedCopy] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVideoEditPlan({
        productName,
        productCategory,
        videoDuration: duration,
        platform,
        accentColor,
        hook,
        oneLiner,
        psychologyPreset: psychPreset,
      });
      setPlan(result);
      setExpandedCopy(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '편집 계획 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [duration, psychPreset, productName, productCategory, platform, accentColor, hook, oneLiner]);

  const copyToClipboard = useCallback(async (text: string, fieldKey: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const copyFullVariant = useCallback((variant: CopyVariant, index: number) => {
    const full = [
      variant.hook,
      variant.body,
      variant.cta,
      variant.hashtags.join(' '),
      variant.disclosure,
    ].join('\n');
    copyToClipboard(full, `variant-${index}`);
  }, [copyToClipboard]);

  if (!hasVideoSelected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Scissors size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>영상 편집 계획 (15초 / 30초)</Text>
            <Text style={styles.subtitle}>
              먼저 위에서 영상을 선택해주세요. 편집 계획을 생성할 수 있습니다.
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
          <Scissors size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>영상 편집 계획 (15초 / 30초)</Text>
          <Text style={styles.subtitle}>
            알고리즘 최적화 길이로 편집 · 중복 감지 회피 · 심리 후킹 적용
          </Text>
        </View>
      </View>

      {/* Duration selector */}
      <View style={styles.durationRow}>
        {[15, 30].map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.durationBtn, duration === d && styles.durationBtnActive]}
            onPress={() => setDuration(d as 15 | 30)}
            activeOpacity={0.7}
          >
            <Clock size={13} color={duration === d ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={[styles.durationBtnText, duration === d && styles.durationBtnTextActive]}>
              {d}초
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Sparkles size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.generateBtnText}>편집 계획 생성</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Psychology strategy selector */}
      <View style={styles.psychRow}>
        <View style={styles.psychLabelWrap}>
          <Brain size={12} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.psychLabel}>심리 전략</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.psychScroll}>
          {PSYCHOLOGY_OPTIONS.map((opt) => {
            const isActive = psychPreset === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.psychChip, isActive && styles.psychChipActive]}
                onPress={() => setPsychPreset(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.psychChipLabel, isActive && styles.psychChipLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.psychChipDesc, isActive && styles.psychChipDescActive]}>
                  {opt.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {plan && (
        <ScrollView style={styles.planScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {/* Reason */}
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>{plan.reason}</Text>
          </View>

          {/* Segments timeline */}
          <Text style={styles.sectionLabel}>컷 편집 타임라인</Text>
          <View style={styles.segmentsWrap}>
            {plan.segments.map((seg, i) => (
              <View key={i} style={styles.segmentRow}>
                <View style={styles.segmentTime}>
                  <Text style={styles.segmentTimeText}>{seg.startSec}~{seg.endSec}초</Text>
                </View>
                <View style={styles.segmentBody}>
                  <Text style={styles.segmentLabel}>{seg.label}</Text>
                  <Text style={styles.segmentPurpose}>{seg.purpose}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Hook timing */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.infoCardTitle}>후킹 타이밍</Text>
            </View>
            <Text style={styles.infoCardBody}>
              첫 후킹: {plan.hookTiming.firstHookSec}초{'\n'}{plan.hookTiming.reason}
            </Text>
          </View>

          {/* Psychology */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Brain size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.infoCardTitle}>심리학 적용</Text>
            </View>
            <Text style={styles.infoCardLabel}>원리: {plan.psychology.principle}</Text>
            <Text style={styles.infoCardBody}>{plan.psychology.application}</Text>
            <Text style={styles.infoCardTrigger}>트리거 지점: {plan.psychology.triggerPoint}</Text>
          </View>

          {/* Anti-algorithm */}
          <View style={styles.infoCardAnti}>
            <View style={styles.infoCardHeader}>
              <ShieldOff size={14} color={theme.colors.success[400]} strokeWidth={2} />
              <Text style={styles.infoCardTitle}>알고리즘 중복 회피 전략</Text>
            </View>
            <View style={styles.antiItem}>
              <Text style={styles.antiLabel}>문구 변형</Text>
              <Text style={styles.antiText}>{plan.antiAlgorithm.copyVariation}</Text>
            </View>
            <View style={styles.antiItem}>
              <Text style={styles.antiLabel}>페이싱</Text>
              <Text style={styles.antiText}>{plan.antiAlgorithm.pacingStrategy}</Text>
            </View>
            <View style={styles.antiItem}>
              <Text style={styles.antiLabel}>비주얼 변경</Text>
              <Text style={styles.antiText}>{plan.antiAlgorithm.visualChangeStrategy}</Text>
            </View>
            <View style={styles.antiItem}>
              <Text style={styles.antiLabel}>오디오 변경</Text>
              <Text style={styles.antiText}>{plan.antiAlgorithm.audioChangeStrategy}</Text>
            </View>
          </View>

          {/* Music & motion */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Music size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.metaChipText}>{plan.musicMood}</Text>
            </View>
            <View style={styles.metaChip}>
              <Camera size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.metaChipText}>{plan.motionPreset}</Text>
            </View>
          </View>

          {/* Copy variants */}
          <Text style={styles.sectionLabel}>카피 변형 (알고리즘 피하기)</Text>
          {plan.copyVariants.map((variant, i) => {
            const isExpanded = expandedCopy === i;
            return (
              <View key={i} style={styles.copyCard}>
                <TouchableOpacity
                  style={styles.copyHeader}
                  onPress={() => setExpandedCopy(isExpanded ? null : i)}
                  activeOpacity={0.7}
                >
                  <View style={styles.copyHeaderLeft}>
                    <View style={styles.copyBadge}>
                      <Text style={styles.copyBadgeText}>A/B {i + 1}</Text>
                    </View>
                    <Text style={styles.copyHookPreview} numberOfLines={1}>{variant.hook}</Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.copyBody}>
                    <View style={styles.copyField}>
                      <Text style={styles.copyFieldLabel}>후킹</Text>
                      <Text style={styles.copyFieldText}>{variant.hook}</Text>
                    </View>
                    <View style={styles.copyField}>
                      <Text style={styles.copyFieldLabel}>본문</Text>
                      <Text style={styles.copyFieldText}>{variant.body}</Text>
                    </View>
                    <View style={styles.copyField}>
                      <Text style={styles.copyFieldLabel}>CTA</Text>
                      <Text style={styles.copyFieldText}>{variant.cta}</Text>
                    </View>
                    <View style={styles.copyField}>
                      <Text style={styles.copyFieldLabel}>해시태그</Text>
                      <Text style={styles.copyFieldText}>{variant.hashtags.join(' ')}</Text>
                    </View>
                    <View style={styles.copyField}>
                      <Text style={styles.copyFieldLabel}>공정위 문구</Text>
                      <Text style={styles.copyFieldText}>{variant.disclosure}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyAllBtn}
                      onPress={() => copyFullVariant(variant, i)}
                      activeOpacity={0.7}
                    >
                      {copiedField === `variant-${i}` ? (
                        <>
                          <Check size={13} color="#fff" strokeWidth={2.5} />
                          <Text style={styles.copyAllBtnText}>복사됨!</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={13} color="#fff" strokeWidth={2} />
                          <Text style={styles.copyAllBtnText}>전체 복사</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
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
    borderColor: theme.colors.warning[400] + '25',
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
    backgroundColor: theme.colors.warning[400] + '20',
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
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  durationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  durationBtnActive: {
    backgroundColor: theme.colors.warning[500],
    borderColor: theme.colors.warning[400],
  },
  durationBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  durationBtnTextActive: {
    color: '#fff',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warning[500],
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  generateBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  psychRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  psychLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  psychLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  psychScroll: {
    flex: 1,
  },
  psychChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    marginRight: 6,
  },
  psychChipActive: {
    backgroundColor: theme.colors.accent[400] + '18',
    borderColor: theme.colors.accent[400],
  },
  psychChipLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  psychChipLabelActive: {
    color: theme.colors.accent[400],
  },
  psychChipDesc: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 1,
  },
  psychChipDescActive: {
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    backgroundColor: theme.colors.error[400] + '12',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400] + '60',
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 17,
  },
  planScroll: {
    maxHeight: 600,
  },
  reasonBox: {
    backgroundColor: theme.colors.warning[400] + '12',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning[400] + '60',
  },
  reasonText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 17,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 8,
    marginTop: 4,
  },
  segmentsWrap: {
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  segmentTime: {
    backgroundColor: theme.colors.warning[400] + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 58,
  },
  segmentTimeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  segmentBody: {
    flex: 1,
  },
  segmentLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  segmentPurpose: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
    lineHeight: 15,
  },
  infoCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  infoCardAnti: {
    backgroundColor: theme.colors.success[400] + '0D',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '25',
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoCardTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  infoCardLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginBottom: 2,
  },
  infoCardBody: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  infoCardTrigger: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
  },
  antiItem: {
    marginBottom: 6,
  },
  antiLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    marginBottom: 1,
  },
  antiText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  metaChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  copyCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  copyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  copyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  copyBadge: {
    backgroundColor: theme.colors.warning[400] + '20',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  copyBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  copyHookPreview: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
    flex: 1,
  },
  copyBody: {
    padding: 10,
    paddingTop: 0,
    gap: 8,
  },
  copyField: {},
  copyFieldLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 2,
  },
  copyFieldText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 17,
  },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    backgroundColor: theme.colors.warning[500],
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    marginTop: 4,
  },
  copyAllBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
