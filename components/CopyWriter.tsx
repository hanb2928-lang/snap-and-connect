import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Sparkles, Copy, Check, Flame, Heart, BookOpen, Zap, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { COPY_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';
import type { PlatformKey } from '@/types/database';

type CopyType = 'viral' | 'info' | 'deal';

interface CopyItem {
  hook: string;
  caption: string;
  hashtags: string[];
}

interface CopyGroup {
  type: CopyType;
  label: string;
  copies: CopyItem[];
}

interface CopyWriterProps {
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  productAdvantages: string[];
  platform: PlatformKey;
}

const VERSION_TABS: { key: CopyType; label: string; icon: typeof Heart; color: string; short: string }[] = [
  { key: 'viral', label: '감성형', icon: Heart, color: theme.colors.accent[400], short: '호기심·공감 유발' },
  { key: 'info', label: '정보형', icon: BookOpen, color: theme.colors.primary[300], short: '꿀팁·비교·리뷰' },
  { key: 'deal', label: '파격할인형', icon: Zap, color: theme.colors.warning[400], short: '할인·한정·구매유도' },
];

const COUNT_OPTIONS = [3, 4, 5];

const PLATFORM_LABELS: Record<PlatformKey, string> = {
  shortform: '쇼츠·릴스·틱톡',
  instagram: '인스타그램',
  naverBlog: '네이버 블로그',
  twitter: 'X(트위터)',
  threads: '스레드',
  pinterest: '핀터레스트',
  smartstore: '스마트스토어',
};

export function CopyWriter({
  productName,
  productCategory,
  priceEstimate,
  oneLiner,
  productAdvantages,
  platform,
}: CopyWriterProps) {
  const [count, setCount] = useState(3);
  const [groups, setGroups] = useState<CopyGroup[] | null>(null);
  const [activeTab, setActiveTab] = useState<CopyType>('viral');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!productName) return;
    setGenerating(true);
    setError(false);
    setGroups(null);
    setIsFallback(false);
    setExpandedIndex(null);
    try {
      const response = await fetch(COPY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          productName,
          productCategory,
          priceEstimate,
          oneLiner,
          productAdvantages,
          copyType: 'all',
          platform,
          count,
        }),
      });
      if (!response.ok) throw new Error('generation failed');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.groups && Array.isArray(data.groups)) {
        setGroups(data.groups);
      } else if (data.copies && Array.isArray(data.copies)) {
        setGroups([{ type: 'viral', label: '감성형', copies: data.copies }]);
      }
      setIsFallback(!!data.isFallback);
    } catch {
      setError(true);
    }
    setGenerating(false);
  }, [productName, productCategory, priceEstimate, oneLiner, productAdvantages, platform, count]);

  const handleCopy = useCallback(async (item: CopyItem, index: number) => {
    const text = `${item.hook}\n\n${item.caption}\n\n${item.hashtags.map((h) => `#${h}`).join(' ')}`;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // clipboard failed silently
    }
  }, []);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const activeGroup = groups?.find((g) => g.type === activeTab) ?? null;
  const activeTabMeta = VERSION_TABS.find((t) => t.key === activeTab)!;
  const platformLabel = PLATFORM_LABELS[platform] ?? 'SNS';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>AI 플랫폼 맞춤 카피</Text>
        </View>
        <View style={styles.headerBadge}>
          <Flame size={11} color={theme.colors.warning[400]} strokeWidth={2.5} />
          <Text style={styles.headerBadgeText}>3버전 동시생성</Text>
        </View>
      </View>

      <Text style={styles.description}>
        {platformLabel}에 딱 맞는 마케팅 문구를 감성형·정보형·파격할인형 3가지 버전으로 한 번에 생성합니다. 후킹 멘트, 본문, 해시태그까지 즉시 복사 가능.
      </Text>

      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>버전당 생성 개수</Text>
        <View style={styles.countGroup}>
          {COUNT_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.countPill, count === n && styles.countPillActive]}
              onPress={() => setCount(n)}
              activeOpacity={0.7}
            >
              <Text style={[styles.countPillText, count === n && styles.countPillTextActive]}>{n}개</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.generateButton, generating && styles.generateButtonDisabled]}
        onPress={handleGenerate}
        disabled={generating || !productName}
        activeOpacity={0.8}
      >
        {generating ? (
          <ActivityIndicator size={18} color="#fff" />
        ) : (
          <Sparkles size={18} color="#fff" strokeWidth={2} />
        )}
        <Text style={styles.generateButtonText}>
          {generating ? '3버전 생성 중...' : '3버전 동시에 생성하기'}
        </Text>
      </TouchableOpacity>

      {!productName && (
        <Text style={styles.hintText}>제품명이 필요합니다. 위에 제품명을 입력해주세요.</Text>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.</Text>
        </View>
      )}

      {groups && groups.length > 0 && (
        <View style={styles.resultsWrap}>
          <View style={styles.resultsHeader}>
            <View style={styles.resultsHeaderLeft}>
              <Text style={styles.resultsHeaderText}>
                {platformLabel} 맞춤 카피 {groups.length}버전 생성됨
              </Text>
              {isFallback && (
                <View style={styles.fallbackBadge}>
                  <Text style={styles.fallbackBadgeText}>스마트 템플릿</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleGenerate} disabled={generating} activeOpacity={0.7} style={styles.refreshBtn}>
              <RefreshCw size={13} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.refreshText}>다시 생성</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionTabs}>
            {VERSION_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              const tabGroup = groups.find((g) => g.type === tab.key);
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.versionTab, isActive && { backgroundColor: tab.color + '20', borderColor: tab.color }]}
                  onPress={() => { setActiveTab(tab.key); setExpandedIndex(null); }}
                  activeOpacity={0.7}
                >
                  <Icon size={14} color={isActive ? tab.color : theme.colors.dark.textDim} strokeWidth={2} />
                  <View style={styles.versionTabTextWrap}>
                    <Text style={[styles.versionTabText, isActive && { color: tab.color }]}>{tab.label}</Text>
                    {tabGroup && (
                      <Text style={styles.versionTabCount}>{tabGroup.copies.length}개</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.versionSubLabel}>{activeTabMeta.short}</Text>

          {activeGroup && activeGroup.copies.length > 0 ? (
            <ScrollView style={styles.copiesScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {activeGroup.copies.map((item, i) => {
                const isExpanded = expandedIndex === i;
                const isCopied = copiedIndex === i;
                return (
                  <View key={i} style={styles.copyCard}>
                    <TouchableOpacity
                      style={styles.copyHeader}
                      onPress={() => toggleExpand(i)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.copyIndexWrap, { backgroundColor: activeTabMeta.color + '30' }]}>
                        <Text style={[styles.copyIndex, { color: activeTabMeta.color }]}>{i + 1}</Text>
                      </View>
                      <Text style={styles.copyHook} numberOfLines={isExpanded ? 0 : 1}>{item.hook}</Text>
                      {isExpanded ? (
                        <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                      ) : (
                        <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                      )}
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.copyBody}>
                        <Text style={styles.copyCaption}>{item.caption}</Text>
                        {item.hashtags.length > 0 && (
                          <Text style={styles.copyHashtags}>
                            {item.hashtags.map((h) => `#${h}`).join(' ')}
                          </Text>
                        )}
                      </View>
                    )}

                    <View style={styles.copyActions}>
                      <TouchableOpacity
                        style={[styles.copyBtn, isCopied && styles.copyBtnDone]}
                        onPress={() => handleCopy(item, i)}
                        activeOpacity={0.7}
                      >
                        {isCopied ? (
                          <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
                        ) : (
                          <Copy size={13} color={theme.colors.dark.textDim} strokeWidth={2} />
                        )}
                        <Text style={[styles.copyBtnText, isCopied && { color: theme.colors.success[400] }]}>
                          {isCopied ? '복사됨' : '전체 복사'}
                        </Text>
                      </TouchableOpacity>
                      {isExpanded && (
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={async () => {
                            try {
                              if (Platform.OS === 'web' && navigator.clipboard) {
                                await navigator.clipboard.writeText(item.hook);
                              } else {
                                await Clipboard.setStringAsync(item.hook);
                              }
                              setCopiedIndex(i);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            } catch {
                              // clipboard failed silently
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Copy size={13} color={theme.colors.dark.textDim} strokeWidth={2} />
                          <Text style={styles.copyBtnText}>후킹만 복사</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.hintText}>이 버전의 카피가 없습니다. 다시 생성해주세요.</Text>
          )}
        </View>
      )}

      {groups && groups.length === 0 && !error && (
        <Text style={styles.hintText}>생성된 카피가 없습니다. 다시 시도해주세요.</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.warning[500] + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  headerBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  countGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  countPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
  },
  countPillActive: {
    backgroundColor: theme.colors.warning[500],
  },
  countPillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  countPillTextActive: {
    color: '#fff',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    ...theme.shadows.card,
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  hintText: {
    marginTop: theme.spacing.sm,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
  errorBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  resultsWrap: {
    marginTop: theme.spacing.lg,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  resultsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fallbackBadge: {
    backgroundColor: theme.colors.primary[500] + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  fallbackBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  resultsHeaderText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  versionTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  versionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  versionTabTextWrap: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  versionTabText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  versionTabCount: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 1,
  },
  versionSubLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  copiesScroll: {
    maxHeight: 600,
  },
  copyCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  copyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  copyIndexWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyIndex: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
  },
  copyHook: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  copyBody: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  copyCaption: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  copyHashtags: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
    lineHeight: 18,
  },
  copyActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.bg,
  },
  copyBtnDone: {
    backgroundColor: theme.colors.success[500] + '15',
  },
  copyBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
});
