import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import {
  Flame,
  Zap,
  Link2,
  ArrowRight,
  Settings,
  Check,
  Lightbulb,
  Clock,
  Type,
  Music,
  Film,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { getItem, setItem } from '@/lib/storage';
import { getUserSettings } from '@/lib/settings';
import { HotDealPickerModal } from '@/components/HotDealPickerModal';
import { ClipboardAffiliateBanner } from '@/components/ClipboardAffiliateBanner';
import { validateAffiliateUrl } from '@/lib/affiliate';
import { extractProductMeta } from '@/lib/analysis';

const VIDEO_LENGTH_PRESETS = [
  { key: '7s', label: '7초 폭발 바이럴', desc: '틱톡·릴스 최적', icon: Zap, color: theme.colors.warning[400], seconds: 7 },
  { key: '15s', label: '15초 리뷰형', desc: '유튜브 숏츠 최적', icon: Film, color: theme.colors.primary[400], seconds: 15 },
] as const;

const CAPTION_TONE_PRESETS = [
  { key: 'hook', label: '파격 훅', desc: '호기심 유발', icon: Flame, color: theme.colors.warning[400] },
  { key: 'emotional', label: '감성/브랜드', desc: '고급 분위기', icon: Sparkles, color: theme.colors.accent[400] },
  { key: 'info', label: '정보 전달', desc: '리뷰·팩트', icon: Lightbulb, color: theme.colors.primary[400] },
] as const;

const BGM_MOOD_PRESETS = [
  { key: 'pop', label: '트렌디 팝', desc: '빠른 템포', icon: Music, color: theme.colors.accent[400] },
  { key: 'lofi', label: '릴렉스 Lofi', desc: '감성 무드', icon: Music, color: theme.colors.primary[400] },
  { key: 'none', label: '자막 전용', desc: '음악 없음', icon: Type, color: theme.colors.dark.textFaint },
] as const;

export default function MarketingScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const [hotDealModalVisible, setHotDealModalVisible] = useState(false);
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [productMeta, setProductMeta] = useState<{
    productName: string;
    description: string;
    price: string;
    image: string;
    platform: string;
    brand: string;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [videoLength, setVideoLength] = useState('7s');
  const [captionTone, setCaptionTone] = useState('hook');
  const [bgmMood, setBgmMood] = useState('pop');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastActionRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const settings = await getUserSettings();
        if (settings?.default_caption_tone) {
          const toneMap: Record<string, string> = {
            casual: 'hook',
            professional: 'info',
            emotional: 'emotional',
            humorous: 'hook',
          };
          setCaptionTone(toneMap[settings.default_caption_tone] || 'hook');
        }
        if (settings?.fixed_hook_phrase) {
          await setItem('marketing_fixed_hook', settings.fixed_hook_phrase);
        }
      } catch {}
    })();
  }, []);

  const handleSaveAffiliate = async () => {
    if (!affiliateUrl.trim()) return;
    const validation = validateAffiliateUrl(affiliateUrl);
    if (!validation.valid) {
      setExtractError(validation.error);
      return;
    }
    setAffiliateUrl(validation.normalizedUrl);
    setExtracting(true);
    setExtractError(null);
    try {
      const meta = await extractProductMeta(affiliateUrl.trim());
      setProductMeta({
        productName: meta.productName || '',
        description: meta.description || '',
        price: meta.price || '',
        image: meta.image || '',
        platform: meta.platform || '',
        brand: meta.brand || '',
      });
      setSelectedProduct(meta.productName || '선택된 상품');
    } catch {
      setProductMeta(null);
      setExtractError('상품 정보를 자동으로 가져오지 못했습니다. 직접 입력하거나 다른 링크를 시도해주세요.');
    } finally {
      setExtracting(false);
    }
  };

  const handleHotDealSelect = (product: { name: string; price: string; link: string; imageUrl?: string }) => {
    setSelectedProduct(product.name);
    setAffiliateUrl(product.link);
    setProductMeta({
      productName: product.name,
      description: '',
      price: product.price,
      image: product.imageUrl || '',
      platform: '',
      brand: '',
    });
  };

  const handleStartGeneration = async () => {
    const now = Date.now();
    if (now - lastActionRef.current < 800) return;
    lastActionRef.current = now;

    setGenerating(true);
    try {
      await setItem('marketing_video_length', videoLength);
      await setItem('marketing_caption_tone', captionTone);
      await setItem('marketing_bgm_mood', bgmMood);
      await setItem('marketing_watermark', watermarkEnabled ? 'true' : 'false');
      await setItem('marketing_handoff', 'false');
      try {
        const settings = await getUserSettings();
        if (settings?.brand_persona) {
          await setItem('marketing_brand_persona', settings.brand_persona);
        }
        if (settings?.fixed_hook_phrase) {
          await setItem('marketing_fixed_hook', settings.fixed_hook_phrase);
        }
        if (settings?.affiliate_priority_mapping) {
          await setItem('marketing_affiliate_priority', 'true');
        } else {
          await setItem('marketing_affiliate_priority', 'false');
        }
      } catch {}
      router.push('/affiliate' as never);
    } catch {
      // navigation failure — reset so user can retry
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = selectedProduct || affiliateUrl.trim();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: safeTop + theme.spacing.lg, paddingBottom: tabBarHeight + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={theme.colors.primary[400]} />
        }
      >
        {/* Header with Settings Gear */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Zap size={24} color={theme.colors.primary[300]} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.headerTitle}>숏폼 제작</Text>
              <Text style={styles.headerSub}>사진 선택 → 3초 만에 AI 숏폼 완성</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setAdvancedVisible(true)}
            activeOpacity={0.7}
          >
            <Settings size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Hot Deal Hub — Quick shortcut */}
        <TouchableOpacity
          style={styles.hotDealBtn}
          onPress={() => setHotDealModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.hotDealIcon}>
            <Flame size={20} color={theme.colors.warning[400]} strokeWidth={2.2} />
          </View>
          <View style={styles.hotDealText}>
            <Text style={styles.hotDealTitle}>실시간 핫딜에서 가져오기</Text>
            <Text style={styles.hotDealSub}>쿠팡·네이버·토스 베스트셀러를 한 번에</Text>
          </View>
          <ArrowRight size={18} color={theme.colors.warning[400]} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* URL Input Section */}
        <View style={styles.urlSection}>
          <View style={styles.urlHeader}>
            <Link2 size={18} color={theme.colors.accent[400]} strokeWidth={2.5} />
            <Text style={styles.urlTitle}>제휴 링크 입력</Text>
          </View>
          <Text style={styles.urlDesc}>링크를 붙여넣으면 AI가 상품 정보를 자동으로 추출합니다</Text>

          <ClipboardAffiliateBanner
            onInsert={(url) => setAffiliateUrl(url)}
            currentUrl={affiliateUrl}
          />

          <TextInput
            style={styles.urlInput}
            value={affiliateUrl}
            onChangeText={setAffiliateUrl}
            placeholder="제휴 링크 URL을 여기에 붙여넣으세요"
            placeholderTextColor={theme.colors.dark.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />

          <TouchableOpacity
            style={[styles.urlSubmitBtn, (!affiliateUrl.trim() || extracting) && styles.urlSubmitBtnDisabled]}
            onPress={handleSaveAffiliate}
            disabled={!affiliateUrl.trim() || extracting}
            activeOpacity={0.7}
          >
            <Text style={styles.urlSubmitBtnText}>
              {extracting ? '상품 정보 추출 중...' : '링크에서 상품 정보 추출 →'}
            </Text>
            <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>

          {extractError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{extractError}</Text>
            </View>
          )}

          {productMeta && (productMeta.productName || productMeta.price) && (
            <View style={styles.productMetaCard}>
              {productMeta.image ? (
                <Image source={{ uri: productMeta.image }} style={styles.productMetaImage} resizeMode="cover" />
              ) : null}
              <View style={styles.productMetaInfo}>
                {productMeta.productName ? (
                  <Text style={styles.productMetaName} numberOfLines={2}>{productMeta.productName}</Text>
                ) : null}
                {productMeta.price ? (
                  <Text style={styles.productMetaPrice}>{productMeta.price}</Text>
                ) : null}
                {productMeta.brand ? (
                  <Text style={styles.productMetaBrand}>{productMeta.brand}</Text>
                ) : null}
              </View>
              <View style={styles.productMetaCheck}>
                <Check size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
              </View>
            </View>
          )}
        </View>

        {/* Selected product summary */}
        {selectedProduct && (
          <View style={styles.selectedSummary}>
            <Check size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.selectedSummaryText} numberOfLines={1}>선택된 상품: {selectedProduct}</Text>
          </View>
        )}
      </ScrollView>

      {/* Sticky Generate Button */}
      <View style={[styles.stickyGenerate, { bottom: tabBarHeight + theme.spacing.sm }]}>
        <TouchableOpacity
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          onPress={handleStartGeneration}
          disabled={!canGenerate || generating}
          activeOpacity={0.85}
        >
          <Flame size={24} color="#fff" strokeWidth={2.5} />
          <Text style={styles.generateBtnText}>3초 만에 매장 광고·제휴 숏폼 만들기</Text>
          <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Hot Deal Picker Modal */}
      <HotDealPickerModal
        visible={hotDealModalVisible}
        onClose={() => setHotDealModalVisible(false)}
        onSelect={handleHotDealSelect}
      />

      {/* Advanced Settings Modal */}
      <Modal visible={advancedVisible} transparent animationType="slide" onRequestClose={() => setAdvancedVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>세부 옵션</Text>
              <TouchableOpacity onPress={() => setAdvancedVisible(false)} activeOpacity={0.7}>
                <X size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 20 }}>
              {/* Video Length */}
              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Clock size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>영상 길이</Text>
                </View>
                <View style={styles.chipRow}>
                  {VIDEO_LENGTH_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const selected = videoLength === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                        onPress={() => setVideoLength(preset.key)}
                        activeOpacity={0.7}
                      >
                        <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                        <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                        <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Caption Tone */}
              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>자막 톤앤매너</Text>
                </View>
                <View style={styles.chipRow}>
                  {CAPTION_TONE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const selected = captionTone === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                        onPress={() => setCaptionTone(preset.key)}
                        activeOpacity={0.7}
                      >
                        <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                        <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                        <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* BGM Mood */}
              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Music size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>BGM 분위기</Text>
                </View>
                <View style={styles.chipRow}>
                  {BGM_MOOD_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const selected = bgmMood === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                        onPress={() => setBgmMood(preset.key)}
                        activeOpacity={0.7}
                      >
                        <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                        <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                        <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Watermark Toggle */}
              <TouchableOpacity
                style={styles.watermarkToggle}
                onPress={() => setWatermarkEnabled(!watermarkEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.watermarkToggleLeft}>
                  <Check size={16} color={watermarkEnabled ? theme.colors.success[400] : theme.colors.dark.textDim} strokeWidth={2.5} />
                  <Text style={styles.watermarkToggleLabel}>워터마크 삽입</Text>
                </View>
                <View style={[styles.toggleSwitch, watermarkEnabled && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleKnob, watermarkEnabled && styles.toggleKnobActive]} />
                </View>
              </TouchableOpacity>

              {/* Full Settings Link */}
              <TouchableOpacity
                style={styles.fullSettingsBtn}
                onPress={() => {
                  setAdvancedVisible(false);
                  router.push('/settings' as never);
                }}
                activeOpacity={0.7}
              >
                <Settings size={18} color={theme.colors.primary[300]} strokeWidth={2} />
                <Text style={styles.fullSettingsText}>전체 설정 열기</Text>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hotDealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '40',
  },
  hotDealIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hotDealText: {
    flex: 1,
  },
  hotDealTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  hotDealSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  urlSection: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  urlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  urlTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  urlDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  urlInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.sm,
    minHeight: 80,
  },
  urlSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
  },
  urlSubmitBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  urlSubmitBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  errorBox: {
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  productMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
    marginTop: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.success[400] + '30',
  },
  productMetaImage: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
  },
  productMetaInfo: {
    flex: 1,
    gap: 2,
  },
  productMetaName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  productMetaPrice: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  productMetaBrand: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  productMetaCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedSummaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    flex: 1,
  },
  stickyGenerate: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.radius.xl,
    paddingVertical: 18,
    ...theme.shadows.glowPrimary,
  },
  generateBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  generateBtnText: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.dark.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: theme.spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modalScroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  presetGroup: {
    gap: 8,
  },
  presetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  chipPillLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  chipPillDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  watermarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  watermarkToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  watermarkToggleLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.dark.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.success[500],
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  fullSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
  },
  fullSettingsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
});
