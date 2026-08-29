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
import { Sparkles, Check, RefreshCw, CircleAlert as AlertCircle, Wand as Wand2, Image as ImageIcon, Download } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { friendlyError } from '@/lib/errors';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { buildDataUrl } from '@/lib/base64';

type GenStep = 'idle' | 'processing' | 'done' | 'error';

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
}

export function PromptImageGenerator({ onResult }: PromptImageGeneratorProps) {
  const [step, setStep] = useState<GenStep>('idle');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<string>('1024x1024');
  const [stylePreset, setStylePreset] = useState<string>('vivid');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
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
  }, [prompt, size, stylePreset, onResult]);

  const handleReset = useCallback(() => {
    setStep('idle');
    setResultImage(null);
    setRevisedPrompt(null);
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
            프롬프트(문장)를 입력하면 AI가 새로운 이미지를 생성합니다. 제품 사진, 라이프스타일 씬, 배경 등 원하는 장면을 자유롭게 묘사하세요. DALL-E 3 기반으로 고품질 이미지를 생성합니다.
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
