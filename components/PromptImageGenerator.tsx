import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Sparkles, Check, RefreshCw, CircleAlert as AlertCircle, Wand as Wand2, Image as ImageIcon, Download, Store } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { friendlyError } from '@/lib/errors';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { buildDataUrl } from '@/lib/base64';

type GenStep = 'idle' | 'processing' | 'done' | 'error';

type IndustryKey =
  | 'bakery'
  | 'cafe'
  | 'restaurant'
  | 'fashion'
  | 'beauty'
  | 'grocery'
  | 'electronics'
  | 'home'
  | 'fitness'
  | 'general';

interface IndustryOption {
  key: IndustryKey;
  label: string;
  emoji: string;
}

const INDUSTRY_OPTIONS: IndustryOption[] = [
  { key: 'general', label: '일반', emoji: '📦' },
  { key: 'bakery', label: '베이커리', emoji: '🥖' },
  { key: 'cafe', label: '카페', emoji: '☕' },
  { key: 'restaurant', label: '요식업', emoji: '🍽️' },
  { key: 'fashion', label: '의류/패션', emoji: '👕' },
  { key: 'beauty', label: '뷰티/화장품', emoji: '💄' },
  { key: 'grocery', label: '식료품/마트', emoji: '🥬' },
  { key: 'electronics', label: '전자기기', emoji: '📱' },
  { key: 'home', label: '홈/리빙', emoji: '🛋️' },
  { key: 'fitness', label: '피트니스', emoji: '💪' },
];

const SIZE_PRESETS = [
  { key: '1024x1024', label: '정사각', desc: '1:1' },
  { key: '1792x1024', label: '가로형', desc: '16:9' },
  { key: '1024x1792', label: '세로형', desc: '9:16' },
] as const;

const STYLE_PRESETS = [
  { key: 'vivid', label: '선명', desc: '생동감 있는 색감' },
  { key: 'natural', label: '자연', desc: '자연스러운 느낌' },
] as const;

const PROMPT_SUGGESTIONS = [
  '화이트 배경의 깔끔한 스튜디오 제품 사진',
  '자연광 아래 야외 라이프스타일 씬',
  '따뜻한 감성 카페 인테리어 분위기',
  '트렌디한 스트릿 패션 룩북',
  '미니멀 홈카페 코지 무드',
];

interface PromptImageGeneratorProps {
  onResult?: (imageBase64: string, mimeType: string) => void;
  productName?: string;
  productCategory?: string;
}

