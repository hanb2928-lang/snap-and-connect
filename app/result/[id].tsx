import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  AppState,
} from 'react-native';
import {
  ArrowLeft,
  Tag,
  Info,
  Share2,
  Download,
  Trash2,
  Sparkles,
  ShoppingBag,
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
  CircleAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { deleteScan } from '@/lib/analysis';
import { getUserSettings } from '@/lib/settings';
import { generateAffiliateLinks } from '@/lib/affiliate';
import { detectAffiliatePlatform } from '@/lib/affiliateLinkSmart';
import { getDisclosureForPlatforms } from '@/lib/disclosure';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { uploadAssetBlobWithProgress, uploadAssetFromFileUriWithProgress, saveAssetRecord } from '@/lib/savedAssets';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { readUriAsBase64 } from '@/lib/imageEdit';
import { cleanBase64 } from '@/lib/base64';
import { Share as RNShare } from 'react-native';
import type { Scan, UserSettings, AffiliateLink, CustomAffiliateLink, DetectedProduct, PlatformKey, CustomReview } from '@/types/database';
import { TemplateCard, STICKER_POSITIONS, TEXT_POSITIONS } from '@/components/TemplateCard';
import type { StickerPosition, TextPosition } from '@/components/TemplateCard';
import { StickerLinkControls } from '@/components/StickerLink';
import type { StickerStyle } from '@/components/StickerLink';
import { ShareBar } from '@/components/ShareBar';
import { SocialShortFormShare } from '@/components/SocialShortFormShare';
import { ShoppingMatchCard } from '@/components/ShoppingMatchCard';
import { ProductSelector } from '@/components/ProductSelector';
import { PlatformTabs, BoardTabs, getPlatformMediaType, platformSupportsBoth } from '@/components/PlatformTabs';
import type { MediaType as BoardMediaType } from '@/components/PlatformTabs';
import { MultiPlatformExport } from '@/components/MultiPlatformExport';
import type { AffiliatePlatformKey } from '@/components/AffiliatePlatformSwitch';
import type { LocalStoreInfo } from '@/types/database';
import { ReviewInput } from '@/components/ReviewInput';
import { CopyWriter } from '@/components/CopyWriter';
import { VariantGenerator, type Variant } from '@/components/VariantGenerator';
import { SmartScheduler } from '@/components/SmartScheduler';
import { OcrTextExtractor } from '@/components/OcrTextExtractor';
import { BellRing, ScanText as ScanTextIcon } from 'lucide-react-native';
import { LocalStoreCard } from '@/components/LocalStoreCard';
import { ShortFormTipsCard } from '@/components/ShortFormTipsCard';
import { ViralPredictor } from '@/components/ViralPredictor';
import { PersonaSimulator } from '@/components/PersonaSimulator';
import { GlobalLocalizer } from '@/components/GlobalLocalizer';
import { LocalizationSafetyCard } from '@/components/LocalizationSafetyCard';
import { HyperHumanEngineCard } from '@/components/HyperHumanEngineCard';
import { TrendCopyBar } from '@/components/TrendCopyBar';
import { HashtagCopyBar } from '@/components/HashtagCopyBar';
import { createShortLink } from '@/lib/shortUrl';
import { recommendStickerStyle, recommendStickerSize, getCardStyleForPlatform } from '@/lib/stickerRecommend';
import { urlToDataUrl } from '@/lib/base64';
import { getImageSize, prepareImageForApi } from '@/lib/imageEdit';
import { fetchMatchedTrendingHashtags, getTrendingSuggestions } from '@/lib/trendingHashtags';
import { LoadingScreen } from '@/components/LoadingScreen';
import { friendlyError } from '@/lib/errors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeTop } from '@/hooks/useSafeTop';
import { LazySection } from '@/components/LazySection';
import { ShortFormGuideCard } from '@/components/ShortFormGuideCard';
import { TrendMatchCard } from '@/components/TrendMatchCard';
import { AffiliatePromptBanner } from '@/components/AffiliatePromptBanner';
import { AIStyleCard } from '@/components/AIStyleCard';
import type { StyleRecommendation } from '@/lib/styleRecommend';
import { getItem } from '@/lib/storage';
import { FeatureTileGrid } from '@/components/FeatureTileGrid';
import type { FeatureCategory, ScanMode, MediaType } from '@/components/FeatureTileGrid';
import { subscribeToJob } from '@/lib/jobQueue';
import { finalizeAnalysisFromJob } from '@/lib/asyncAnalysis';
import type { RenderJob } from '@/lib/jobQueue';
import { TrendingUp as TrendingUpIcon, Hash as HashIcon, PenLine, LayoutTemplate, ShoppingBag as ShoppingBagIcon, Wand as Wand2, Film as FilmIcon, Lightbulb, Store, BookOpen, Rocket, Users, Globe, Share2 as Share2Icon, Palette as PaletteIcon, Clock, Camera as CameraIcon, Sun as SunIcon, Film as FilmZoomIcon, ShieldCheck as ShieldIcon, Link2 as Link2Icon, User as UserIcon, SlidersHorizontal as SlidersIcon, Pencil as PencilIcon, Sparkles as SparklesIcon, Zap as ZapIcon, Scissors as ScissorsIcon, Upload as UploadIcon } from 'lucide-react-native';
import { LightingContextStudio } from '@/components/LightingContextStudio';
import { QuickTweakPanel } from '@/components/QuickTweakPanel';
import { AccountSafetyChecker } from '@/components/AccountSafetyChecker';
import { LinkInBioCard } from '@/components/LinkInBioCard';
import { CreatorPersonaCard } from '@/components/CreatorPersonaCard';
import { SnapMixTuner } from '@/components/SnapMixTuner';
import { MicroEditSlot } from '@/components/MicroEditSlot';
import { OriginalityScoreCard } from '@/components/OriginalityScoreCard';
import { ShortLinkCopyBar } from '@/components/ShortLinkCopyBar';
import { AIProcessAccordion, type InlineEditState, type HookEffectType } from '@/components/AIProcessAccordion';

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
  const [activeBoard, setActiveBoard] = useState<BoardMediaType>('video');
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
  const [priceOverride, setPriceOverride] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [editingProduct, setEditingProduct] = useState(false);
  const [productNameInput, setProductNameInput] = useState('');
  const [productCategoryInput, setProductCategoryInput] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [localStoreInfo, setLocalStoreInfo] = useState<LocalStoreInfo | null>(null);
  const [recommendedStyle, setRecommendedStyle] = useState<StyleRecommendation | null>(null);
  const [styleAppliedKey, setStyleAppliedKey] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [focusTileKey, setFocusTileKey] = useState<string | null>(null);
  const [safetyCheckerVisible, setSafetyCheckerVisible] = useState(false);
  const [cleanMode, setCleanMode] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState>({
    volumeIntensity: 0.75,
    hookEffect: 'rotation_zoom' as HookEffectType,
    beatSyncSensitivity: 0.6,
    sfxStyle: '하이텐션',
    captionText: '',
    hashtags: [],
    videoTemplate: '트렌디 쇼핑',
    captionFont: '고딕 굵게',
    captionPosition: '하단 고정',
    bgmMood: '하이텐션',
    aiPrompt: '',
    titleText: '',
  });
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleInlineEdit = useCallback((patch: Partial<InlineEditState>) => {
    setInlineEdit((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleInlineRemoveHashtag = useCallback((tag: string) => {
    setAddedHashtags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (!scan || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const promptParts = [
        `템플릿: ${inlineEdit.videoTemplate}`,
        `자막: ${inlineEdit.captionFont} / ${inlineEdit.captionPosition}`,
        `BGM: ${inlineEdit.bgmMood}`,
        `훅: ${inlineEdit.hookEffect}`,
        inlineEdit.aiPrompt ? `추가: ${inlineEdit.aiPrompt}` : '',
      ].filter(Boolean);
      const { data, error } = await supabase.functions.invoke('generate-copy', {
        body: {
          scanId: scan.id,
          platform: activePlatform,
          productName: scan.product_name || '',
          extraPrompt: promptParts.join(' | '),
        },
      });
      if (error) throw error;
      if (mountedRef.current && data) {
        const result = data as { caption?: string; hook?: string; title?: string };
        if (result.caption) {
          setAutoMarketingCopy(result.caption);
          setInlineEdit((prev) => ({ ...prev, captionText: result.caption! }));
        }
        if (result.hook) setHookOverride(result.hook);
        if (result.title) setInlineEdit((prev) => ({ ...prev, titleText: result.title! }));
      }
    } catch {
      // regeneration failed — keep current content
    } finally {
      if (mountedRef.current) setIsRegenerating(false);
    }
  }, [scan, isRegenerating, inlineEdit.videoTemplate, inlineEdit.captionFont, inlineEdit.captionPosition, inlineEdit.bgmMood, inlineEdit.hookEffect, inlineEdit.aiPrompt, activePlatform]);

  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const safeTop = useSafeTop();
  const cardRef = useRef<View>(null);
  const mountedRef = useRef(true);
  const styleApplyCounter = useRef(0);
  const handleJobUpdateRef = useRef<((job: RenderJob) => void) | null>(null);

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

      if (!mountedRef.current) return;
      if (scanResult.error) {
        setError(friendlyError(scanResult.error, '데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.'));
      } else if (!scanResult.data) {
        if (mountedRef.current) setError('스캔을 찾을 수 없습니다');
      } else {
        if (!mountedRef.current) return;
        setScan(scanResult.data as Scan);
        setCustomAffiliateLinks((scanResult.data as Scan).custom_affiliate_links ?? []);
        setLocalStoreInfo((scanResult.data as Scan).local_store_info ?? null);
      }
      if (mountedRef.current) setSettings(settingsResult);
      setCleanMode(!!settingsResult?.clean_footage_enabled);
    } catch (err) {
      if (mountedRef.current) setError(friendlyError(err, '데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  useEffect(() => {
    if (!scan || scan.tts_url || ttsUrl) return;
    const interval = setInterval(() => {
      Promise.resolve(
        supabase
          .from('scans')
          .select('tts_url')
          .eq('id', scan.id)
          .maybeSingle()
      ).then(({ data }: { data: { tts_url: string } | null }) => {
        if (data?.tts_url && mountedRef.current) {
          setTtsUrl(data.tts_url);
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [scan, ttsUrl]);


  // Re-check TTS URL when app returns to foreground
  useEffect(() => {
    if (!scan || scan.tts_url || ttsUrl) return;
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active' && mountedRef.current) {
        Promise.resolve(
          supabase
            .from('scans')
            .select('tts_url')
            .eq('id', scan.id)
            .maybeSingle()
        ).then(({ data }) => {
          if (data?.tts_url && mountedRef.current) {
            setTtsUrl(data.tts_url);
          }
        }).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [scan, ttsUrl]);

  // Realtime subscription for async analysis job completion
  useEffect(() => {
    if (!scan?.analysis_job_id) {
      setAnalysisStatus('idle');
      return;
    }

    setAnalysisStatus('processing');
    setAnalysisError(null);
    let finalizing = false;

    const handleJobUpdate = (job: RenderJob) => {
      if (!mountedRef.current) return;
      if (job.status === 'done' && !finalizing) {
        finalizing = true;
        setAnalysisStatus('done');
        // Finalize: write analysis data to scan row, cache result, trigger TTS
        (async () => {
          try {
            if (!job.result) {
              throw new Error('분석 결과가 비어 있습니다. 다시 시도해주세요.');
            }
            await finalizeAnalysisFromJob(scan.id, job.id, job.result);
            // Refresh the scan to get the updated data
            const { data: refreshed } = await supabase
              .from('scans')
              .select('*')
              .eq('id', scan.id)
              .maybeSingle();
            if (mountedRef.current && refreshed) {
              setScan(refreshed as Scan);
            }
          } catch (err) {
            if (mountedRef.current) {
              setAnalysisError(err instanceof Error ? err.message : '분석 결과 저장에 실패했습니다.');
            }
          }
        })();
      } else if (job.status === 'error') {
        setAnalysisStatus('error');
        setAnalysisError(job.error_message || 'AI 분석 중 오류가 발생했습니다.');
      }
    };

    const sub = subscribeToJob(scan.analysis_job_id, handleJobUpdate);
    handleJobUpdateRef.current = handleJobUpdate;

    // Also poll the job as a fallback (realtime can miss events)
    const pollInterval = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { data: jobRow } = await supabase
          .from('render_jobs')
          .select('*')
          .eq('id', scan.analysis_job_id)
          .maybeSingle();
        if (jobRow && (jobRow.status === 'done' || jobRow.status === 'error')) {
          clearInterval(pollInterval);
          handleJobUpdate(jobRow as RenderJob);
        }
      } catch {
        // network error — keep polling
      }
    }, 3000);

    return () => {
      sub.unsubscribe();
      clearInterval(pollInterval);
      handleJobUpdateRef.current = null;
    };
  }, [scan?.analysis_job_id, retryCount]);
  // (OS suspends timers when screen is off / app is backgrounded)
  useEffect(() => {
    if (!scan?.analysis_job_id) return;
    if (analysisStatus !== 'processing') return;

    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (nextAppState === 'active' && mountedRef.current) {
        Promise.resolve(
          supabase
            .from('render_jobs')
            .select('*')
            .eq('id', scan.analysis_job_id!)
            .maybeSingle()
        ).then(({ data }) => {
          if (data && mountedRef.current && (data.status === 'done' || data.status === 'error')) {
            handleJobUpdateRef.current?.(data as RenderJob);
          }
        }).catch(() => {});
      }
    });

    return () => subscription.remove();
  }, [scan?.analysis_job_id, analysisStatus]);

  useEffect(() => {
    (async () => {
      const saved = await getItem('preferred_template_style');
      if (saved) {
        setActivePlatform(saved as PlatformKey);
        setActiveBoard(getPlatformMediaType(saved as PlatformKey));
      }
    })();
  }, []);

  const handlePlatformChange = useCallback((key: PlatformKey) => {
    setActivePlatform(key);
    setActiveBoard(getPlatformMediaType(key));
  }, []);

  useEffect(() => {
    if (!scan) return;
    const url = scan.edited_image_url || scan.image_url;
    let cancelled = false;
    (async () => {
      try {
        const dataUrl = await urlToDataUrl(url);
        const compressed = await prepareImageForApi(dataUrl, 1024, 0.8);
        if (!cancelled) {
          setCaptureImageUrl(compressed);
        }
      } catch {
        if (!cancelled) {
          try {
            const fallbackDataUrl = await urlToDataUrl(url);
            if (!cancelled) {
              setCaptureImageUrl(fallbackDataUrl);
            }
          } catch {
            if (!cancelled) {
              setCaptureImageUrl(url);
            }
          }
        }
      }
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
  }, [scan?.edited_image_url, scan?.image_url]);


  const partnerIdsConfigured = useMemo(() => {
    return !!(settings?.coupang_partners_id || settings?.toss_share_id || settings?.naver_shopping_id);
  }, [settings]);

  const handleConnectLink = useCallback(() => {
    setFocusTileKey('shoppingMatch');
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 2200, animated: true });
    }, 350);
  }, []);

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
      if (mountedRef.current) setError(friendlyError(err, '제품 정보 저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveCustomLink = async (url: string, label: string, productIndex: number): Promise<{ success: boolean; error?: string }> => {
    if (!scan) return { success: false, error: '스캔 정보를 찾을 수 없어요' };
    if (!url || !url.trim()) return { success: false, error: '링크 URL을 입력해주세요' };
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

  const detectedProducts: DetectedProduct[] = useMemo(() => scan?.detected_products ?? [], [scan?.detected_products]);
  const selectedProduct = useMemo(() => detectedProducts[selectedProductIndex] ?? null, [detectedProducts, selectedProductIndex]);
  const activeProductName = useMemo(() => selectedProduct?.productName || scan?.product_name || '', [selectedProduct, scan?.product_name]);
  const activePriceEstimate = useMemo(() => priceOverride !== null ? priceOverride : (selectedProduct?.priceEstimate || scan?.price_estimate || ''), [priceOverride, selectedProduct, scan?.price_estimate]);
  const activeShoppingMatches = useMemo(() => selectedProduct?.shoppingMatches ?? scan?.shopping_matches ?? [], [selectedProduct, scan?.shopping_matches]);
  const activeTemplateData = useMemo(() => selectedProduct?.templateData ?? scan?.template_data, [selectedProduct, scan?.template_data]);
  const activeOneLiner = useMemo(() => selectedProduct?.oneLiner || scan?.one_liner || '', [selectedProduct, scan?.one_liner]);

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
  const activeCaption = inlineEdit.captionText || (autoMarketingCopy || platformVariant?.caption || td?.caption || '');
  const activeHashtags = platformVariant?.hashtags || td?.hashtags || [];
  const allDisplayHashtags = [...activeHashtags, ...addedHashtags];

  useEffect(() => {
    if (!scan) return;
    const baseCaption = platformVariant?.caption || td?.caption || scan?.one_liner || scan?.summary || '';
    if (!inlineEdit.captionText && baseCaption) {
      setInlineEdit((prev) => ({ ...prev, captionText: baseCaption }));
    }
    if (!inlineEdit.titleText) {
      const baseTitle = scan.title || activeProductName || td?.hook || '';
      if (baseTitle) setInlineEdit((prev) => ({ ...prev, titleText: baseTitle }));
    }
  }, [scan?.id, scan?.one_liner, scan?.summary, scan?.title, platformVariant?.caption, td?.caption, td?.hook, activeProductName]);

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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadDone, setUploadDone] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

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

  const handleSaveAndShare = async () => {
    if (uploadProgress !== null) return;
    setUploadError(null);
    setUploadDone(false);
    setUploadProgress(0);

    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        fileName: `snap-connect-${scan?.id ?? 'card'}.png`,
      });

      const fileName = `snap-connect-${scan?.id ?? 'card'}-${Date.now()}.png`;

      // 1) Save to device gallery (primary action)
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.granted) {
          try {
            await MediaLibrary.createAssetAsync(uri);
          } catch {
            // Fallback: write base64 to temp file then save
            const { base64 } = await readUriAsBase64(uri);
            const dir = FileSystem.cacheDirectory;
            if (dir) {
              const fileUri = `${dir}${fileName}`;
              await FileSystem.writeAsStringAsync(fileUri, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              await MediaLibrary.createAssetAsync(fileUri);
            }
          }
        }
      }

      setUploadProgress(100);
      setUploadDone(true);
      setTimeout(() => {
        setUploadProgress(null);
        setUploadDone(false);
      }, 2500);

      // 2) Cloud upload + asset record (secondary, non-blocking)
      (async () => {
        try {
          let cloudUrl: string | null = null;
          if (Platform.OS === 'web') {
            const res = await fetch(uri);
            const blob = await res.blob();
            cloudUrl = await uploadAssetBlobWithProgress(blob, fileName, 'image/png', (pct) => {
              setUploadProgress(pct);
            });
          } else {
            cloudUrl = await uploadAssetFromFileUriWithProgress(uri, fileName, 'image/png', (pct) => {
              setUploadProgress(pct);
            });
          }
          if (cloudUrl) {
            await saveAssetRecord({
              scan_id: scan?.id ?? null,
              asset_type: 'image',
              title: activeProductName || scan?.title || '숏폼 카드',
              file_url: cloudUrl,
              file_name: fileName,
              mime_type: 'image/png',
              platform: activePlatform,
            });
          }
        } catch {
          // Cloud save is secondary; gallery export already succeeded
        }
      })();

      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
        }
        setCaptionCopied(true);
        setTimeout(() => setCaptionCopied(false), 2000);
      } else {
        try {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: '공유하기',
          });
        } catch {
          await RNShare.share({ message: shareText });
        }
      }
    } catch {
      setUploadProgress(null);
      setUploadError('저장 중 오류가 발생했습니다.');
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
        Zigzag: null,
        TodayHouse: null,
        Kurly: null,
        AliExpress: null,
        Amazon: null,
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
      Zigzag: null,
      TodayHouse: null,
      Kurly: null,
      AliExpress: null,
      Amazon: null,
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

  const featureCategories: FeatureCategory[] = [
    {
      key: 'template',
      label: '핵심 템플릿',
      tiles: [
        {
          key: 'templateCard',
          label: '템플릿 카드',
          description: '피팅 컷, 상세 컷 등 핵심 레이아웃으로 제품 카드 제작',
          category: 'template',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <LayoutTemplate size={16} color={theme.colors.accent[300]} strokeWidth={2} />,
          mediaType: 'image',
          render: () => (
            <View>
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
                    구매 링크를 입력하면 스티커 링크가 자동으로 만들어져요. 아래 &lsquo;쇼핑커넥트 &amp; 제휴 링크&rsquo;를 펼쳐서 플랫폼을 선택하고 내 수수료 링크를 붙여넣으세요.
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
                      const measuredWidth = (e.currentTarget as any).clientWidth || (e.nativeEvent as any).layout?.width || 200;
                      const ratio = Math.max(0, Math.min(1, locationX / measuredWidth));
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

                {/* Clean footage toggle */}
                <View style={styles.cleanModeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cleanModeTitle}>클린 영상 (자막/훅 없음)</Text>
                    <Text style={styles.cleanModeDesc}>텍스트 오버레이 없이 순수 원본 비주얼만 추출</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCleanMode((v) => !v)}
                    activeOpacity={0.7}
                    hitSlop={12}
                  >
                    <View style={[styles.cleanModeSwitch, cleanMode && styles.cleanModeSwitchActive]}>
                      <View style={[styles.cleanModeKnob, cleanMode && styles.cleanModeKnobActive]} />
                    </View>
                  </TouchableOpacity>
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
                  cleanMode={cleanMode}
                />
              </View>
            </View>
          ),
        },
        {
          key: 'aiStyle',
          label: 'AI 스타일',
          description: '제품 이미지에 어울리는 AI 배경 및 분위기 스타일 변환',
          category: 'template',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <PaletteIcon size={16} color={theme.colors.accent[300]} strokeWidth={2} />,
          mediaType: 'image',
          render: () => (
            <AIStyleCard
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              accentColor={td?.accentColor || theme.colors.primary[400]}
              hook={activeHook}
              oneLiner={activeOneLiner || scan?.one_liner || ''}
              platform={activePlatform}
              onApply={(rec) => {
                setRecommendedStyle(rec);
                styleApplyCounter.current += 1;
                setStyleAppliedKey(`style-${styleApplyCounter.current}`);
              }}
            />
          ),
        },
        {
          key: 'lightingStudio',
          label: '조명 & 배경 스튜디오',
          description: '제품 원본은 그대로, 배경과 조명만 AI로 다채롭게 변경',
          category: 'template',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <SunIcon size={16} color={theme.colors.accent[300]} strokeWidth={2} />,
          mediaType: 'image',
          render: () => (
            <LightingContextStudio
              imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
              productName={activeProductName || scan.product_name || ''}
              onUseImage={(dataUrl) => { setCaptureImageUrl(dataUrl); }}
            />
          ),
        },
      ],
    },
    {
      key: 'commerce',
      label: '커머스 & 공유',
      tiles: [
        {
          key: 'ocrText',
          label: 'OCR 텍스트 추출',
          description: '사진 속 브랜드/모델명을 AI로 인식하여 제휴 검색어 자동 제안',
          category: 'commerce',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <ScanTextIcon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <OcrTextExtractor
              imageUrl={captureImageUrl || scan.edited_image_url || scan.image_url}
            />
          ),
        },
        {
          key: 'shoppingMatch',
          label: '쇼핑커넥트',
          description: '오픈마켓·자사몰 상품 링크와 단축 URL 연동',
          category: 'commerce',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <ShoppingBagIcon size={16} color={theme.colors.warning[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
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
          ),
        },
        {
          key: 'localStore',
          label: '로컬 스토어',
          description: '지역 기반 상점 및 오프라인 마케팅 연계 정보 설정',
          category: 'commerce',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <Store size={16} color={theme.colors.warning[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <LocalStoreCard
              value={localStoreInfo}
              onChange={(info) => {
                setLocalStoreInfo(info);
                if (scan) {
                  supabase
                    .from('scans')
                    .update({ local_store_info: info })
                    .eq('id', scan.id)
                    .then(() => {}, () => {});
                }
              }}
            />
          ),
        },
        {
          key: 'multiExport',
          label: '멀티 내보내기',
          description: '여러 플랫폼 규격에 맞춰 한 번에 결과물 추출',
          category: 'export',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <Share2Icon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'image',
          render: () => (
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
          ),
        },
        {
          key: 'shareBar',
          label: '공유하기 / 링크 복사',
          description: '즉시 클립보드 복사 및 SNS 공유',
          category: 'export',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <Share2Icon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <ShareBar
              cardRef={cardRef}
              shareText={shareText}
              affiliateUrl={primaryAffiliateUrl}
              shortUrl={shortUrl}
              fileName={`snap-connect-${scan.id}.png`}
              affiliatePlatforms={affiliatePlatforms}
            />
          ),
        },
      ],
    },
    {
      key: 'copyText',
      label: '문구 / 카피',
      tiles: [
        {
          key: 'copyWriter',
          label: '카피라이터',
          description: '브랜드 페르소나가 반영된 감성형·정보형·파격할인형 카피 생성',
          category: 'content',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <PenLine size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <CopyWriter
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              platform={activePlatform}
              brandPersona={settings?.brand_persona}
            />
          ),
        },
        {
          key: 'trendCopy',
          label: '트렌드 카피',
          description: '실시간 인기 키워드 기반 마케팅 문구 추천',
          category: 'content',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <TrendingUpIcon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <TrendCopyBar
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              tags={scan?.tags || []}
              platform={activePlatform}
              onApplyTrend={(phrase) => setAutoMarketingCopy(phrase)}
            />
          ),
        },
        {
          key: 'hashtag',
          label: '해시태그',
          description: '최적의 해시태그 조합 추천 및 복사',
          category: 'content',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <HashIcon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <HashtagCopyBar
              hashtags={allDisplayHashtags}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              platform={activePlatform}
            />
          ),
        },
        {
          key: 'shortFormGuide',
          label: '숏폼 가이드',
          description: '영상 제작 시 자막 타이밍 및 구성 가이드 제공',
          category: 'content',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <BookOpen size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'video',
          render: () => (
            <ShortFormGuideCard
              productName={activeProductName}
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              onApplyHook={(hook) => setHookOverride(hook)}
              appliedHook={hookOverride}
            />
          ),
        },
        {
          key: 'globalLocalizer',
          label: '글로벌 로컬라이저',
          description: '해외 타겟 맞춤 번역 및 현지화 콘텐츠 생성',
          category: 'export',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Globe size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <GlobalLocalizer
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              caption={baseCaption}
              hashtags={allDisplayHashtags}
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              narrationText={activeHook || activeOneLiner}
              affiliateUrl={shortUrl || primaryAffiliateUrl || undefined}
              preloadedKoreanTtsUrl={ttsUrl || scan.tts_url}
            />
          ),
        },
        {
          key: 'socialShortForm',
          label: '숏폼 인트로/아웃트로',
          description: '숏폼 도입부 후킹 문구 및 마무리 멘트 생성',
          category: 'export',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Share2Icon size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'video',
          render: () => (
            <SocialShortFormShare
              shareText={shareText}
              affiliateUrl={primaryAffiliateUrl}
              shortUrl={shortUrl}
              affiliatePlatforms={affiliatePlatforms}
            />
          ),
        },
        {
          key: 'accountSafety',
          label: '계정 안전 헬스체커',
          description: '발행 간격 쿨다운 타이머 + 안전 점수로 섀도우반 방지',
          category: 'export',
          modes: ['single', 'multi', 'template'] as ScanMode[],
          icon: <ShieldIcon size={16} color={theme.colors.success[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <TouchableOpacity
              style={styles.safetyTileBtn}
              onPress={() => setSafetyCheckerVisible(true)}
              activeOpacity={0.7}
            >
              <ShieldIcon size={16} color={theme.colors.success[400]} strokeWidth={2} />
              <Text style={styles.safetyTileBtnText}>계정 안전 확인하기</Text>
            </TouchableOpacity>
          ),
        },
        {
          key: 'creatorPersona',
          label: '마이 페르소나',
          description: '크리에이터 고유 어조, 시그니처 멘트, 대표 컬러 등록',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <UserIcon size={16} color={theme.colors.accent[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => <CreatorPersonaCard />,
        },
        {
          key: 'snapMix',
          label: 'Snap-Mix 1초 튜닝',
          description: '톤앤매너·시점을 1탭으로 즉시 전환',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <SlidersIcon size={16} color={theme.colors.accent[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => <SnapMixTuner />,
        },
        {
          key: 'microEdit',
          label: '인간의 손길 10% 마이크로 에디팅',
          description: '나만의 사용 후기 1줄 추가 + 실물 촬영 컷 삽입',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <PencilIcon size={16} color={theme.colors.warning[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => <MicroEditSlot />,
        },
        {
          key: 'hyperHumanEngine',
          label: '1% 크리에이터 AI 엔진',
          description: '역발상 훅 + 감정 곡선 TTS + 비트 동기화 3단게 자동 적용',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <ZapIcon size={16} color={theme.colors.accent[400]} strokeWidth={2} />,
          mediaType: 'video',
          render: () => (
            <HyperHumanEngineCard
              productName={activeProductName || scan?.product_name || ''}
              caption={activeCaption}
              hashtags={allDisplayHashtags}
              videoDurationSec={15}
            />
          ),
        },
        {
          key: 'originalityScore',
          label: '크리에이터 독창성 스코어',
          description: '현재 콘텐츠가 얼마나 중복되는지 독창성 점수 산출',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <SparklesIcon size={16} color={theme.colors.accent[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <OriginalityScoreCard
              factors={{
                hasPersonaSignature: !!settings?.brand_persona,
                hasCustomTone: !!settings?.brand_persona,
                hasVoiceClone: false,
                hasMicroEdit: false,
                hasUniqueAngle: false,
                cacheHitCount: 0,
              }}
            />
          ),
        },
        {
          key: 'localizationSafety',
          label: '현지 적합성 스코어',
          description: '법적 규제·금기어·현지 톤 안전성 점검 (FTC/스텔마/공정위)',
          category: 'optimize',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <ShieldIcon size={16} color={theme.colors.success[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <LocalizationSafetyCard
              caption={activeCaption}
              countryCode="US"
              disclosureEnabled={!!settings?.auto_disclosure}
              transcreationApplied={!!settings?.brand_persona}
              nativeToneMatch={!!settings?.brand_persona}
            />
          ),
        },
        {
          key: 'linkInBio',
          label: '링크인바이오 랜딩페이지',
          description: '모든 상품을 한 페이지에 모아두는 프로필 바이오 링크',
          category: 'export',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Link2Icon size={16} color={theme.colors.accent[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <LinkInBioCard
              scanId={scan.id}
              scanTitle={activeProductName || scan.title || '상품'}
            />
          ),
        },
        {
          key: 'smartScheduler',
          label: '스마트 업로드 알림',
          description: '골든타임 예약 푸시 알림과 원클릭 캡션 복사',
          category: 'export',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <BellRing size={16} color={theme.colors.primary[300]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <SmartScheduler
              scanId={scan.id}
              caption={baseCaption}
              hashtags={allDisplayHashtags}
              affiliateUrl={shortUrl || primaryAffiliateUrl || undefined}
              platform={activePlatform}
            />
          ),
        },
      ],
    },
    {
      key: 'analysis',
      label: '분석 / 전략',
      tiles: [
        {
          key: 'shortFormTips',
          label: '숏폼 팁',
          description: '트렌디한 편집 팁과 플랫폼별 최적화 정보',
          category: 'insight',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Lightbulb size={16} color={theme.colors.success[400]} strokeWidth={2} />,
          mediaType: 'video',
          render: () => (
            <ShortFormTipsCard
              hook={activeHook}
              oneLiner={activeOneLiner || scan?.one_liner || ''}
              productAdvantages={td?.productAdvantages || []}
              caption={activeCaption}
              productName={activeProductName || scan?.product_name || ''}
              platform={activePlatform}
              onApplyPlatform={setActivePlatform}
            />
          ),
        },
        {
          key: 'viralPredict',
          label: '바이럴 예측',
          description: '현재 콘텐츠의 바이럴 성공 확률 분석',
          category: 'insight',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Rocket size={16} color={theme.colors.success[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <ViralPredictor
              hook={activeHook}
              title={activeProductName || scan.title || 'Product'}
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              hashtags={allDisplayHashtags}
              comicStyle="lineart"
              panelCount={1}
              hasTTS={!!scan?.tts_url}
              episodeMode={false}
              trendingKeywords={trendingHashtags}
            />
          ),
        },
        {
          key: 'trendMatch',
          label: '트렌드 매치',
          description: '제품과 현재 트렌드의 매칭 점검 및 해시태그 추천',
          category: 'commerce',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <TrendingUpIcon size={16} color={theme.colors.warning[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <TrendMatchCard
              productCategory={selectedProduct?.productCategory || scan?.product_category || ''}
              productName={activeProductName || scan?.product_name || ''}
              platform={activePlatform}
              onApplyHashtags={(tags) => setAddedHashtags((prev) => [...prev, ...tags.filter((t) => !prev.includes(t))])}
            />
          ),
        },
        {
          key: 'personaSim',
          label: '페르소나 시뮬',
          description: '타겟 고객 페르소나별 반응 시뮬레이션',
          category: 'insight',
          modes: ['single', 'multi'] as ScanMode[],
          icon: <Users size={16} color={theme.colors.success[400]} strokeWidth={2} />,
          mediaType: 'both',
          render: () => (
            <PersonaSimulator
              productName={activeProductName || scan.product_name || ''}
              productCategory={selectedProduct?.productCategory || scan.product_category || ''}
              priceEstimate={activePriceEstimate}
              oneLiner={activeOneLiner}
              productAdvantages={td?.productAdvantages || []}
              hook={activeHook}
            />
          ),
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: safeTop + 12 }]}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => {
            if (activePlatform !== 'shortform') {
              handlePlatformChange('shortform');
            } else {
              router.back();
            }
          }}
          activeOpacity={0.7}
        >
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.xxl + insets.bottom + 72 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {analysisStatus === 'processing' && (
          <View style={styles.analysisPendingCard}>
            <View style={styles.analysisPendingHeader}>
              <ActivityIndicator size="small" color={theme.colors.primary[400]} />
              <Text style={styles.analysisPendingTitle}>AI 분석 진행 중</Text>
            </View>
            <Text style={styles.analysisPendingDesc}>
              사진을 분석하고 마케팅 소스를 생성하고 있습니다. 잠시만 기다려주시면 결과가 자동으로 표시됩니다.
            </Text>
            <Text style={styles.analysisPendingHint}>
              대기 중에 다른 탭(제휴 링크, 성과 분석 등)을 자유롭게 이용할 수 있어요.
            </Text>
          </View>
        )}
        {analysisStatus === 'error' && (
          <View style={styles.analysisErrorCard}>
            <CircleAlert size={18} color={theme.colors.error[400]} strokeWidth={2} />
            <Text style={styles.analysisErrorTitle}>AI 분석 실패</Text>
            <Text style={styles.analysisErrorDesc}>
              {analysisError || '분석 중 오류가 발생했습니다. 다시 시도해주세요.'}
            </Text>
            <TouchableOpacity
              style={styles.analysisRetryBtn}
              onPress={async () => {
                if (scan?.analysis_job_id) {
                  setAnalysisStatus('processing');
                  setAnalysisError(null);
                  await supabase
                    .from('render_jobs')
                    .update({ status: 'queued', error_message: null })
                    .eq('id', scan.analysis_job_id);
                  setRetryCount((c) => c + 1);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.analysisRetryText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: scan.edited_image_url || scan.image_url }}
            style={[styles.heroImage, { aspectRatio: heroAspect }]}
            resizeMode="contain"
            onError={() => setHeroAspect(1)}
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

        <QuickTweakPanel
          hook={activeHook}
          productName={activeProductName}
          priceEstimate={activePriceEstimate}
          affiliateUrl={customLinkForCurrentProduct?.url ?? (primaryAffiliateUrl || null)}
          affiliateLabel={customLinkForCurrentProduct?.label ?? ''}
          shortUrl={shortUrl}
          onHookChange={(h) => setHookOverride(h)}
          onProductNameChange={(name) => {
            if (scan) {
              supabase.from('scans').update({ product_name: name }).eq('id', scan.id).then(() => {}, () => {});
              setScan({ ...scan, product_name: name });
            }
          }}
          onPriceChange={(price) => setPriceOverride(price)}
          onAffiliateChange={(url, label) => {
            if (scan && url) {
              handleSaveCustomLink(url, label, selectedProductIndex);
            } else if (scan && !url) {
              handleRemoveCustomLink(selectedProductIndex);
            }
          }}
          onSaveAndShare={handleSaveAndShare}
        />

        <AIProcessAccordion
          synthesisStrategy={td?.category || '스테레오 복원'}
          volumeConfidence={td?.psychologyInsight ? 0.82 : 0.68}
          contextLabel={td?.category || '제품'}
          processingSteps={[
            '5각도 이미지 정합 및 특징점 추출',
            '3D 볼륨 역산 및 깊이 맵 생성',
            '각도 간 보간 프레임 합성',
          ]}
          hookTransitionType={td?.psychologyInsight?.primaryTrigger || 'rotation_zoom'}
          hookDescription={activeHook || '초반 3초 사물 회전 및 줌인으로 시선 강타'}
          sfxCount={3}
          killPointCount={4}
          beatSyncBpm={128}
          cutPointCount={6}
          activePlatform={activePlatform}
          platformLabel={
            activePlatform === 'shortform' ? '숏폼·틱톡' :
            activePlatform === 'instagram' ? '인스타그램' :
            activePlatform === 'naverBlog' ? '네이버 블로그' :
            activePlatform === 'threads' ? '스레드' :
            activePlatform === 'twitter' ? 'X(트위터)' :
            activePlatform === 'pinterest' ? '핀터레스트' :
            activePlatform === 'smartstore' ? '스마트스토어' : '숏폼'
          }
          renderWidth={
            activePlatform === 'pinterest' ? 1000 :
            activePlatform === 'threads' ? 1080 :
            activePlatform === 'naverBlog' || activePlatform === 'smartstore' ? 1200 :
            1080
          }
          renderHeight={
            activePlatform === 'pinterest' ? 1500 :
            activePlatform === 'threads' ? 1350 :
            activePlatform === 'naverBlog' || activePlatform === 'smartstore' ? 1200 :
            1920
          }
          renderCodec="H.264"
          renderFps={30}
          hashtags={allDisplayHashtags}
          captionPreview={activeCaption || activeOneLiner || scan?.summary || ''}
          analysisStatus={analysisStatus}
          editState={{
            volumeIntensity: inlineEdit.volumeIntensity,
            hookEffect: inlineEdit.hookEffect,
            beatSyncSensitivity: inlineEdit.beatSyncSensitivity,
            sfxStyle: inlineEdit.sfxStyle,
            captionText: inlineEdit.captionText || (activeCaption || activeOneLiner || scan?.summary || ''),
            hashtags: allDisplayHashtags,
            videoTemplate: inlineEdit.videoTemplate,
            captionFont: inlineEdit.captionFont,
            captionPosition: inlineEdit.captionPosition,
            bgmMood: inlineEdit.bgmMood,
            aiPrompt: inlineEdit.aiPrompt,
            titleText: inlineEdit.titleText,
          }}
          onEditChange={handleInlineEdit}
          onRemoveHashtag={handleInlineRemoveHashtag}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />

        {analysisStatus !== 'processing' && !hasCustomLink && activeProductName ? (
          <AffiliatePromptBanner
            productName={activeProductName}
            autoLinks={currentAffiliateLinks}
            hasCustomLink={hasCustomLink}
            partnerIdsConfigured={partnerIdsConfigured}
            onConnectLink={handleConnectLink}
          />
        ) : null}

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
                brandPersona={settings?.brand_persona}
              />
            </View>
          )}

          {td?.caption ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Flame size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>1단계 · 플랫폼 게시판 선택</Text>
              </View>
              <PlatformTabs selected={activePlatform} onSelect={handlePlatformChange} />
              {platformSupportsBoth(activePlatform) && (
                <BoardTabs platform={activePlatform} selected={activeBoard} onSelect={setActiveBoard} />
              )}
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

          <View style={styles.section}>
            <View style={styles.publishTileHeader}>
              <UploadIcon size={18} color={theme.colors.warning[400]} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.publishTileTitle}>발행 · 공유</Text>
                <Text style={styles.publishTileDesc}>단축 URL 복사 후 선택한 플랫폼에 업로드</Text>
              </View>
            </View>
            {shortUrl ? (
              <ShortLinkCopyBar url={shortUrl} scanId={scan.id} label="제휴 단축 URL" />
            ) : (
              <View style={styles.publishHintBox}>
                <Text style={styles.publishHintText}>단축 URL이 아직 생성되지 않았습니다. 제휴 링크를 설정하면 자동 생성됩니다.</Text>
              </View>
            )}
          </View>

          <FeatureTileGrid categories={featureCategories} scanMode={scan.scan_source ?? undefined} focusTileKey={focusTileKey} onFocusConsumed={() => setFocusTileKey(null)} mediaFilter={activeBoard as MediaType} />

          {disclosureText ? (
            <View style={styles.disclosureSection}>
              <TouchableOpacity
                style={styles.disclosureToggle}
                onPress={() => setShowDisclosure((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.disclosureToggleText}>제휴 마케팅 고지문구</Text>
                {showDisclosure ? (
                  <ChevronUp size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                ) : (
                  <ChevronDown size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                )}
              </TouchableOpacity>
              {showDisclosure && (
                <Text style={styles.disclosureBody}>{disclosureText}</Text>
              )}
            </View>
          ) : null}

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

      <View style={[styles.floatingBar, { paddingBottom: insets.bottom }]}>
        {uploadProgress !== null && (
          <View style={styles.uploadProgressWrap}>
            <View style={styles.uploadProgressTrack}>
              <View style={[styles.uploadProgressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.uploadProgressText}>
              {uploadDone ? '클라우드 저장 완료!' : uploadProgress < 100 ? `클라우드 업로드 중... ${uploadProgress}%` : '저장 처리 중...'}
            </Text>
          </View>
        )}
        {uploadError && (
          <View style={styles.uploadErrorWrap}>
            <Text style={styles.uploadErrorText}>{uploadError}</Text>
            <TouchableOpacity onPress={() => setUploadError(null)} activeOpacity={0.7}>
              <X size={16} color={theme.colors.error[400]} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.floatingBarRow}>
        <TouchableOpacity
          style={[styles.floatingBarBtn, uploadProgress !== null && { opacity: 0.5 }]}
          onPress={handleSaveAndShare}
          activeOpacity={0.7}
          disabled={uploadProgress !== null}
        >
          {uploadDone ? (
            <Check size={18} color={theme.colors.success[400]} strokeWidth={2.5} />
          ) : uploadProgress !== null ? (
            <ActivityIndicator size="small" color={theme.colors.dark.text} />
          ) : (
            <Download size={18} color={theme.colors.dark.text} strokeWidth={2} />
          )}
          <Text style={styles.floatingBarBtnText}>
            {uploadDone ? '저장됨' : uploadProgress !== null ? '저장 중...' : '갤러리에 저장'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.floatingBarBtn, styles.floatingBarBtnPrimary]}
          onPress={async () => {
            try {
              if (Platform.OS === 'web' && navigator.clipboard) {
                await navigator.clipboard.writeText(shareText);
              } else {
                await Clipboard.setStringAsync(shareText);
              }
              if (Platform.OS !== 'web') {
                await RNShare.share({ message: shareText });
              }
            } catch {
              // clipboard/share failed silently
            }
          }}
          activeOpacity={0.7}
        >
          <Share2 size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.floatingBarBtnTextPrimary}>SNS 바로 공유</Text>
        </TouchableOpacity>
        </View>
      </View>

      <AccountSafetyChecker
        platform={activePlatform}
        visible={safetyCheckerVisible}
        onClose={() => setSafetyCheckerVisible(false)}
      />
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
  publishTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  publishTileTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  publishTileDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  publishHintBox: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  publishHintText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
  },
  safetyTileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.success[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.success[400] + '40',
  },
  safetyTileBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  analysisPendingCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '12',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '25',
    gap: theme.spacing.sm,
  },
  analysisPendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  analysisPendingTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  analysisPendingDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 20,
  },
  analysisPendingHint: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  analysisErrorCard: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.error[500] + '12',
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
    alignItems: 'center',
    gap: 8,
  },
  analysisErrorTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  analysisErrorDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  analysisRetryBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  analysisRetryText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
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
  disclosureSection: {
    marginTop: theme.spacing.lg,
  },
  disclosureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  disclosureToggleText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  disclosureBody: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 4,
    textAlign: 'center',
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
    ...theme.shadows.elevated,
  },
  uploadProgressWrap: {
    flexDirection: 'column',
    gap: 6,
  },
  uploadProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
    borderRadius: 2,
  },
  uploadProgressText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  uploadErrorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  uploadErrorText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  floatingBarRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  floatingBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  floatingBarBtnPrimary: {
    backgroundColor: theme.colors.primary[500],
  },
  floatingBarBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  floatingBarBtnTextPrimary: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
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
  cleanModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.sm,
  },
  cleanModeTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  cleanModeDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  cleanModeSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  cleanModeSwitchActive: {
    backgroundColor: theme.colors.primary[600],
  },
  cleanModeKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.dark.text,
  },
  cleanModeKnobActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
});
