import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Zap, ScanSearch, Copy, Check, Clock, ShieldCheck, Sparkles, Target, Palette as PaletteIcon } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { VIRAL_SHORTFORM_URL, supabaseAnonKey } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';

export interface ViralShortformPackage {
  vision: {
    category: string;
    coreFeature: string;
    targetAudience: string;
    mood: string;
    colorPalette: { name: string; hex: string }[];
  };
  psychology: {
    lossAversion: string;
    painPoint: string;
    justification: string;
    primaryTrigger: string;
    consumerDesire: string;
  };
  timeline: {
    totalDuration: number;
    segments: {
      startTime: number;
      endTime: number;
      phase: string;
      narration: string;
      overlayText: string;
      visualDirection: string;
    }[];
    mandatoryDisclosure: {
      text: string;
      position: string;
      startTime: number;
      endTime: number;
    };
  };
  output: {
    hookPhrase: string;
    caption: string;
    hashtags: string[];
    ctaText: string;
  };
  isFallback: boolean;
}

interface ViralShortformArchitectProps {
  imageDataUrl: string;
  mimeType?: string;
  affiliatePlatform?: string;
  productName?: string;
}

export function ViralShortformArchitect({ imageDataUrl, mimeType, affiliatePlatform, productName }: ViralShortformArchitectProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ViralShortformPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!imageDataUrl || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(VIRAL_SHORTFORM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          imageDataUrl,
          mimeType: mimeType || 'image/jpeg',
          affiliatePlatform,
          productName,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errText}`);
      }

      const data = await response.json() as ViralShortformPackage;
      setResult(data);
    } catch (err) {
      setError(friendlyError(err, '숏폼 패키지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setLoading(false);
    }
  }, [imageDataUrl, mimeType, affiliatePlatform, productName, loading]);

  const handleCopy = useCallback((text: string, field: string) => {
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const phaseColors: Record<string, string> = {
    Hook: theme.colors.error[400],
    Interest: theme.colors.warning[400],
    Desire: theme.colors.primary[400],
    Action: theme.colors.success[400],
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Zap size={20} color="#fff" strokeWidth={2.5} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>초고속 바이럴 숏폼 아키텍트</Text>
          <Text style={styles.subtitle}>사진 한 장으로 AIDCA 15초 숏폼 패키지 자동 생성</Text>
        </View>
      </View>

      {!result && !loading && (
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
          <ScanSearch size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.generateBtnText}>숏폼 패키지 자동 생성</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary[400]} />
          <Text style={styles.loadingText}>비전 분석 · 심리 트리거 매핑 · 타임라인 조립 중...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {/* Phase 1: Vision Analysis */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ScanSearch size={16} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.sectionTitle}>1. 비전 분석</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>카테고리</Text>
              <Text style={styles.fieldValue}>{result.vision.category}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>핵심 특장점</Text>
              <Text style={styles.fieldValue}>{result.vision.coreFeature}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>타겟층</Text>
              <Text style={styles.fieldValue}>{result.vision.targetAudience}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>무드</Text>
              <Text style={styles.fieldValue}>{result.vision.mood}</Text>
            </View>
            {result.vision.colorPalette.length > 0 && (
              <View style={styles.colorPaletteRow}>
                <PaletteIcon size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                {result.vision.colorPalette.map((c, i) => (
                  <View key={i} style={[styles.colorChip, { backgroundColor: c.hex }]}>
                    <Text style={styles.colorChipText}>{c.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Phase 2: Psychology */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Target size={16} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.sectionTitle}>2. 심리 트리거 매핑</Text>
            </View>
            <View style={styles.triggerBadge}>
              <Text style={styles.triggerBadgeText}>{result.psychology.primaryTrigger}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>손실 회피</Text>
              <Text style={styles.fieldValue}>{result.psychology.lossAversion}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>일상 고통 공감</Text>
              <Text style={styles.fieldValue}>{result.psychology.painPoint}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>가성비 합리화</Text>
              <Text style={styles.fieldValue}>{result.psychology.justification}</Text>
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>소비자 욕구</Text>
              <Text style={styles.fieldValue}>{result.psychology.consumerDesire}</Text>
            </View>
          </View>

          {/* Phase 3: Timeline */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={16} color={theme.colors.success[400]} strokeWidth={2} />
              <Text style={styles.sectionTitle}>3. AIDCA 15초 타임라인</Text>
            </View>
            {result.timeline.segments.map((seg, i) => (
              <View key={i} style={styles.timelineSegment}>
                <View style={[styles.timelinePhaseBar, { backgroundColor: phaseColors[seg.phase] || theme.colors.primary[400] }]}>
                  <Text style={styles.timelinePhaseTime}>{seg.startTime}-{seg.endTime}초</Text>
                  <Text style={styles.timelinePhaseName}>{seg.phase}</Text>
                </View>
                <Text style={styles.timelineNarration}>{seg.narration}</Text>
                <Text style={styles.timelineOverlay}>자막: {seg.overlayText}</Text>
                <Text style={styles.timelineVisual}>연출: {seg.visualDirection}</Text>
              </View>
            ))}
            {/* Mandatory disclosure */}
            <View style={styles.disclosureBox}>
              <ShieldCheck size={16} color={theme.colors.success[500]} strokeWidth={2} />
              <View style={styles.disclosureTextWrap}>
                <Text style={styles.disclosureLabel}>공정위 필수 고지 (마지막 2초)</Text>
                <Text style={styles.disclosureText}>{result.timeline.mandatoryDisclosure.text}</Text>
              </View>
            </View>
          </View>

          {/* Output Package */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Sparkles size={16} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.sectionTitle}>4. 출력 패키지</Text>
            </View>
            <View style={styles.outputCard}>
              <View style={styles.outputCardHeader}>
                <Text style={styles.outputCardLabel}>후킹 문구</Text>
                <TouchableOpacity onPress={() => handleCopy(result.output.hookPhrase, 'hook')}>
                  {copiedField === 'hook' ? <Check size={16} color={theme.colors.success[400]} /> : <Copy size={16} color={theme.colors.dark.textDim} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.outputCardContent}>{result.output.hookPhrase}</Text>
            </View>
            <View style={styles.outputCard}>
              <View style={styles.outputCardHeader}>
                <Text style={styles.outputCardLabel}>캡션</Text>
                <TouchableOpacity onPress={() => handleCopy(result.output.caption, 'caption')}>
                  {copiedField === 'caption' ? <Check size={16} color={theme.colors.success[400]} /> : <Copy size={16} color={theme.colors.dark.textDim} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.outputCardContent}>{result.output.caption}</Text>
            </View>
            <View style={styles.outputCard}>
              <View style={styles.outputCardHeader}>
                <Text style={styles.outputCardLabel}>해시태그</Text>
                <TouchableOpacity onPress={() => handleCopy(result.output.hashtags.map((h) => `#${h}`).join(' '), 'hashtags')}>
                  {copiedField === 'hashtags' ? <Check size={16} color={theme.colors.success[400]} /> : <Copy size={16} color={theme.colors.dark.textDim} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.outputCardContent}>{result.output.hashtags.map((h) => `#${h}`).join(' ')}</Text>
            </View>
            <View style={styles.outputCard}>
              <View style={styles.outputCardHeader}>
                <Text style={styles.outputCardLabel}>CTA 문구</Text>
                <TouchableOpacity onPress={() => handleCopy(result.output.ctaText, 'cta')}>
                  {copiedField === 'cta' ? <Check size={16} color={theme.colors.success[400]} /> : <Copy size={16} color={theme.colors.dark.textDim} />}
                </TouchableOpacity>
              </View>
              <Text style={styles.outputCardContent}>{result.output.ctaText}</Text>
            </View>
          </View>

          {result.isFallback && (
            <Text style={styles.fallbackNote}>기본 패키지가 생성되었습니다. AI 키를 설정하면 더 정밀한 결과를 받을 수 있습니다.</Text>
          )}

          <TouchableOpacity style={styles.regenerateBtn} onPress={handleGenerate} activeOpacity={0.85}>
            <Text style={styles.regenerateBtnText}>다시 생성</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[400],
    ...theme.shadows.elevated,
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary[400],
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  resultScroll: {
    maxHeight: 700,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    minWidth: 80,
  },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  colorChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  colorChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: '#fff',
  },
  triggerBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[400],
    marginBottom: 8,
  },
  triggerBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  timelineSegment: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: 8,
  },
  timelinePhaseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    marginBottom: 6,
  },
  timelinePhaseTime: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  timelinePhaseName: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  timelineNarration: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  timelineOverlay: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: 2,
  },
  timelineVisual: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  disclosureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginTop: 4,
  },
  disclosureTextWrap: {
    flex: 1,
  },
  disclosureLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginBottom: 2,
  },
  disclosureText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 16,
  },
  outputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: 8,
  },
  outputCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outputCardLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textDim,
  },
  outputCardContent: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  fallbackNote: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    textAlign: 'center',
    paddingVertical: 8,
  },
  regenerateBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
    marginBottom: 8,
  },
  regenerateBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
});
