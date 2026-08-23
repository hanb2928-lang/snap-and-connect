import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Tag,
  Info,
  Share2,
  Trash2,
  Sparkles,
  ShoppingBag,
  Image as ImageIcon,
  Pencil,
  Hash,
  Copy,
  Check,
  Flame,
  TrendingUp,
  Plus,
  X,
  Link2,
  MessageCircle,
  Sun,
  MoveUp,
  MoveVertical,
  MoveDown,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { deleteScan } from '@/lib/analysis';
import { getUserSettings } from '@/lib/settings';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { detectAffiliatePlatform } from '@/lib/affiliateLinkSmart';
import { getDisclosureForPlatforms } from '@/lib/disclosure';
import * as Clipboard from 'expo-clipboard';
import type { Scan, UserSettings, AffiliateLink, CustomAffiliateLink, DetectedProduct, PlatformKey, CustomReview } from '@/types/database';
import { TemplateCard, STICKER_POSITIONS, TEXT_POSITIONS } from '@/components/TemplateCard';
import type { StickerPosition, TextPosition } from '@/components/TemplateCard';
import { StickerLinkControls } from '@/components/StickerLink';
import type { StickerStyle } from '@/components/StickerLink';
import { ShareBar } from '@/components/ShareBar';
import { ShoppingMatchCard } from '@/components/ShoppingMatchCard';
import { ProductSelector } from '@/components/ProductSelector';
import { PlatformTabs } from '@/components/PlatformTabs';
import { ClipGenerator } from '@/components/ClipGenerator';
import { CarouselGenerator } from '@/components/CarouselGenerator';
import { MultiPlatformExport } from '@/components/MultiPlatformExport';
import type { AffiliatePlatformKey } from '@/components/AffiliatePlatformSwitch';
import type { LocalStoreInfo } from '@/types/database';
import { ReviewInput } from '@/components/ReviewInput';
import { CopyWriter } from '@/components/CopyWriter';
import { ComicShortGenerator } from '@/components/ComicShortGenerator';
import { LocalStoreCard } from '@/components/LocalStoreCard';
import { ShortFormTipsCard } from '@/components/ShortFormTipsCard';
import { ViralPredictor } from '@/components/ViralPredictor';
import { PersonaSimulator } from '@/components/PersonaSimulator';
import { GlobalLocalizer } from '@/components/GlobalLocalizer';
import { TrendCopyBar } from '@/components/TrendCopyBar';
import { HashtagCopyBar } from '@/components/HashtagCopyBar';
import { createShortLink } from '@/lib/shortUrl';
import { recommendStickerStyle, recommendStickerSize, getCardStyleForPlatform } from '@/lib/stickerRecommend';
import { urlToDataUrl } from '@/lib/base64';
import { getImageSize } from '@/lib/imageEdit';
import { fetchMatchedTrendingHashtags, getTrendingSuggestions } from '@/lib/trendingHashtags';
import { LoadingScreen } from '@/components/LoadingScreen';
import { friendlyError } from '@/lib/errors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '@/hooks/useSafeTop';
import { LazySection } from '@/components/LazySection';
import { ShortFormGuideCard } from '@/components/ShortFormGuideCard';
import { TrendMatchCard } from '@/components/TrendMatchCard';
import { getItem } from '@/lib/storage';