export function PromptImageGenerator({ onResult, productName, productCategory }: PromptImageGeneratorProps) {
  const [step, setStep] = useState<GenStep>('idle');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<string>('1024x1024');
  const [stylePreset, setStylePreset] = useState<string>('vivid');
  const [industry, setIndustry] = useState<IndustryKey>('general');
  const [keepSeed, setKeepSeed] = useState(false);
  const [seedValue, setSeedValue] = useState<number | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setStep('processing');
    setError(null);
    setResultImage(null);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size,
          style: stylePreset,
          quality: 'standard',
          n: 1,
          industry,
          productName,
          productCategory,
          seed: keepSeed && seedValue !== null ? seedValue : undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: '이미지 생성에 실패했습니다.' }));
        throw new Error(errData.error || `이미지 생성 실패 (${response.status})`);
      }

      const data = await response.json();

      if (!data.image) {
        throw new Error('이미지를 생성하지 못했습니다.');
      }

      if (!mountedRef.current) return;
      setResultImage(data.image);
      setRevisedPrompt(data.revisedPrompt ?? null);
      setExpandedPrompt(data.expandedPrompt ?? null);
      if (data.seed !== undefined && data.seed !== null) {
        setSeedValue(data.seed);
      }
      setStep('done');

      if (onResult) {
        onResult(data.image, data.mimeType ?? 'image/png');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        if (mountedRef.current) { setError('이미지 생성 시간이 초과되었습니다.'); setStep('error'); }
        return;
      }
      if (!mountedRef.current) return;
      setError(friendlyError(err, '이미지 생성에 실패했습니다. 다시 시도해주세요.'));
      setStep('error');
    } finally {
      abortRef.current = null;
    }
  }, [prompt, size, stylePreset, industry, keepSeed, seedValue, productName, productCategory, onResult]);

  const handleReset = useCallback(() => {
    setStep('idle');
    setResultImage(null);
    setRevisedPrompt(null);
    setExpandedPrompt(null);
    setError(null);
  }, []);

  const handleSuggestion = useCallback((suggestion: string) => {
    setPrompt(suggestion);
  }, []);

  return (
    <View style={styles.container}>
      {/* Prompt Input */}
      <View style={styles.promptWrap}>
        <View style={styles.promptHeader}>
          <Wand2 size={14} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.promptLabel}>프롬프트 입력</Text>
        </View>
        <TextInput
          style={styles.promptInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="원하는 이미지를 문장으로 설명해주세요..."
          placeholderTextColor={theme.colors.dark.textFaint}
          multiline
          maxLength={500}
          editable={step !== 'processing'}
        />
        <Text style={styles.promptCounter}>{prompt.length}/500</Text>
      </View>

      {/* Prompt Suggestions */}
      {step === 'idle' && (
        <View style={styles.suggestionWrap}>
          <Text style={styles.suggestionLabel}>추천 프롬프트</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionList}>
            {PROMPT_SUGGESTIONS.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestionChip}
                onPress={() => handleSuggestion(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionChipText} numberOfLines={1}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Industry Picker */}
      {step !== 'processing' && step !== 'done' && (
        <View style={styles.industryWrap}>
          <View style={styles.industryHeader}>
            <Store size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.industryLabel}>업종 선택 (스타일 자동 반영)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.industryList}>
            {INDUSTRY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.industryChip, industry === opt.key && styles.industryChipActive]}
                onPress={() => setIndustry(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.industryEmoji}>{opt.emoji}</Text>
                <Text style={[styles.industryChipText, industry === opt.key && styles.industryChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Seed consistency toggle */}
      {step !== 'processing' && step !== 'done' && (
        <TouchableOpacity
          style={[styles.seedToggle, keepSeed && styles.seedToggleActive]}
          onPress={() => setKeepSeed((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.seedCheckbox, keepSeed && styles.seedCheckboxActive]}>
            {keepSeed && <Check size={12} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={[styles.seedToggleText, keepSeed && styles.seedToggleTextActive]}>
            시드 고정 (연속 생성 시 일관성 유지){seedValue !== null ? ` · 현재 시드 #${seedValue}` : ''}
          </Text>
        </TouchableOpacity>
      )}

      {/* Size & Style Options */}
      {step !== 'processing' && step !== 'done' && (
        <View style={styles.optionsRow}>
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>비율</Text>
            <View style={styles.optionPills}>
              {SIZE_PRESETS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.optionPill, size === s.key && styles.optionPillActive]}
                  onPress={() => setSize(s.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionPillText, size === s.key && styles.optionPillTextActive]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.optionPillDesc, size === s.key && styles.optionPillDescActive]}>
                    {s.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>스타일</Text>
            <View style={styles.optionPills}>
              {STYLE_PRESETS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.optionPill, stylePreset === s.key && styles.optionPillActive]}
                  onPress={() => setStylePreset(s.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionPillText, stylePreset === s.key && styles.optionPillTextActive]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.optionPillDesc, stylePreset === s.key && styles.optionPillDescActive]}>
                    {s.desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Generate Button */}
      {step !== 'done' && (
        <TouchableOpacity
          style={[
            styles.generateBtn,
            (!prompt.trim() || step === 'processing') && styles.generateBtnDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!prompt.trim() || step === 'processing'}
          activeOpacity={0.85}
        >
          {step === 'processing' ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.generateBtnText}>AI 이미지 생성 중...</Text>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.generateBtnText}>AI 이미지 생성</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Result */}
      {step === 'done' && resultImage && (
        <View style={styles.resultWrap}>
          <View style={styles.resultHeader}>
            <View style={styles.resultCheckIcon}>
              <Check size={14} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>이미지 생성 완료!</Text>
          </View>
          <Image
            source={{ uri: buildDataUrl(resultImage, 'image/png') }}
            style={styles.resultImage}
            resizeMode="contain"
          />
          {revisedPrompt && revisedPrompt !== prompt && (
            <View style={styles.revisedPromptBox}>
              <Text style={styles.revisedPromptLabel}>AI 보정 프롬프트</Text>
              <Text style={styles.revisedPromptText}>{revisedPrompt}</Text>
            </View>
          )}
          {expandedPrompt && (
            <View style={styles.expandedPromptBox}>
              <View style={styles.expandedPromptHeader}>
                <Wand2 size={11} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.expandedPromptLabel}>LLM 확장 프롬프트</Text>
              </View>
              <Text style={styles.expandedPromptText}>{expandedPrompt}</Text>
            </View>
          )}
          <View style={styles.resultBtnRow}>
            <TouchableOpacity style={styles.resultBtnSecondary} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.resultBtnSecondaryText}>다시하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resultBtnPrimary}
              onPress={() => onResult?.(resultImage, 'image/png')}
              activeOpacity={0.7}
            >
              <Check size={14} color="#fff" strokeWidth={2.5} />
              <Text style={styles.resultBtnPrimaryText}>이 이미지로 진행</Text>
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
          <ImageIcon size={12} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.infoNoteText}>
            업종을 선택하고 프롬프트를 입력하면 AI가 구조화된 프롬프트로 자동 확장하여 고품질 이미지를 생성합니다. 업종별 맞춤 환경·조명·카메라 앵글이 자동 반영되며, 시드 고정 시 연속 생성에서 시각적 일관성이 유지됩니다.
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
  promptWrap: {
    gap: 6,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  promptInput: {
    minHeight: 80,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 12,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    textAlignVertical: 'top',
  },
  promptCounter: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'right',
  },
  suggestionWrap: {
    gap: 6,
  },
  suggestionLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  suggestionList: {
    gap: 6,
    paddingVertical: 2,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  suggestionChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    maxWidth: 200,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  industryWrap: {
    gap: 6,
  },
  industryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  industryLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  industryList: {
    gap: 6,
    paddingVertical: 2,
  },
  industryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  industryChipActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '15',
  },
  industryEmoji: {
    fontSize: 14,
  },
  industryChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  industryChipTextActive: {
    color: theme.colors.accent[400],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  seedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  seedToggleActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '10',
  },
  seedCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.dark.textDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seedCheckboxActive: {
    backgroundColor: theme.colors.accent[500],
    borderColor: theme.colors.accent[500],
  },
  seedToggleText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  seedToggleTextActive: {
    color: theme.colors.accent[400],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  expandedPromptBox: {
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '08',
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '20',
    gap: 4,
  },
  expandedPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandedPromptLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  expandedPromptText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  optionGroup: {
    flex: 1,
    gap: 6,
  },
  optionLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  optionPills: {
    flexDirection: 'row',
    gap: 4,
  },
  optionPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    gap: 1,
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
    fontSize: 8,
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
  generateBtnDisabled: {
    opacity: 0.5,
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
  resultImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
  },
  revisedPromptBox: {
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: 4,
  },
  revisedPromptLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textFaint,
  },
  revisedPromptText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
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
    backgroundColor: theme.colors.success[500],
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
