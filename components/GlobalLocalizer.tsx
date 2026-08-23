import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';

import { Globe, Zap, CircleAlert as AlertCircle, Volume2, Check, ShoppingBag, ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { LOCALIZE_FUNCTION_URL, TTS_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';

interface LocalizedContent {
  language: string;
  languageCode: string;
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
  narrationText: string;
  ttsVoice: string;
  affiliatePlatform: string;
  affiliateUrl: string;
}

interface GlobalLocalizerProps {
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
  productName: string;
  productCategory: string;
  narrationText?: string;
  affiliateUrl?: string;
}

const TARGET_LANGUAGES = [
  { label: 'English', code: 'en', flag: 'US' },
  { label: '日本語', code: 'ja', flag: 'JP' },
  { label: '中文', code: 'zh', flag: 'CN' },
  { label: 'Español', code: 'es', flag: 'ES' },
  { label: 'Tiếng Việt', code: 'vi', flag: 'VN' },
  { label: 'ภาษาไทย', code: 'th', flag: 'TH' },
  { label: 'Bahasa', code: 'id', flag: 'ID' },
];

export function GlobalLocalizer({
  hook,
  title,
  caption,
  hashtags,
  productName,
  productCategory,
  narrationText,
  affiliateUrl,
}: GlobalLocalizerProps) {
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['en', 'ja']);
  const [localizations, setLocalizations] = useState<LocalizedContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedLang, setExpandedLang] = useState<string | null>(null);
  const [ttsResults, setTtsResults] = useState<Record<string, string>>({});
  const [guideExpanded, setGuideExpanded] = useState(false);


  const toggleLang = useCallback((code: string) => {
    setSelectedLangs(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }, []);

  const handleLocalize = useCallback(async () => {
    if (selectedLangs.length === 0) return;
    setLoading(true);
    setError(null);
    setLocalizations([]);
    setTtsResults({});
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(LOCALIZE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          hook,
          title,
          caption,
          hashtags,
          productName,
          productCategory,
          narrationText,
          targetLanguages: selectedLangs,
          affiliateUrl,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.localizations && Array.isArray(data.localizations)) {
          setLocalizations(data.localizations);
        }
      } else {
        setError('번역에 실패했어요. 다시 시도해주세요');
      }
    } catch {
      setError('네트워크 오류로 번역에 실패했어요');
    }
    setLoading(false);
  }, [selectedLangs, hook, title, caption, hashtags, productName, productCategory, narrationText, affiliateUrl]);

  const handleGenerateTTS = useCallback(async (langCode: string, text: string, voice: string) => {
    if (!text) return;
    setTtsLoading(langCode);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(TTS_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ text, voice, speed: 1.0 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          setTtsResults(prev => ({ ...prev, [langCode]: `data:audio/mpeg;base64,${data.audioBase64}` }));
        }
      }
    } catch {
      // TTS failed silently
    }
    setTtsLoading(null);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlePlayTTS = useCallback(async (langCode: string) => {
    const dataUrl = ttsResults[langCode];
    if (!dataUrl) return;
    if (Platform.OS !== 'web') return;
    try {
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // playback failed
    }
  }, [ttsResults]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Globe size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>글로벌 원클릭 로컬라이징</Text>
        </View>
      </View>

      <Text style={styles.description}>
        버튼 하나로 후킹, 캡션, 해시태그, AI 내레이션을 7개국 언어로 동시 번역하고 글로벌 이커머스 링크를 연동합니다. 각 국가의 틱톡샵 플랫폼에 맞춰 현지화된 카피와 AI 성우 음성을 자동 생성합니다.
      </Text>

      <TouchableOpacity
        style={styles.guideToggle}
        onPress={() => setGuideExpanded(!guideExpanded)}
        activeOpacity={0.7}
      >
        <Info size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
        <Text style={styles.guideToggleText}>사용법 {guideExpanded ? '접기' : '펼치기'}</Text>
        {guideExpanded ? <ChevronUp size={12} color={theme.colors.dark.textDim} strokeWidth={2} /> : <ChevronDown size={12} color={theme.colors.dark.textDim} strokeWidth={2} />}
      </TouchableOpacity>

      {guideExpanded && (
        <View style={styles.guideBox}>
          <View style={styles.guideStep}>
            <Text style={styles.guideStepNum}>1</Text>
            <Text style={styles.guideStepText}>번역할 언어를 탭하여 선택하세요 (여러 개 동시 선택 가능)</Text>
          </View>
          <View style={styles.guideStep}>
            <Text style={styles.guideStepNum}>2</Text>
            <Text style={styles.guideStepText}>"동시 번역" 버튼을 누르면 AI가 후킹·캡션·해시태그를 현지화합니다</Text>
          </View>
          <View style={styles.guideStep}>
            <Text style={styles.guideStepNum}>3</Text>
            <Text style={styles.guideStepText}>각 언어 카드를 펼쳐서 번역된 카피와 현지 해시태그를 확인하세요</Text>
          </View>
          <View style={styles.guideStep}>
            <Text style={styles.guideStepNum}>4</Text>
            <Text style={styles.guideStepText}>"AI 음성 생성"으로 현지 언어 내레이션을 만들고 재생하세요</Text>
          </View>
          <View style={styles.guideTipRow}>
            <ShoppingBag size={10} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.guideTipText}>각 언어별 TikTok Shop 플랫폼이 자동 표시됩니다</Text>
          </View>
        </View>
      )}

      <Text style={styles.optionLabel}>대상 언어 선택</Text>
      <View style={styles.langGrid}>
        {TARGET_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langPill, selectedLangs.includes(lang.code) && styles.langPillActive]}
            onPress={() => toggleLang(lang.code)}
            activeOpacity={0.7}
          >
            <Text style={[styles.langPillText, selectedLangs.includes(lang.code) && styles.langPillTextActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.localizeButton, selectedLangs.length === 0 && styles.localizeButtonDisabled]}
        onPress={handleLocalize}
        disabled={selectedLangs.length === 0 || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size={18} color="#fff" />
        ) : (
          <Zap size={18} color="#fff" strokeWidth={2} />
        )}
        <Text style={styles.localizeButtonText}>
          {loading ? 'AI 번역 중...' : `${selectedLangs.length}개국 동시 번역`}
        </Text>
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {localizations.length > 0 && (
        <View style={styles.resultsBox}>
          <Text style={styles.resultsTitle}>번역 완료 ({localizations.length}개국)</Text>
          {localizations.map((loc) => (
            <View key={loc.languageCode} style={styles.langCard}>
              <TouchableOpacity
                style={styles.langCardHeader}
                onPress={() => setExpandedLang(expandedLang === loc.languageCode ? null : loc.languageCode)}
                activeOpacity={0.7}
              >
                <View style={styles.langCardHeaderLeft}>
                  <Text style={styles.langCardLang}>{loc.language}</Text>
                  <View style={styles.platformBadge}>
                    <ShoppingBag size={9} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.platformText}>{loc.affiliatePlatform}</Text>
                  </View>
                </View>
                {expandedLang === loc.languageCode
                  ? <ChevronUp size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                  : <ChevronDown size={14} color={theme.colors.dark.textDim} strokeWidth={2} />}
              </TouchableOpacity>

              {expandedLang === loc.languageCode && (
                <View style={styles.langCardBody}>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>후킹</Text>
                    <Text style={styles.fieldValue}>{loc.hook}</Text>
                  </View>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>캡션</Text>
                    <Text style={styles.fieldValue}>{loc.caption}</Text>
                  </View>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldLabel}>해시태그</Text>
                    <Text style={styles.fieldValue}>{loc.hashtags.map(h => `#${h}`).join(' ')}</Text>
                  </View>
                  <View style={styles.ttsRow}>
                    <TouchableOpacity
                      style={styles.ttsButton}
                      onPress={() => {
                        if (ttsResults[loc.languageCode]) {
                          handlePlayTTS(loc.languageCode);
                        } else {
                          handleGenerateTTS(loc.languageCode, loc.narrationText || loc.hook, loc.ttsVoice);
                        }
                      }}
                      disabled={ttsLoading === loc.languageCode}
                      activeOpacity={0.7}
                    >
                      {ttsLoading === loc.languageCode ? (
                        <ActivityIndicator size={12} color="#fff" />
                      ) : ttsResults[loc.languageCode] ? (
                        <Volume2 size={12} color="#fff" strokeWidth={2} />
                      ) : (
                        <Volume2 size={12} color="#fff" strokeWidth={2} />
                      )}
                      <Text style={styles.ttsButtonText}>
                        {ttsLoading === loc.languageCode ? '생성 중...' : ttsResults[loc.languageCode] ? '재생' : 'AI 음성 생성'}
                      </Text>
                    </TouchableOpacity>
                    {ttsResults[loc.languageCode] && (
                      <View style={styles.ttsReadyBadge}>
                        <Check size={9} color={theme.colors.success[400]} strokeWidth={2.5} />
                        <Text style={styles.ttsReadyText}>음성 준비됨</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  langPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  langPillActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[500],
  },
  langPillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  langPillTextActive: {
    color: '#fff',
  },
  localizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
    ...theme.shadows.card,
  },
  localizeButtonDisabled: {
    opacity: 0.4,
  },
  localizeButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
    marginTop: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  resultsBox: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  resultsTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginBottom: 4,
  },
  langCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  langCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  langCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langCardLang: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.primary[500] + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  platformText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  langCardBody: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: 8,
  },
  fieldBox: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fieldLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 17,
  },
  ttsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ttsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary[600],
  },
  ttsButtonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  ttsReadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ttsReadyText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    marginBottom: theme.spacing.sm,
  },
  guideToggleText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  guideBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideStepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary[500] + '30',
    color: theme.colors.primary[300],
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    lineHeight: 18,
    overflow: 'hidden',
  },
  guideStepText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  guideTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
  },
  guideTipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
});