export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);
  const [customAffiliateLinks, setCustomAffiliateLinks] = useState<CustomAffiliateLink[]>([]);
  const [savingLink, setSavingLink] = useState(false);
  const [activePlatform, setActivePlatform] = useState<PlatformKey>('shortform');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [stickerPosition, setStickerPosition] = useState<StickerPosition>('top-left');
  const [stickerStyle, setStickerStyle] = useState<StickerStyle>('pill');
  const [stickerSize, setStickerSize] = useState(48);
  const [stickerUserOverride, setStickerUserOverride] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState<number | null>(null);
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [addedHashtags, setAddedHashtags] = useState<string[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliatePlatformKey>('Coupang');
  const [captureImageUrl, setCaptureImageUrl] = useState<string>('');
  const [heroAspect, setHeroAspect] = useState<number>(1);
  const [autoMarketingCopy, setAutoMarketingCopy] = useState<string | null>(null);
  const [hookOverride, setHookOverride] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);
  const [productNameInput, setProductNameInput] = useState('');
  const [productCategoryInput, setProductCategoryInput] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [localStoreInfo, setLocalStoreInfo] = useState<LocalStoreInfo | null>(null);

  const insets = useSafeAreaInsets();
  const safeTop = useSafeTop();
  const cardRef = useRef<View>(null);

  const fetchScan = useCallback(async () => {
    if (!id) {
      setError('잘못된 접근입니다.');
      setLoading(false);
      return;
    }
    try {
      const [scanResult, settingsResult] = await Promise.all([
        supabase.from('scans').select('*').eq('id', id).maybeSingle(),
        getUserSettings(),
      ]);

      if (scanResult.error) {
        setError(friendlyError(scanResult.error, '데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.'));
      } else if (!scanResult.data) {
        setError('스캔을 찾을 수 없습니다');
      } else {
        setScan(scanResult.data as Scan);
        setCustomAffiliateLinks((scanResult.data as Scan).custom_affiliate_links ?? []);
        setLocalStoreInfo((scanResult.data as Scan).local_store_info ?? null);
      }
      setSettings(settingsResult);
    } catch (err) {
      setError(friendlyError(err, '데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  useEffect(() => {
    (async () => {
      const saved = await getItem('preferred_template_style');
      if (saved) setActivePlatform(saved as PlatformKey);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchScan();
    }, [fetchScan]),
  );

  useEffect(() => {
    if (!scan) return;
    const url = scan.edited_image_url || scan.image_url;
    let cancelled = false;
    (async () => {
      const dataUrl = await urlToDataUrl(url);
      if (!cancelled) setCaptureImageUrl(dataUrl);
    })();
    (async () => {
      try {
        const size = await getImageSize(url);
        if (!cancelled && size.width && size.height) {
          setHeroAspect(size.width / size.height);
        }
      } catch {
        // keep default aspect ratio
      }
    })();
    return () => { cancelled = true; };
  }, [scan]);

  const handleDelete = async () => {
    if (!scan) return;
    try {
      await deleteScan(scan.id);
      router.back();
    } catch {
      setError('삭제 중 오류가 발생했어요');
    }
  };

  const handleStartEditProduct = () => {
    setProductNameInput(activeProductName);
    setProductCategoryInput(selectedProduct?.productCategory || scan?.product_category || '');
    setEditingProduct(true);
  };

  const handleSaveProduct = async () => {
    if (!scan) return;
    setSavingProduct(true);
    try {
      const trimmedName = productNameInput.trim();
      const trimmedCategory = productCategoryInput.trim();

      if (selectedProduct) {
        const updatedProducts = [...detectedProducts];
        updatedProducts[selectedProductIndex] = {
          ...selectedProduct,
          productName: trimmedName,
          productCategory: trimmedCategory,
        };
        const { error: updateError } = await supabase
          .from('scans')
          .update({ detected_products: updatedProducts })
          .eq('id', scan.id);
        if (updateError) throw updateError;
        setScan({ ...scan, detected_products: updatedProducts });
      } else {
        const { error: updateError } = await supabase
          .from('scans')
          .update({ product_name: trimmedName, product_category: trimmedCategory })
          .eq('id', scan.id);
        if (updateError) throw updateError;
        setScan({ ...scan, product_name: trimmedName, product_category: trimmedCategory });
      }
      setEditingProduct(false);
    } catch (err) {
      setError(friendlyError(err, '제품 정보 저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveCustomLink = async (url: string, label: string, productIndex: number): Promise<{ success: boolean; error?: string }> => {
    if (!scan) return { success: false, error: '스캔 정보를 찾을 수 없어요' };
    setSavingLink(true);
    const detectedPlatform = detectAffiliatePlatform(url);
    const updated = customAffiliateLinks.filter((l) => l.productIndex !== productIndex);
    updated.push({ platform: detectedPlatform, label, url, productIndex });
    updated.sort((a, b) => a.productIndex - b.productIndex);
    try {
      const { error: updateError } = await supabase
        .from('scans')
        .update({ custom_affiliate_links: updated })
        .eq('id', scan.id);
      if (updateError) {
        setSavingLink(false);
        return { success: false, error: '링크 저장 실패: ' + updateError.message };
      }
      setCustomAffiliateLinks(updated);
      setSelectedAffiliate(detectedPlatform);
      setSavingLink(false);
      return { success: true };
    } catch (e: any) {
      setSavingLink(false);
      return { success: false, error: '링크 저장 실패: ' + (e?.message || String(e)) };
    }
  };

  const handleRemoveCustomLink = async (productIndex: number): Promise<{ success: boolean; error?: string }> => {
    if (!scan) return { success: false, error: '스캔 정보를 찾을 수 없어요' };
    const updated = customAffiliateLinks.filter((l) => l.productIndex !== productIndex);
    try {
      const { error: updateError } = await supabase
        .from('scans')
        .update({ custom_affiliate_links: updated })
        .eq('id', scan.id);
      if (updateError) {
        return { success: false, error: '링크 삭제 실패: ' + updateError.message };
      }
      setCustomAffiliateLinks(updated);
      setAutoMarketingCopy(null);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: '링크 삭제 실패: ' + (e?.message || String(e)) };
    }
  };

  const detectedProducts: DetectedProduct[] = scan?.detected_products ?? [];
  const selectedProduct = detectedProducts[selectedProductIndex] ?? null;
  const activeProductName = selectedProduct?.productName || scan?.product_name || '';
  const activePriceEstimate = selectedProduct?.priceEstimate || scan?.price_estimate || '';
  const activeShoppingMatches = selectedProduct?.shoppingMatches ?? scan?.shopping_matches ?? [];
  const activeTemplateData = selectedProduct?.templateData ?? scan?.template_data;
  const activeOneLiner = selectedProduct?.oneLiner || scan?.one_liner || '';

  const currentAffiliateLinks: AffiliateLink[] = useMemo(() => {
    if (!scan) return [];
    return generateAffiliateLinks(
        {
          title: scan.title || '',
          summary: scan.summary || '',
          contacts: scan.contacts,
          tags: scan.tags,
          productName: activeProductName,
          productCategory: selectedProduct?.productCategory || scan?.product_category || '',
          priceEstimate: activePriceEstimate,
          oneLiner: activeOneLiner,
          shoppingMatches: activeShoppingMatches,
          templateData: activeTemplateData,
          detectedProducts: [],
        },
        settings,
      );
  }, [scan, settings, activeProductName, activePriceEstimate, activeShoppingMatches, activeTemplateData, activeOneLiner, selectedProduct]);

  const td = activeTemplateData;
  const platformVariant = td?.platformVariants?.[activePlatform];
  const activeHook = hookOverride || platformVariant?.hook || td?.hook || '';
  const activeCaption = platformVariant?.caption || td?.caption || '';
  const activeHashtags = platformVariant?.hashtags || td?.hashtags || [];
  const allDisplayHashtags = [...activeHashtags, ...addedHashtags];

  const isLinkRestrictedPlatform = activePlatform === 'instagram' || activePlatform === 'shortform';
  const commentCta = isLinkRestrictedPlatform && shortUrl ? '\n\n댓글창 링크 확인' : '';

  const baseCaption = autoMarketingCopy || (activeCaption
    ? `${activeCaption}\n\n${allDisplayHashtags.map((h) => `#${h}`).join(' ')}`
    : `${activeOneLiner || scan?.title || '숏커넥트'}\n${activeProductName ? `제품: ${activeProductName}\n` : ''}${activePriceEstimate ? `가격: ${activePriceEstimate}\n` : ''}`);
  const fullCaption = autoMarketingCopy
    ? `${baseCaption}${isLinkRestrictedPlatform ? commentCta : (shortUrl ? `\n\n${shortUrl}` : '')}`
    : `${baseCaption}`;

  const [captionCopied, setCaptionCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [hookCopied, setHookCopied] = useState(false);

  const handleCopyCaption = async () => {
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(captionWithLink);
        setCaptionCopied(true);
        setTimeout(() => setCaptionCopied(false), 2000);
      } else {
        await Clipboard.setStringAsync(captionWithLink);
        setCaptionCopied(true);
        setTimeout(() => setCaptionCopied(false), 2000);
      }
    } catch {
      // clipboard copy failed silently
    }
  };

  const handleCopyHook = async () => {
    if (!activeHook) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(activeHook);
      } else {
        await Clipboard.setStringAsync(activeHook);
      }
      setHookCopied(true);
      setTimeout(() => setHookCopied(false), 2000);
    } catch {
      // clipboard copy failed silently
    }
  };

  const handleCopyCommentLink = async () => {
    if (!shortUrl) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(shortUrl);
      } else {
        await Clipboard.setStringAsync(shortUrl);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard copy failed silently
    }
  };

  const customLinkForCurrentProduct = customAffiliateLinks.find(
    (l) => l.productIndex === selectedProductIndex,
  );

  const hasCustomLink = !!customLinkForCurrentProduct?.url;

  const platformAffiliateUrls = useMemo<Record<AffiliatePlatformKey, string | null>>(() => {
    if (!hasCustomLink) {
      return {
        Coupang: null,
        Toss: null,
        BrandConnect: null,
        OliveYoung: null,
        Ablely: null,
        Zigzag: null,
        TodayHouse: null,
        Kurly: null,
        AliExpress: null,
        MyRealTrip: null,
        Klook: null,
        Custom: null,
      };
    }
    const url = customLinkForCurrentProduct?.url || '';
    const detected = detectAffiliatePlatform(url);
    const result: Record<AffiliatePlatformKey, string | null> = {
      Coupang: null,
      Toss: null,
      BrandConnect: null,
      OliveYoung: null,
      Ablely: null,
      Zigzag: null,
      TodayHouse: null,
      Kurly: null,
      AliExpress: null,
      MyRealTrip: null,
      Klook: null,
      Custom: null,
    };
    result[detected] = url;
    // BrandConnect also matches generic naver shopping URLs
    if (detected !== 'BrandConnect' && /smartstore\.naver\.com|brand\.naver\.com/i.test(url)) {
      result.BrandConnect = url;
    }
    return result;
  }, [customLinkForCurrentProduct, hasCustomLink]);

  const primaryAffiliateUrl = platformAffiliateUrls[selectedAffiliate];

  useEffect(() => {
    if (!hasCustomLink) return;
    if (platformAffiliateUrls[selectedAffiliate]) return;
    const entry = (Object.entries(platformAffiliateUrls) as [AffiliatePlatformKey, string | null][]).find(([, v]) => v);
    if (entry) setSelectedAffiliate(entry[0]);
  }, [platformAffiliateUrls, selectedAffiliate, hasCustomLink]);

  const availablePlatforms = useMemo<AffiliatePlatformKey[]>(
    () => (Object.entries(platformAffiliateUrls) as [AffiliatePlatformKey, string | null][])
      .filter(([, v]) => !!v)
      .map(([k]) => k),
    [platformAffiliateUrls],
  );

  const affiliatePlatforms = useMemo(
    () => availablePlatforms.length > 0 ? availablePlatforms : [selectedAffiliate],
    [availablePlatforms, selectedAffiliate],
  );

  const disclosureText = getDisclosureForPlatforms(affiliatePlatforms);
  const captionWithLink = isLinkRestrictedPlatform
    ? (autoMarketingCopy ? `${fullCaption}\n\n${disclosureText}` : `${fullCaption}${shortUrl ? commentCta : ''}\n\n${disclosureText}`)
    : (shortUrl && !autoMarketingCopy
      ? `${fullCaption}\n\n${shortUrl}\n\n${disclosureText}`
      : `${fullCaption}\n\n${disclosureText}`);

  const shareText = captionWithLink;

  useEffect(() => {
    if (!scan) return;
    if (!primaryAffiliateUrl) {
      setShortUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await createShortLink(primaryAffiliateUrl, scan.id);
        if (!cancelled) setShortUrl(result);
      } catch {
        if (!cancelled) setShortUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [primaryAffiliateUrl, scan?.id]);

  useEffect(() => {
    if (!scan) return;
    let cancelled = false;
    setAddedHashtags([]);
    setHookOverride(null);
    (async () => {
      try {
        const productCat = selectedProduct?.productCategory || scan.product_category || '';
        const productTags = scan.tags || [];
        const name = activeProductName || scan.product_name || '';
        const result = await fetchMatchedTrendingHashtags(productCat, productTags, name);
        if (!cancelled) setTrendingHashtags(result?.hashtags ?? []);
      } catch {
        if (!cancelled) setTrendingHashtags([]);
      }
    })();
    return () => { cancelled = true; };
  }, [scan?.id, scan?.product_category, scan?.product_name, scan?.tags, selectedProductIndex, activeProductName, selectedProduct?.productCategory]);

  const trendingSuggestions = getTrendingSuggestions(trendingHashtags, [...activeHashtags, ...addedHashtags]);

  const handleAddTrendingHashtag = (tag: string) => {
    setAddedHashtags((prev) => [...prev, tag]);
  };

  const handleRemoveTrendingHashtag = (tag: string) => {
    setAddedHashtags((prev) => prev.filter((t) => t !== tag));
  };

  useEffect(() => {
    if (stickerUserOverride) return;
    const category = selectedProduct?.productCategory || scan?.product_category || '';
    const cardStyle = getCardStyleForPlatform(activePlatform, activeTemplateData);
    setStickerStyle(recommendStickerStyle(cardStyle, category));
    setStickerSize(recommendStickerSize(cardStyle));
  }, [activePlatform, selectedProduct, scan, activeTemplateData, stickerUserOverride]);

  const handleStickerStyleChange = useCallback((style: StickerStyle) => {
    setStickerUserOverride(true);
    setStickerStyle(style);
  }, []);

  const handleStickerSizeChange = useCallback((size: number) => {
    setStickerUserOverride(true);
    setStickerSize(size);
  }, []);

  if (loading) {
    return <LoadingScreen message="분석 결과를 불러오는 중..." />;
  }

  if (error || !scan) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>{error || '문제가 발생했습니다'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={20} color={theme.colors.dark.text} strokeWidth={2} />
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: safeTop + 12 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={theme.colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push({ pathname: '/editor', params: { id: scan.id } })}
            activeOpacity={0.7}
          >
            <Pencil size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleDelete} activeOpacity={0.7}>
            <Trash2 size={20} color={theme.colors.error[400]} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.xxl + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: scan.edited_image_url || scan.image_url }}
            style={[styles.heroImage, { aspectRatio: heroAspect }]}
            resizeMode="contain"
          />
          {editingProduct ? (
            <View style={styles.productEditOverlay}>
              <View style={styles.productEditCard}>
                <Text style={styles.productEditTitle}>제품 정보 수정</Text>
                <TextInput
                  style={styles.productEditInput}
                  value={productNameInput}
                  onChangeText={setProductNameInput}
                  placeholder="제품명"
                  placeholderTextColor={theme.colors.dark.textDim}
                />
                <TextInput
                  style={styles.productEditInput}
                  value={productCategoryInput}
                  onChangeText={setProductCategoryInput}
                  placeholder="카테고리 (예: sneakers, lamp, jacket)"
                  placeholderTextColor={theme.colors.dark.textDim}
                />
                <View style={styles.productEditActions}>
                  <TouchableOpacity
                    style={styles.productEditCancelBtn}
                    onPress={() => setEditingProduct(false)}
                    disabled={savingProduct}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                    <Text style={styles.productEditCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.productEditSaveBtn}
                    onPress={handleSaveProduct}
                    disabled={savingProduct}
                    activeOpacity={0.7}
                  >
                    {savingProduct ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" strokeWidth={2} />
                        <Text style={styles.productEditSaveText}>저장</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.heroBadge}
              onPress={handleStartEditProduct}
              activeOpacity={0.7}
            >
              <ShoppingBag size={14} color={theme.colors.primary[300]} strokeWidth={2} />
              <Text style={styles.heroBadgeText}>{activeProductName || '제품명 수정'}</Text>
              <Pencil size={12} color={theme.colors.primary[300]} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Sparkles size={20} color={theme.colors.primary[400]} strokeWidth={2} />
            <Text style={styles.title} numberOfLines={2}>{scan.title || '제품 분석 결과'}</Text>
          </View>

          {scan.summary ? (
            <Text style={styles.summary}>{scan.summary}</Text>
          ) : (
            <Text style={styles.summaryFaint}>요약 정보가 없습니다</Text>
          )}

          {activePriceEstimate ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>예상 가격</Text>
              <Text style={styles.priceValue}>{activePriceEstimate}</Text>
            </View>
          ) : null}

          {(scan.tags ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>태그</Text>
              <View style={styles.tagRow}>
                {(scan.tags ?? []).map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Tag size={11} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {(scan.contacts ?? []).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>연결 정보</Text>
              {(scan.contacts ?? []).map((contact, i) => (
                <View key={i} style={styles.contactCard}>
                  <View style={styles.contactIconWrap}>
                    <Info size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
                  </View>
                  <View style={styles.contactBody}>
                    <Text style={styles.contactLabel}>{contact.label}</Text>
                    <Text style={styles.contactValue} numberOfLines={2}>{contact.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {detectedProducts.length > 1 && (
            <View style={styles.section}>
              <ProductSelector
                products={detectedProducts}
                selectedIndex={selectedProductIndex}
                onSelect={setSelectedProductIndex}
              />
            </View>
          )}

          {activePlatform === 'instagram' && (
            <View style={styles.section}>
              <ReviewInput
                review={scan.custom_review?.text ? scan.custom_review : null}
                onSave={async (newReview: CustomReview) => {
                  setReviewSaving(true);
                  try {
                    const { error: reviewError } = await supabase
                      .from('scans')
                      .update({ custom_review: newReview })
                      .eq('id', scan.id);
                    if (reviewError) throw reviewError;
                    setScan({ ...scan, custom_review: newReview });
                  } catch (err) {
                    setError(friendlyError(err, '후기 저장에 실패했습니다. 다시 시도해주세요.'));
                  }
                  setReviewSaving(false);
                }}
                onClear={async () => {
                  setReviewSaving(true);
                  try {
                    const { error: reviewError } = await supabase
                      .from('scans')
                      .update({ custom_review: null })
                      .eq('id', scan.id);
                    if (reviewError) throw reviewError;
                    setScan({ ...scan, custom_review: null });
                  } catch (err) {
                    setError(friendlyError(err, '후기 삭제에 실패했습니다. 다시 시도해주세요.'));
                  }
                  setReviewSaving(false);
                }}
                productData={{
                  productName: activeProductName,
                  productCategory: selectedProduct?.productCategory || scan?.product_category || '',
                  priceEstimate: activePriceEstimate,
                  oneLiner: activeOneLiner,
                  hook: activeHook,
                  productAdvantages: td?.productAdvantages || [],
                }}
              />
            </View>
          )}

          {td?.caption ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Flame size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>마케팅 카피</Text>
              </View>
              <PlatformTabs selected={activePlatform} onSelect={setActivePlatform} />
              <View style={styles.captionCard}>
                {activeHook ? (
                  <View style={styles.hookRow}>
                    <Text style={styles.hookText} numberOfLines={3}>{activeHook}</Text>
                    <TouchableOpacity style={styles.hookCopyBtn} onPress={handleCopyHook} activeOpacity={0.7}>
                      {hookCopied ? (
                        <Check size={13} color={theme.colors.success[400]} strokeWidth={2} />
                      ) : (
                        <Copy size={13} color={theme.colors.warning[400]} strokeWidth={2} />
                      )}
                      <Text style={[styles.hookCopyText, hookCopied && { color: theme.colors.success[400] }]}>
                        {hookCopied ? '복사됨' : '후킹 복사'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <Text style={styles.captionText}>{activeCaption}</Text>
                {td.productAdvantages && td.productAdvantages.length > 0 ? (
                  <View style={styles.metaChips}>
                    {td.productAdvantages.map((adv, i) => (
                      <View key={i} style={styles.metaChip}>
                        <Sparkles size={11} color={theme.colors.accent[300]} strokeWidth={2} />
                        <Text style={styles.metaChipText}>{adv}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {activeHashtags.length > 0 ? (
                  <View style={styles.hashtagRow}>
                    <Hash size={12} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.hashtagText}>
                      {activeHashtags.map((h) => `#${h}`).join(' ')}
                    </Text>
                  </View>
                ) : null}
                {addedHashtags.length > 0 ? (
                  <View style={styles.addedHashtagRow}>
                    {addedHashtags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.addedHashtagChip}
                        onPress={() => handleRemoveTrendingHashtag(tag)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addedHashtagText}>#{tag}</Text>
                        <X size={10} color={theme.colors.accent[300]} strokeWidth={2.5} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {trendingSuggestions.length > 0 ? (
                  <View style={styles.trendingHashtagSection}>
                    <View style={styles.trendingHashtagHeader}>
                      <TrendingUp size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                      <Text style={styles.trendingHashtagLabel}>트렌딩 해시태그 추천</Text>
                    </View>
                    <View style={styles.trendingHashtagChips}>
                      {trendingSuggestions.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={styles.trendingHashtagChip}
                          onPress={() => handleAddTrendingHashtag(tag)}
                          activeOpacity={0.7}
                        >
                          <Plus size={9} color={theme.colors.accent[300]} strokeWidth={2.5} />
                          <Text style={styles.trendingHashtagChipText}>{tag}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
                <TouchableOpacity style={styles.copyCaptionBtn} onPress={handleCopyCaption} activeOpacity={0.7}>
                  {captionCopied ? (
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
                  ) : (
                    <Copy size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                  )}
                  <Text style={[styles.copyCaptionText, captionCopied && { color: theme.colors.success[400] }]}>
                    {captionCopied ? '복사됨' : '카피 복사'}
                  </Text>
                </TouchableOpacity>
                {isLinkRestrictedPlatform && shortUrl ? (
                  <View style={styles.commentLinkBox}>
                    <View style={styles.commentLinkHint}>
                      <MessageCircle size={12} color={theme.colors.warning[400]} strokeWidth={2} />
                      <Text style={styles.commentLinkHintText}>
                        본문에 링크 직접 삽입 시 노출 제한(섀도우밴) 위험이 있어요. 댓글창에 링크를 남겨주세요.
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyCommentLink} activeOpacity={0.7}>
                      {linkCopied ? (
                        <Check size={13} color={theme.colors.success[400]} strokeWidth={2} />
                      ) : (
                        <Copy size={13} color={theme.colors.primary[300]} strokeWidth={2} />
                      )}
                      <Text style={[styles.copyLinkBtnText, linkCopied && { color: theme.colors.success[400] }]}>
                        {linkCopied ? '댓글용 링크 복사됨' : '댓글용 링크 복사'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <LazySection>
          <View style={styles.section}>
            <TrendCopyBar
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              tags={scan?.tags || []}
              platform={activePlatform}
              onApplyTrend={(phrase) => setAutoMarketingCopy(phrase)}
            />
          </View>
          </LazySection>

          <LazySection delayMs={50}>
          <View style={styles.section}>
            <HashtagCopyBar
              hashtags={allDisplayHashtags}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              platform={activePlatform}
            />
          </View>
          </LazySection>

          <LazySection>
          <View style={styles.section}>
            <CopyWriter
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              platform={activePlatform}
            />
          </View>
          </LazySection>

          <LazySection delayMs={100}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ImageIcon size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.sectionLabel}>숏폼 템플릿 카드</Text>
            </View>
            <ShortFormGuideCard
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              onApplyHook={(hook) => setHookOverride(hook)}
              appliedHook={hookOverride}
            />
            {primaryAffiliateUrl ? (
              <>
                <StickerLinkControls
                  enabled={true}
                  onToggle={() => {}}
                  stickerStyle={stickerStyle}
                  onStyleChange={handleStickerStyleChange}
                  size={stickerSize}
                  onSizeChange={handleStickerSizeChange}
                  aiRecommended={!stickerUserOverride}
                />
                <View style={styles.qrPositionRow}>
                  <Text style={styles.qrPositionLabel}>스티커 위치</Text>
                  <View style={styles.qrPositionGroup}>
                    {STICKER_POSITIONS.map((pos) => (
                      <TouchableOpacity
                        key={pos.value}
                        style={[
                          styles.qrPositionPill,
                          stickerPosition === pos.value && styles.qrPositionPillActive,
                        ]}
                        onPress={() => setStickerPosition(pos.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.qrPositionPillText,
                            stickerPosition === pos.value && styles.qrPositionPillTextActive,
                          ]}
                        >
                          {pos.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noLinkNotice}>
                <Link2 size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.noLinkNoticeText}>
                  구매 링크를 입력하면 스티커 링크가 자동으로 만들어져요. 아래 '쇼핑커넥트 & 제휴 링크'를 펼쳐서 플랫폼을 선택하고 내 수수료 링크를 붙여넣으세요.
                </Text>
              </View>
            )}
            <View style={styles.overlayControlWrap}>
              <View style={styles.overlayControlHeader}>
                <Sun size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.overlayControlTitle}>배경 투명도</Text>
                <TouchableOpacity onPress={() => setOverlayOpacity(null)} activeOpacity={0.7}>
                  <Text style={styles.overlayResetText}>기본값</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.opacitySliderRow}>
                <Text style={styles.opacityMinLabel}>얇게</Text>
                <TouchableOpacity
                  style={styles.opacityTrack}
                  onPress={(e) => {
                    const { locationX } = e.nativeEvent;
                    const trackWidth = 200;
                    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
                    setOverlayOpacity(Math.round(ratio * 100) / 100);
                  }}
                  activeOpacity={1}
                >
                  <View
                    style={[
                      styles.opacityFill,
                      { width: `${Math.round((overlayOpacity != null ? overlayOpacity : 0.62) * 100)}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.opacityThumb,
                      { left: `${Math.round((overlayOpacity != null ? overlayOpacity : 0.62) * 100)}%` },
                    ]}
                  />
                </TouchableOpacity>
                <Text style={styles.opacityMaxLabel}>진하게</Text>
              </View>
            </View>
            <View style={styles.textPositionRow}>
              <Text style={styles.qrPositionLabel}>문구 위치</Text>
              <View style={styles.qrPositionGroup}>
                {TEXT_POSITIONS.map((pos: { label: string; value: TextPosition }) => (
                  <TouchableOpacity
                    key={pos.value}
                    style={[
                      styles.qrPositionPill,
                      textPosition === pos.value && styles.qrPositionPillActive,
                    ]}
                    onPress={() => setTextPosition(pos.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.qrPositionPillText,
                        textPosition === pos.value && styles.qrPositionPillTextActive,
                      ]}
                    >
                      {pos.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.templateWrap}>
              <TemplateCard
                ref={cardRef}
                imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
                templateData={activeTemplateData}
                title={activeProductName || scan.title || 'Product'}
                affiliatePlatforms={affiliatePlatforms}
                platform={activePlatform}
                customReview={scan.custom_review?.text ? scan.custom_review : null}
                shortUrl={shortUrl || ''}
                stickerPosition={stickerPosition}
                stickerStyle={stickerStyle}
                stickerSize={stickerSize}
                overlayOpacity={overlayOpacity ?? undefined}
                textPosition={textPosition}
              />
            </View>
          </View>
          </LazySection>

          <LazySection delayMs={120}>
          <View style={styles.section}>
            <TrendMatchCard
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              productName={activeProductName || scan?.product_name || ''}
              platform={activePlatform}
              onApplyHashtags={(tags) => setAddedHashtags((prev) => [...prev, ...tags.filter((t) => !prev.includes(t))])}
            />
          </View>
          </LazySection>

          <LazySection delayMs={150}>
          <View style={styles.section}>
            <ShoppingMatchCard
              matches={activeShoppingMatches}
              affiliateLinks={activeShoppingMatches.length > 0 ? [] : currentAffiliateLinks}
              customAffiliateLinks={customAffiliateLinks}
              selectedProductIndex={selectedProductIndex}
              saving={savingLink}
              productName={activeProductName}
              priceLabel={activePriceEstimate}
              onMarketingCopyGenerated={(copy) => setAutoMarketingCopy(copy)}
              onSaveCustomLink={handleSaveCustomLink}
              onRemoveCustomLink={handleRemoveCustomLink}
              selectedAffiliate={selectedAffiliate}
              onSelectAffiliate={setSelectedAffiliate}
              availablePlatforms={availablePlatforms}
              shortUrl={shortUrl}
              scanId={scan.id}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <ClipGenerator
              imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              hashtags={allDisplayHashtags}
              accentColor={td?.accentColor || theme.colors.primary[400]}
              category={td?.category || ''}
              fileName={`snap-connect-${scan.id}.png`}
              affiliatePlatforms={affiliatePlatforms}
              platform={activePlatform}
              templateData={td ?? null}
              customReview={scan.custom_review?.text ? scan.custom_review : null}
              shortUrl={shortUrl || ''}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <ShortFormTipsCard
              hook={activeHook}
              oneLiner={activeOneLiner || scan?.one_liner || ''}
              productAdvantages={td?.productAdvantages || []}
              caption={activeCaption}
              productName={activeProductName || scan?.product_name || ''}
              platform={activePlatform}
              onApplyPlatform={setActivePlatform}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <LocalStoreCard
              value={localStoreInfo}
              onChange={(info) => {
                setLocalStoreInfo(info);
                if (scan) {
                  supabase
                    .from('scans')
                    .update({ local_store_info: info })
                    .eq('id', scan.id)
                    .then(() => {});
                }
              }}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <ComicShortGenerator
              imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              hashtags={allDisplayHashtags}
              accentColor={td?.accentColor || theme.colors.accent[400]}
              fileName={`snap-connect-comic-${scan.id}.png`}
              affiliatePlatforms={affiliatePlatforms}
              platform={activePlatform}
              shortUrl={shortUrl || ''}
              stickerPosition={stickerPosition}
              stickerStyle={stickerStyle}
              stickerSize={stickerSize}
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              priceEstimate={activePriceEstimate || ''}
              oneLiner={activeOneLiner || ''}
              productAdvantages={td?.productAdvantages || []}
              localStoreInfo={localStoreInfo}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <ViralPredictor
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              hashtags={allDisplayHashtags}
              comicStyle="lineart"
              panelCount={1}
              hasTTS={false}
              episodeMode={false}
              trendingKeywords={trendingHashtags}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <PersonaSimulator
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              hook={activeHook}
            />
          </View>
          </LazySection>

          <LazySection delayMs={200}>
          <View style={styles.section}>
            <MultiPlatformExport
              imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              hashtags={allDisplayHashtags}
              accentColor={td?.accentColor || theme.colors.primary[400]}
              category={td?.category || ''}
              fileName={`snap-connect-${scan.id}.png`}
              affiliatePlatforms={affiliatePlatforms}
              platform={activePlatform}
              shortUrl={shortUrl || ''}
            />
          </View>

          <View style={styles.section}>
            <GlobalLocalizer
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              caption={baseCaption}
              hashtags={allDisplayHashtags}
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              narrationText={activeHook || activeOneLiner}
              affiliateUrl={shortUrl || primaryAffiliateUrl || undefined}
            />
          </View>

          <View style={styles.section}>
            <ShareBar
              cardRef={cardRef}
              shareText={shareText}
              affiliateUrl={primaryAffiliateUrl}
              shortUrl={shortUrl}
              fileName={`snap-connect-${scan.id}.png`}
              affiliatePlatforms={affiliatePlatforms}
            />
          </View>
          </LazySection>

          <LazySection delayMs={250}>
          {detectedProducts.length > 1 && (
            <View style={styles.section}>
              <CarouselGenerator
                imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
                detectedProducts={detectedProducts}
                platform={activePlatform}
                customReview={scan.custom_review?.text ? scan.custom_review : null}
                affiliatePlatforms={affiliatePlatforms}
                fileName={`snap-connect-${scan.id}.png`}
                shortUrl={shortUrl || ''}
                stickerPosition={stickerPosition}
              />
            </View>
          )}
          </LazySection>

          <Text style={styles.dateText}>
            {new Date(scan.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    gap: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: theme.spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  heroWrap: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
  },
  heroBadge: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  heroBadgeText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  productEditOverlay: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
  },
  productEditCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  productEditTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  productEditInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  productEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  productEditCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  productEditCancelText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  productEditSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[400],
  },
  productEditSaveText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  body: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.title,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  summary: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 26,
  },
  summaryFaint: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  priceLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  priceValue: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  section: {
    marginTop: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[500] + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  tagText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactBody: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  contactLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contactValue: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    marginTop: 2,
  },
  templateWrap: {
    alignItems: 'center',
  },
  captionCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  hookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  hookText: {
    flex: 1,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    lineHeight: 26,
  },
  hookCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    marginTop: 2,
  },
  hookCopyText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
  },
  captionText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 24,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  metaChipText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  hashtagText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
    lineHeight: 20,
  },
  addedHashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  addedHashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accent[500] + '25',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  addedHashtagText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  trendingHashtagSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
  },
  trendingHashtagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  trendingHashtagLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  trendingHashtagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trendingHashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent[500] + '30',
  },
  trendingHashtagChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  copyCaptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  copyCaptionText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  commentLinkBox: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  commentLinkHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.warning[500] + '10',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.warning[400],
  },
  commentLinkHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  copyLinkBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  dateText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: theme.spacing.xl,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  backButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  qrPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  qrPositionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  qrPositionGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  qrPositionPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  qrPositionPillActive: {
    backgroundColor: theme.colors.primary[600],
  },
  qrPositionPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  qrPositionPillTextActive: {
    color: '#fff',
  },
  noLinkNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning[400],
  },
  noLinkNoticeText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  overlayControlWrap: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent[400],
  },
  overlayControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  overlayControlTitle: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  overlayResetText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  opacitySliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opacityMinLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  opacityMaxLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  opacityTrack: {
    flex: 1,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.dark.surfaceLight,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  opacityFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent[500] + '60',
    borderRadius: 14,
  },
  opacityThumb: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.accent[400],
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  textPositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
});
