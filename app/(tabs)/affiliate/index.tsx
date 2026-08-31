import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  Image,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { ShoppingBag, Send, Globe, Store, ExternalLink, Settings as SettingsIcon, TrendingUp, Link2, Copy, Check, Camera, Image as ImageIcon, Film, Sparkles, FileText, Hash, Type, Youtube, ChevronDown, ChevronUp, Loader, Plus, X, ScanSearch, Palette, Share2, ShieldCheck, TriangleAlert as AlertTriangle, Flame, ArrowRight, RefreshCw, Music2, Play, Clapperboard } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/lib/theme';
import { getUserSettings } from '@/lib/settings';
import { fetchRevenueRecords } from '@/lib/revenue';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSubTabBarHeight } from '@/hooks/useSubTabBarHeight';
import { PillNavCard } from '@/components/PillNavCard';
import { ErrorRetryBanner } from '@/components/ErrorRetryBanner';
import { SkeletonList } from '@/components/Skeleton';
import { CapturePreviewModal } from '@/components/CapturePreviewModal';
import { UploadPreviewModal, type UploadPreviewData } from '@/components/UploadPreviewModal';
import { ClipboardAffiliateBanner } from '@/components/ClipboardAffiliateBanner';
import { ShortLinkCopyBar } from '@/components/ShortLinkCopyBar';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';
import { compressImageToBase64 } from '@/lib/imageEdit';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import { saveManualScan, uploadImage, analyzeImageWithProductContext, extractProductMeta } from '@/lib/analysis';
import { validateAffiliateUrl, isAmazonUrl, isAliExpressUrl, isShopeeUrl } from '@/lib/affiliate';
import { friendlyError } from '@/lib/errors';
import { setItem } from '@/lib/storage';
import { getDisclosureForPlatforms } from '@/lib/disclosure';
import { fetchAiRecommendBundle, type AiRecommendBundle } from '@/lib/aiRecommend';
import { getDeepLink, getCaptionTemplate, buildPlatformCaption, type UploadPlatformKey, type DisclosurePlacement } from '@/lib/platformUpload';
import { PlatformCaptionOptimizer } from '@/components/PlatformCaptionOptimizer';
import { GlobalLocalizer } from '@/components/GlobalLocalizer';
import { MessageSquare } from 'lucide-react-native';
import type { UserSettings, RevenueRecord } from '@/types/database';

const PLATFORMS = [
  { key: 'Coupang', label: '쿠팡 파트너스', icon: ShoppingBag, color: '#FF3E3E', signupUrl: 'https://partners.coupang.com/', desc: '쿠팡 상품 링크를 공유하고 수수료를 받으세요' },
  { key: 'Toss', label: '토스 쉐어링크', icon: Send, color: '#0064FF', signupUrl: 'https://sharelink.toss.im/', desc: '토스로 링크를 공유하고 보상을 받으세요' },
  { key: 'BrandConnect', label: '네이버 브랜드커넥트', icon: Globe, color: '#03C75A', signupUrl: 'https://brandconnect.naver.com/about/creator', desc: '네이버 쇼핑 제휴 링크를 발급받으세요' },
] as const;

const UPLOAD_PLATFORMS = [
  { key: 'instagram', label: '인스타그램', icon: Camera, color: '#E1306C' },
  { key: 'blog', label: '네이버 블로그', icon: FileText, color: '#03C75A' },
  { key: 'youtube', label: '유튜브 숏츠', icon: Youtube, color: '#FF0000' },
  { key: 'tiktok', label: '틱톡', icon: Music2, color: '#000000' },
  { key: 'pinterest', label: '핀터레스트', icon: ImageIcon, color: '#E60023' },
  { key: 'twitter', label: '트위터/스레드', icon: Hash, color: '#1DA1F2' },
] as const;

const PLATFORM_BOARDS: Record<string, { key: string; label: string }[]> = {
  instagram: [
    { key: 'reels', label: '릴스' },
    { key: 'feed', label: '피드 게시물' },
    { key: 'story', label: '스토리' },
  ],
  blog: [
    { key: 'category_post', label: '카테고리 포스트' },
    { key: 'review', label: '리뷰 글' },
    { key: 'promotion', label: '프로모션 글' },
  ],
  youtube: [
    { key: 'shorts', label: '쇼츠' },
    { key: 'community', label: '커뮤니티 탭' },
    { key: 'video', label: '일반 영상' },
  ],
  tiktok: [
    { key: 'video', label: '틱톡 영상' },
    { key: 'carousel', label: '캐러셀' },
    { key: 'story', label: '스토리' },
  ],
  pinterest: [
    { key: 'pin', label: '핀' },
    { key: 'idea_pin', label: '아이디어 핀' },
    { key: 'board', label: '보드' },
  ],
  twitter: [
    { key: 'thread', label: '스레드' },
    { key: 'tweet', label: '일반 트윗' },
    { key: 'reply', label: '답글' },
  ],
};

const BOARD_VIDEO_SPECS: Record<string, Record<string, { ratio: string; resolution: string; maxDuration: string; format: string }>> = {
  instagram: {
    reels: { ratio: '9:16', resolution: '1080×1920', maxDuration: '90초', format: 'MP4' },
    feed: { ratio: '1:1 또는 4:5', resolution: '1080×1080', maxDuration: '60초', format: 'MP4' },
    story: { ratio: '9:16', resolution: '1080×1920', maxDuration: '15초', format: 'MP4' },
  },
  blog: {
    category_post: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
    review: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
    promotion: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
  },
  youtube: {
    shorts: { ratio: '9:16', resolution: '1080×1920', maxDuration: '60초', format: 'MP4' },
    community: { ratio: '1:1', resolution: '1080×1080', maxDuration: 'GIF/이미지', format: 'MP4/GIF' },
    video: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4' },
  },
  tiktok: {
    video: { ratio: '9:16', resolution: '1080×1920', maxDuration: '10분', format: 'MP4' },
    carousel: { ratio: '9:16', resolution: '1080×1920', maxDuration: '정지형', format: 'JPG/PNG' },
    story: { ratio: '9:16', resolution: '1080×1920', maxDuration: '15초', format: 'MP4' },
  },
  pinterest: {
    pin: { ratio: '2:3', resolution: '1000×1500', maxDuration: '정지형', format: 'JPG/PNG' },
    idea_pin: { ratio: '9:16', resolution: '1080×1920', maxDuration: '60초', format: 'MP4' },
    board: { ratio: '2:3', resolution: '1000×1500', maxDuration: '정지형', format: 'JPG/PNG' },
  },
  twitter: {
    thread: { ratio: '16:9', resolution: '1920×1080', maxDuration: '140초', format: 'MP4' },
    tweet: { ratio: '16:9', resolution: '1920×1080', maxDuration: '140초', format: 'MP4' },
    reply: { ratio: '16:9', resolution: '1920×1080', maxDuration: '140초', format: 'MP4' },
  },
};

type ViralHook = { title: string; desc: string };
type ViralAnalysisResult = {
  hooks: ViralHook[];
  specs: { ratio: string; resolution: string; maxDuration: string; format: string };
  topReference: { title: string; views: string; revenue: string };
  mediaMode: 'video' | 'image';
};

function detectMediaMode(format: string): 'video' | 'image' {
  const upper = format.toUpperCase();
  if (upper.includes('JPG') || upper.includes('PNG') || upper.includes('GIF') || upper.includes('정지형')) {
    return 'image';
  }
  return 'video';
}

function generateViralAnalysis(platform: string, board: string, productUrl: string): ViralAnalysisResult {
  const specs = BOARD_VIDEO_SPECS[platform]?.[board] ?? { ratio: '16:9', resolution: '1920×1080', maxDuration: '60초', format: 'MP4' };

  const baseHooks: ViralHook[] = [
    { title: '첫 3초 강렬한 후크', desc: '상위 1% 영상의 90%가 첫 3초 내 시각적 충격 + 질문 던지기로 시청자를 붙잡습니다. 스와이프를 멈추게 하는 반전 요소를 첫 프레임에 배치하세요.' },
    { title: '손실 회피 심리 자극', desc: '"지금 안 사면 손해"라는 메시지를 스토리텔링으로 삽입. 상위 영상들은 할인 종료, 재고 소진, 한정 판매 등 긴박감을 2~3회 반복 언급합니다.' },
    { title: '사회적 증거 결합', desc: '"이미 12,000명이 구매했습니다" 형태의 사회적 증거를 중간 지점에 배치. 인간은 타인의 선택을 무의식적으로 따라하는 심리가 있습니다.' },
    { title: '감정 곡선 설계', desc: '호기심 → 놀람 → 공감 → 갈망 → 행동의 5단계 감정 곡선을 따라 영상 구조를 설계합니다. 상위 1%는 이 흐름을 압축된 시간 안에 배치합니다.' },
    { title: '행동 유도 최적화', desc: '마지막 3초에 명확한 CTA + 제휴 링크 위치 힌트를 제시. 댓글 유도 질문으로 참여율을 높이고 알고리즘 가시성을 극대화합니다.' },
  ];

  if (platform === 'tiktok' || platform === 'youtube') {
    baseHooks.push(
      { title: '무한 루프 구조', desc: '영상 끝이 시작과 연결되는 무한 루프 구조로 재생 수를 극대화. 짧은 영상에서 특히 효과적인 반복 시청 유도 기법입니다.' },
    );
  }
  if (platform === 'instagram') {
    baseHooks.push(
      { title: '스토리 텔링 몰입', desc: '릴스에서는 개인적 스토리로 시작해 제품 자연스러운 노출로 전환. 광고 느낌을 최소화하고 진정성을 강조하세요.' },
    );
  }
  if (platform === 'pinterest') {
    baseHooks.push(
      { title: '시각적 임팩트 선행', desc: '핀터레스트는 정지형 이미지가 중심입니다. 제품의 가장 매력적인 각도를 전체 화면으로 배치하고 텍스트 오버레이로 핵심 가치를 한 줄로 전달하세요.' },
    );
  }
  if (board === 'story') {
    baseHooks.push(
      { title: '24시간 긴박감 활용', desc: '스토리의 24시간 소멸 특성을 활용해 "오늘만"이라는 메시지로 즉각적 행동을 유도합니다.' },
    );
  }

  const referenceMap: Record<string, { title: string; views: string; revenue: string }> = {
    ig_reels: { title: '인플루언서 릴스 제품 리뷰', views: '2.4M', revenue: '월 480만원' },
    ig_feed: { title: '카드뉴스 스타일 제품 소개', views: '890K', revenue: '월 120만원' },
    ig_story: { title: '데일리 스토리 제품 태그', views: '350K', revenue: '월 80만원' },
    yt_shorts: { title: '쇼츠 제품 언박싱', views: '5.1M', revenue: '월 650만원' },
    yt_community: { title: '커뮤니티 탭 제품 투표', views: '420K', revenue: '월 90만원' },
    yt_video: { title: '상세 리뷰 영상', views: '1.2M', revenue: '월 340만원' },
    blog_category_post: { title: '블로그 상품 리뷰 포스트', views: '450K', revenue: '월 210만원' },
    blog_review: { title: '블로그 상세 리뷰', views: '320K', revenue: '월 180만원' },
    blog_promotion: { title: '블로그 프로모션 글', views: '280K', revenue: '월 150만원' },
    tt_video: { title: '틱톡 바이럴 제품 영상', views: '8.7M', revenue: '월 920만원' },
    tt_carousel: { title: '틱톡 캐러셀 제품 비교', views: '1.8M', revenue: '월 280만원' },
    tt_story: { title: '틱톡 스토리 제품', views: '1.1M', revenue: '월 160만원' },
    pin_pin: { title: '핀터레스트 제품 핀', views: '1.5M', revenue: '월 190만원' },
    pin_idea_pin: { title: '아이디어 핀 제품 데모', views: '2.2M', revenue: '월 310만원' },
    pin_board: { title: '핀터레스트 보드 컬렉션', views: '980K', revenue: '월 140만원' },
    tw_thread: { title: '트위터 제품 스레드', views: '670K', revenue: '월 95만원' },
    tw_tweet: { title: '트위터 제품 트윗', views: '420K', revenue: '월 65만원' },
    tw_reply: { title: '트위터 제품 답글', views: '310K', revenue: '월 48만원' },
  };

  const platformPrefix: Record<string, string> = {
    instagram: 'ig',
    youtube: 'yt',
    blog: 'blog',
    tiktok: 'tt',
    pinterest: 'pin',
    twitter: 'tw',
  };

  const refKey = `${platformPrefix[platform] ?? platform}_${board}`;
  const topReference = referenceMap[refKey] ?? { title: '상위 1% 제휴 영상', views: '1M+', revenue: '월 300만원+' };

  return { hooks: baseHooks, specs, topReference, mediaMode: detectMediaMode(specs.format) };
}

const CONTENT_TYPES = [
  { key: 'copy', label: '마케팅 문구', icon: Type, color: theme.colors.primary[400], hint: '제품을 한 줄로 매력적으로 표현하세요' },
  { key: 'hashtag', label: '해시태그', icon: Hash, color: theme.colors.accent[400], hint: '관련 키워드를 # 과 함께 나열하세요' },
  { key: 'hook', label: '후킹 문장', icon: Sparkles, color: theme.colors.warning[400], hint: '시선을 끄는 첫 문장을 만드세요' },
] as const;

const TEMPLATE_STYLES = [
  { key: 'shortform', label: '숏폼 영상', desc: '릴스·쇼츠용 임팩트', icon: Film },
  { key: 'comic', label: '웹툰형 만화', desc: '스토리텔링 만화', icon: Palette },
  { key: 'cardnews', label: '카드뉴스', desc: '정보 전달 템플릿', icon: FileText },
] as const;

type StepKey = 'affiliate' | 'platformSelect' | 'analyze' | 'content' | 'upload';

const STEP_ORDER: StepKey[] = ['affiliate', 'analyze', 'content', 'upload'];
const STEP_META: Record<StepKey, { num: number; color: string }> = {
  affiliate: { num: 1, color: theme.colors.accent[400] },
  platformSelect: { num: 0, color: theme.colors.warning[400] },
  analyze: { num: 2, color: theme.colors.success[400] },
  content: { num: 3, color: theme.colors.warning[400] },
  upload: { num: 4, color: theme.colors.success[400] },
};

export default function AffiliateScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useSubTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);
  const stepRefs = useRef<Record<number, View | null>>({});

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [expandedStep, setExpandedStep] = useState<StepKey | null>('affiliate');

  // Image for analysis (from product meta or user upload)
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [previewCapture, setPreviewCapture] = useState<{ base64: string; mimeType: string } | null>(null);
  const [imageSource, setImageSource] = useState<'product' | 'user' | null>(null);

  // Step 1: Affiliate link
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [customPlatforms, setCustomPlatforms] = useState<{ key: string; label: string; url: string }[]>([]);
  const [selectedUploadPlatform, setSelectedUploadPlatform] = useState<string | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);
  const [manualUploadPlatforms, setManualUploadPlatforms] = useState<{ key: string; label: string }[]>([]);
  const [manualPlatformName, setManualPlatformName] = useState('');
  const [viralAnalyzing, setViralAnalyzing] = useState(false);
  const [viralAnalysisResult, setViralAnalysisResult] = useState<ViralAnalysisResult | null>(null);
  const [videoPreviewGenerating, setVideoPreviewGenerating] = useState(false);
  const [videoPreviewScenes, setVideoPreviewScenes] = useState<{ time: string; hook: string; desc: string }[] | null>(null);
  const [previewMediaMode, setPreviewMediaMode] = useState<'video' | 'image'>('video');
  const videoPreviewProgress = useSharedValue(0);
  const [videoRendering, setVideoRendering] = useState(false);
  const [videoRenderComplete, setVideoRenderComplete] = useState(false);
  const renderProgress = useSharedValue(0);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${videoPreviewProgress.value * 100}%`,
  }));

  const animatedRenderStyle = useAnimatedStyle(() => ({
    width: `${renderProgress.value * 100}%`,
  }));
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

  // Step 2: AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null);

  const imageDataUrl = useMemo(() => {
    if (!selectedImage || mediaType !== 'photo') return '';
    if (selectedImage.startsWith('data:')) return selectedImage;
    return buildDataUrl(selectedImage, selectedImageMime);
  }, [selectedImage, selectedImageMime, mediaType]);

  // Step 3: Content
  const [simpleMode, setSimpleMode] = useState(true);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiBundle, setAiBundle] = useState<AiRecommendBundle | null>(null);
  const [aiRecommendLoading, setAiRecommendLoading] = useState(false);
  const [lastScanId, setLastScanId] = useState<string | null>(null);
  const [contentText, setContentText] = useState('');
  const [contentType, setContentType] = useState<string>('copy');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('shortform');

  // Step 4: Upload
  const [uploadPlatform, setUploadPlatform] = useState<string | null>(null);
  const [uploadedPlatforms, setUploadedPlatforms] = useState<Set<string>>(new Set());
  const [autoDisclosure, setAutoDisclosure] = useState(true);
  const [previewUpload, setPreviewUpload] = useState<UploadPreviewData | null>(null);
  const [deepLinkFeedback, setDeepLinkFeedback] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [disclosurePlacement, setDisclosurePlacement] = useState<DisclosurePlacement>('body');
  const [showUploadConfirm, setShowUploadConfirm] = useState<string | null>(null);
  const [pendingUploadPlatform, setPendingUploadPlatform] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, r] = await Promise.all([getUserSettings(), fetchRevenueRecords(10)]);
      setSettings(s);
      setRevenue(r);
      if (s?.auto_disclosure != null) setAutoDisclosure(s.auto_disclosure);
    } catch (err) {
      setLoadError(friendlyError(err, '제휴 마케팅 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해주세요.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalRevenue = useMemo(() => revenue.reduce((sum, r) => sum + (r.amount || 0), 0), [revenue]);

  const markCompleted = (key: StepKey) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const idx = STEP_ORDER.indexOf(key);
    if (idx < STEP_ORDER.length - 1) {
      const nextKey = STEP_ORDER[idx + 1];
      setExpandedStep(nextKey);
      const nextStepNum = idx + 2;
      setTimeout(() => {
        const targetRef = stepRefs.current[nextStepNum];
        if (targetRef && scrollRef.current) {
          targetRef.measureLayout(
            scrollRef.current as any,
            (_x, y) => {
              scrollRef.current?.scrollTo({ y: y - 20, animated: true });
            },
            () => {},
          );
        }
      }, 300);
    }
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleCopySignup = async (platform: string, url: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
      } else {
        const { default: Clipboard } = await import('expo-clipboard');
        await Clipboard.setStringAsync(url);
      }
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch {
      // clipboard failed
    }
  };

  const isConfigured = useCallback((key: string): boolean => {
    if (!settings) return false;
    if (key === 'Coupang') return !!settings.coupang_partners_id;
    if (key === 'Toss') return !!settings.toss_share_id;
    if (key === 'BrandConnect') return !!settings.naver_shopping_id;
    return false;
  }, [settings]);

  // Step 2: Pick own photo (optional — product image is used by default)
  const handlePickPhoto = async () => {
    setMediaLoading(true);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) {
          setMediaLoading(false);
          return;
        }
        setPreviewCapture({ base64: cleanBase64(images[0].base64), mimeType: images[0].mimeType });
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
        });
        if (result.canceled || !result.assets?.[0]?.uri) {
          setMediaLoading(false);
          return;
        }
        const { base64, mimeType } = await compressImageToBase64(result.assets[0].uri, 1280, 0.7);
        setPreviewCapture({ base64, mimeType });
      }
    } catch {
      setMediaLoading(false);
    }
    setMediaLoading(false);
  };

  // CapturePreviewModal confirm → set user photo as analysis image
  const handlePreviewConfirm = (base64: string, mimeType: string) => {
    setSelectedImage(base64);
    setSelectedImageMime(mimeType);
    setMediaType('photo');
    setImageSource('user');
    setPreviewCapture(null);
  };

  const handlePreviewRetake = () => {
    setPreviewCapture(null);
  };

  // Step 1: Save affiliate link and extract product metadata
  const [urlWarning, setUrlWarning] = useState<string | null>(null);

  const [urlToast, setUrlToast] = useState<string | null>(null);

  const handleSaveAffiliate = async () => {
    if (!affiliateUrl.trim()) {
      setUrlToast('올바른 상품 링크를 입력해주세요');
      setTimeout(() => setUrlToast(null), 3000);
      return;
    }
    const validation = validateAffiliateUrl(affiliateUrl);
    if (!validation.valid) {
      setExtractError(validation.error);
      setUrlWarning(null);
      return;
    }
    setAffiliateUrl(validation.normalizedUrl);
    setUrlWarning(validation.warning);
    setExtracting(true);
    setExtractError(null);
    setCompletedSteps(new Set());
    setProductMeta(null);
    setUploadedPlatforms(new Set());
    try {
      const meta = await extractProductMeta(validation.normalizedUrl);
      const newMeta = {
        productName: meta.productName || '',
        description: meta.description || '',
        price: meta.price || '',
        image: meta.image || '',
        platform: meta.platform || '',
        brand: meta.brand || '',
      };
      setProductMeta(newMeta);
      markCompleted('affiliate');
      // Auto-set product image as the analysis image
      if (newMeta.image) {
        try {
          const { urlToDataUrl } = await import('@/lib/base64');
          const dataUrl = await urlToDataUrl(newMeta.image);
          setSelectedImage(cleanBase64(dataUrl));
          setSelectedImageMime('image/jpeg');
          setMediaType('photo');
          setImageSource('product');
        } catch {
          // image fetch failed — user can upload manually
        }
      }
    } catch {
      setProductMeta(null);
      setExtractError('상품 정보를 자동으로 가져오지 못했습니다. 네트워크 연결을 확인하거나 링크를 다시 확인해주세요.');
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedImage || mediaType !== 'photo' || analyzing) return;
    if (!productMeta && !affiliateUrl.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const imageUrl = await uploadImage(selectedImage, selectedImageMime);
      const scanId = await saveManualScan(imageUrl);
      if (productMeta) {
        try {
          const dataUrl = selectedImage.startsWith('data:') ? selectedImage : buildDataUrl(selectedImage, selectedImageMime);
          await analyzeImageWithProductContext(
            dataUrl,
            'scan.jpg',
            selectedImageMime || 'image/jpeg',
            'single',
            {
              productName: productMeta.productName,
              description: productMeta.description,
              price: productMeta.price,
              brand: productMeta.brand,
              platform: productMeta.platform,
            },
          );
        } catch {
          // analysis enhancement is best-effort; scan already saved
        }
      }
      markCompleted('analyze');
      setLastScanId(scanId);

      setAiRecommendLoading(true);
      try {
        const bundle = await fetchAiRecommendBundle({
          productName: productMeta?.productName || '',
          productCategory: productMeta?.platform || '',
          hook: '',
          oneLiner: '',
          fallbackHashtags: [],
        });
        setAiBundle(bundle);
        setAiRecommendation(bundle.templateLabel);
        const match = TEMPLATE_STYLES.find((t) => bundle.templateLabel.includes(t.label));
        if (match) setSelectedTemplate(match.key);
      } catch {
        setAiRecommendation('웹툰형 만화');
      } finally {
        setAiRecommendLoading(false);
      }

      markCompleted('content');
      setAnalyzing(false);
      router.push({ pathname: '/result/[id]', params: { id: scanId } });
    } catch (err) {
      setAnalyzeError(friendlyError(err, 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      setAnalyzing(false);
    }
  };

  // Step 3: Save content
  const handleSaveContent = () => {
    if (!contentText.trim()) return;
    markCompleted('content');
  };

  // Step 4: Open preview before upload
  const handleUploadToPlatform = (platformKey: string) => {
    const platform = UPLOAD_PLATFORMS.find((p) => p.key === platformKey);
    if (!platform) return;
    const Icon = platform.icon;
    setPreviewUpload({
      platformKey: platform.key,
      platformLabel: platform.label,
      platformColor: platform.color,
      platformIcon: <Icon size={18} color={platform.color} strokeWidth={2} />,
      mediaUri: imagePreviewUri,
      mediaType: mediaType,
      caption: contentText,
      affiliateUrl: affiliateUrl,
      disclosureText,
      autoDisclosure,
      templateLabel: TEMPLATE_STYLES.find((t) => t.key === selectedTemplate)?.label ?? '',
      productName: productMeta?.productName ?? '',
    });
  };

  const handleConfirmUpload = (edited: { caption: string; affiliateUrl: string; autoDisclosure: boolean }) => {
    if (!previewUpload) return;
    setContentText(edited.caption);
    setAffiliateUrl(edited.affiliateUrl);
    setAutoDisclosure(edited.autoDisclosure);
    setUploadPlatform(previewUpload.platformKey);
    setUploadedPlatforms((prev) => new Set(prev).add(previewUpload.platformKey));
    setPreviewUpload(null);
    markCompleted('upload');
  };

  const handleOpenDeepLink = (key: string) => {
    const dl = getDeepLink(key as UploadPlatformKey);
    if (!dl) return;
    setDeepLinkFeedback(key);
    setTimeout(() => setDeepLinkFeedback(null), 2500);
    Linking.openURL(dl.appUrl).catch(() => {
      Linking.openURL(dl.webUrl).catch(() => {});
    });
  };

  const handleCopyText = async (text: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        const { default: Clipboard } = await import('expo-clipboard');
        await Clipboard.setStringAsync(text);
      }
    } catch {
      // clipboard failed
    }
  };

  const handleOneTapCopyAndOpen = async (key: string) => {
    const built = buildPlatformCaption(
      key as UploadPlatformKey,
      contentText,
      affiliateUrl,
      selectedPlatform ? [selectedPlatform] : [],
      autoDisclosure,
      disclosurePlacement,
    );
    const script = built.fullText;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(script);
      } else {
        const { default: Clipboard } = await import('expo-clipboard');
        await Clipboard.setStringAsync(script);
      }
      setCopyFeedback(key);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      // clipboard failed
    }
    setPendingUploadPlatform(key);
    setShowUploadConfirm(key);
    setTimeout(() => {
      handleOpenDeepLink(key);
    }, 300);
  };

  const handleConfirmUploadComplete = () => {
    if (!showUploadConfirm) return;
    setUploadedPlatforms((prev) => new Set(prev).add(showUploadConfirm));
    setUploadPlatform(showUploadConfirm);
    setShowUploadConfirm(null);
    setPendingUploadPlatform(null);
    markCompleted('upload');
  };

  const handleCancelUploadConfirm = () => {
    setShowUploadConfirm(null);
    setPendingUploadPlatform(null);
  };

  const handleMarkUploaded = (key: string) => {
    setUploadedPlatforms((prev) => new Set(prev).add(key));
    setUploadPlatform(key);
    markCompleted('upload');
  };

  const imagePreviewUri = useMemo(
    () => selectedImage
      ? mediaType === 'photo' && selectedImage.startsWith('data:')
        ? selectedImage
        : mediaType === 'photo'
          ? buildDataUrl(selectedImage, selectedImageMime)
          : selectedImage
      : null,
    [selectedImage, mediaType, selectedImageMime],
  );

  const scrollToStep = (stepNum: number) => {
    setTimeout(() => {
      const targetRef = stepRefs.current[stepNum];
      if (targetRef && scrollRef.current) {
        targetRef.measureLayout(
          scrollRef.current as any,
          (_x, y) => { scrollRef.current?.scrollTo({ y: y - 20, animated: true }); },
          () => {},
        );
      }
    }, 100);
  };

  const disclosureText = useMemo(() => {
    const platforms = selectedPlatform ? [selectedPlatform] : [];
    return getDisclosureForPlatforms(platforms, autoDisclosure);
  }, [selectedPlatform, autoDisclosure]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: safeTop + theme.spacing.sm, paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {loadError && (
          <ErrorRetryBanner message={loadError} onRetry={loadData} retrying={loading} />
        )}

        {loading && !loadError && (
          <SkeletonList count={4} />
        )}

        {!loading && (
          <>
        {/* Header */}
        <View style={styles.verticalHeader}>
          <Text style={styles.verticalTitle}>제휴쇼핑 콘텐츠 제작</Text>
          <Text style={styles.verticalSubtitle}>
            제작 순서대로 아래 카드를 펼쳐 진행하세요
          </Text>
        </View>

        {/* Full-width pill nav cards in production order */}
        <PillNavCard
          icon={<Link2 size={22} color={theme.colors.accent[400]} strokeWidth={2.5} />}
          title="제휴 상품 선택하기"
          subtitle="URL 붙여넣기 · 클립보드 자동 인식 · 상품 정보 추출"
          accentColor={theme.colors.accent[400]}
          iconBg={theme.colors.accent[500] + '22'}
          stepNumber={1}
          expanded={expandedStep === 'affiliate'}
          completed={completedSteps.has('affiliate')}
          onToggle={() => setExpandedStep(expandedStep === 'affiliate' ? null : 'affiliate')}
        >
          {/* Affiliate URL input — top of card */}
          <View style={styles.affiliateUrlInputWrap}>
            <View style={styles.affiliateUrlInputRow}>
              <View style={styles.affiliateUrlInputField}>
                <Link2 size={16} color={theme.colors.dark.textDim} strokeWidth={2} style={styles.affiliateUrlInputIcon} />
                <TextInput
                  style={styles.affiliateUrlInput}
                  value={affiliateUrl}
                  onChangeText={setAffiliateUrl}
                  placeholder="제휴 상품 링크 URL 입력하기"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="go"
                  onSubmitEditing={handleSaveAffiliate}
                />
              </View>
              <TouchableOpacity
                style={[styles.affiliateUrlConnectBtn, (!affiliateUrl.trim() || extracting) && styles.affiliateUrlConnectBtnDisabled]}
                onPress={handleSaveAffiliate}
                disabled={!affiliateUrl.trim() || extracting}
                activeOpacity={0.85}
              >
                {extracting ? (
                  <Loader size={16} color="#fff" strokeWidth={2} />
                ) : (
                  <ArrowRight size={16} color="#fff" strokeWidth={2} />
                )}
                <Text style={styles.affiliateUrlConnectBtnText}>연결</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Platform list (collapsible) */}
          <PlatformListSection
            platforms={PLATFORMS}
            isConfigured={isConfigured}
            copiedPlatform={copiedPlatform}
            onOpenUrl={handleOpenUrl}
            onCopySignup={handleCopySignup}
            customPlatforms={customPlatforms}
            onAddCustomPlatform={(name, url) => {
              const key = 'custom_' + Date.now();
              setCustomPlatforms((prev) => [...prev, { key, label: name, url }]);
            }}
            onRemoveCustomPlatform={(key) => {
              setCustomPlatforms((prev) => prev.filter((cp) => cp.key !== key));
              if (selectedPlatform === key) setSelectedPlatform('');
            }}
            onSelectCustomPlatform={(key, url) => {
              setSelectedPlatform(key);
              setAffiliateUrl(url);
            }}
            selectedPlatform={selectedPlatform}
          />

          {/* Product metadata preview */}
          {extractError && (
            <View style={styles.extractErrorBox}>
              <Text style={styles.extractErrorText}>{extractError}</Text>
              <View style={styles.extractErrorActionRow}>
                <TouchableOpacity
                  style={styles.extractRetryBtn}
                  onPress={handleSaveAffiliate}
                  disabled={extracting}
                  activeOpacity={0.7}
                >
                  {extracting ? (
                    <Loader size={12} color={theme.colors.error[400]} strokeWidth={2} />
                  ) : (
                    <RefreshCw size={12} color={theme.colors.error[400]} strokeWidth={2} />
                  )}
                  <Text style={styles.extractRetryBtnText}>재시도</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.extractManualBtn}
                  onPress={() => {
                    setExtractError(null);
                    scrollToStep(2);
                  }}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={styles.extractManualBtnText}>수동 입력으로 진행</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {urlWarning && !extractError && (
            <View style={styles.urlWarningBox}>
              <AlertTriangle size={12} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.urlWarningText}>{urlWarning}</Text>
            </View>
          )}

          {productMeta && (productMeta.productName || productMeta.price) && (
            <View style={styles.productMetaCard}>
              {productMeta.image ? (
                <Image
                  source={{ uri: productMeta.image }}
                  style={styles.productMetaImage}
                  resizeMode="cover"
                />
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
                {productMeta.description ? (
                  <Text style={styles.productMetaDesc} numberOfLines={3}>{productMeta.description}</Text>
                ) : null}
              </View>
            </View>
          )}
        </PillNavCard>

        {/* Platform selection */}
        <PillNavCard
          icon={<Share2 size={22} color={theme.colors.warning[400]} strokeWidth={2.5} />}
          title="플랫폼 선택하기"
          subtitle="주요 플랫폼 업로드 게시판 선택 · 수동 입력"
          accentColor={theme.colors.warning[400]}
          iconBg={theme.colors.warning[500] + '22'}
          expanded={expandedStep === 'platformSelect'}
          onToggle={() => setExpandedStep(expandedStep === 'platformSelect' ? null : 'platformSelect')}
        >
          <Text style={styles.sectionLabel}>주요 플랫폼 (1개 선택)</Text>
          <View style={styles.uploadGrid}>
            {UPLOAD_PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isSelected = selectedUploadPlatform === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.uploadCard, isSelected && { borderColor: p.color, backgroundColor: p.color + '15' }]}
                  onPress={() => {
                    setSelectedUploadPlatform((prev) => (prev === p.key ? null : p.key));
                    setSelectedBoard(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.uploadIcon, { backgroundColor: p.color + '20' }]}>
                    <Icon size={20} color={p.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.uploadLabel}>{p.label}</Text>
                  <View style={[styles.platformSelectBadge, isSelected && { backgroundColor: p.color, borderColor: p.color }]}>
                    {isSelected ? (
                      <Check size={12} color="#fff" strokeWidth={2.5} />
                    ) : (
                      <Plus size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {manualUploadPlatforms.map((mp) => {
            const isSelected = selectedUploadPlatform === mp.key;
            return (
              <TouchableOpacity
                key={mp.key}
                style={[styles.manualPlatformRow, isSelected && { borderColor: theme.colors.accent[400] }]}
                onPress={() => {
                  setSelectedUploadPlatform((prev) => (prev === mp.key ? null : mp.key));
                  setSelectedBoard(null);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.uploadIcon, { backgroundColor: theme.colors.accent[400] + '20' }]}>
                  <Share2 size={18} color={theme.colors.accent[300]} strokeWidth={2} />
                </View>
                <Text style={styles.manualPlatformLabel}>{mp.label}</Text>
                <View style={[styles.platformSelectBadge, isSelected && { backgroundColor: theme.colors.accent[400], borderColor: theme.colors.accent[400] }]}>
                  {isSelected ? (
                    <Check size={12} color="#fff" strokeWidth={2.5} />
                  ) : (
                    <Plus size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setManualUploadPlatforms((prev) => prev.filter((x) => x.key !== mp.key));
                    if (isSelected) {
                      setSelectedUploadPlatform(null);
                      setSelectedBoard(null);
                    }
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          <View style={styles.manualPlatformInputRow}>
            <TextInput
              style={styles.manualPlatformInput}
              value={manualPlatformName}
              onChangeText={setManualPlatformName}
              placeholder="플랫폼 이름 입력 (예: 틱톡, 핀터레스트)"
              placeholderTextColor={theme.colors.dark.textFaint}
            />
            <TouchableOpacity
              style={[styles.manualPlatformAddBtn, !manualPlatformName.trim() && styles.addPlatformConfirmBtnDisabled]}
              onPress={() => {
                if (!manualPlatformName.trim()) return;
                const key = 'manual_' + Date.now();
                setManualUploadPlatforms((prev) => [...prev, { key, label: manualPlatformName.trim() }]);
                setManualPlatformName('');
              }}
              disabled={!manualPlatformName.trim()}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.manualPlatformAddBtnText}>추가</Text>
            </TouchableOpacity>
          </View>

          {selectedUploadPlatform && PLATFORM_BOARDS[selectedUploadPlatform] && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: theme.spacing.md }]}>
                업로드 게시판 선택
              </Text>
              <View style={styles.boardListWrap}>
                {PLATFORM_BOARDS[selectedUploadPlatform].map((b) => {
                  const isBoardSelected = selectedBoard === b.key;
                  return (
                    <TouchableOpacity
                      key={b.key}
                      style={[styles.boardChip, isBoardSelected && styles.boardChipActive]}
                      onPress={() => setSelectedBoard(isBoardSelected ? null : b.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[styles.boardChipText, isBoardSelected && styles.boardChipTextActive]}
                      >
                        {b.label}
                      </Text>
                      {isBoardSelected && <Check size={13} color="#fff" strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {selectedUploadPlatform && (!PLATFORM_BOARDS[selectedUploadPlatform]) && (
            <Text style={[styles.sectionLabel, { marginTop: theme.spacing.md }]}>
              이 플랫폼은 게시판 선택이 없습니다. 바로 업로드할 수 있습니다.
            </Text>
          )}

          {selectedUploadPlatform && (
            <View style={styles.platformSummaryBox}>
              <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.platformSummaryText}>
                {UPLOAD_PLATFORMS.find((p) => p.key === selectedUploadPlatform)?.label
                  || manualUploadPlatforms.find((mp) => mp.key === selectedUploadPlatform)?.label
                  || '플랫폼'} 선택됨
                {selectedBoard ? ` · ${PLATFORM_BOARDS[selectedUploadPlatform]?.find((b) => b.key === selectedBoard)?.label ?? ''}` : ''}
              </Text>
            </View>
          )}

          {selectedUploadPlatform && selectedBoard && (
            <View style={styles.viralAnalysisBox}>
              <View style={styles.viralAnalysisHeader}>
                <View style={styles.viralAnalysisIconWrap}>
                  <TrendingUp size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viralAnalysisTitle}>상위 1% 수익화 영상 분석</Text>
                  <Text style={styles.viralAnalysisSub}>
                    {UPLOAD_PLATFORMS.find((p) => p.key === selectedUploadPlatform)?.label ?? ''} ·{' '}
                    {PLATFORM_BOARDS[selectedUploadPlatform]?.find((b) => b.key === selectedBoard)?.label ?? ''} 게시판
                  </Text>
                </View>
              </View>

              {viralAnalyzing ? (
                <View style={styles.viralLoadingWrap}>
                  <Loader size={18} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.viralLoadingText}>연결 링크 크롤링 · 상위 1% 영상 패턴 분석 중...</Text>
                </View>
              ) : viralAnalysisResult ? (
                <View style={styles.viralResultWrap}>
                  <View style={styles.viralSpecRow}>
                    <View style={styles.viralSpecChip}>
                      <Text style={styles.viralSpecLabel}>화면비</Text>
                      <Text style={styles.viralSpecValue}>{viralAnalysisResult.specs.ratio}</Text>
                    </View>
                    <View style={styles.viralSpecChip}>
                      <Text style={styles.viralSpecLabel}>해상도</Text>
                      <Text style={styles.viralSpecValue}>{viralAnalysisResult.specs.resolution}</Text>
                    </View>
                    <View style={styles.viralSpecChip}>
                      <Text style={styles.viralSpecLabel}>최대 길이</Text>
                      <Text style={styles.viralSpecValue}>{viralAnalysisResult.specs.maxDuration}</Text>
                    </View>
                    <View style={styles.viralSpecChip}>
                      <Text style={styles.viralSpecLabel}>포맷</Text>
                      <Text style={styles.viralSpecValue}>{viralAnalysisResult.specs.format}</Text>
                    </View>
                  </View>

                  <View style={styles.viralRefBox}>
                    <Text style={styles.viralRefTitle}>참조: {viralAnalysisResult.topReference.title}</Text>
                    <View style={styles.viralRefStats}>
                      <View style={styles.viralRefStat}>
                        <Text style={styles.viralRefStatValue}>{viralAnalysisResult.topReference.views}</Text>
                        <Text style={styles.viralRefStatLabel}>조회수</Text>
                      </View>
                      <View style={styles.viralRefDivider} />
                      <View style={styles.viralRefStat}>
                        <Text style={styles.viralRefStatValue}>{viralAnalysisResult.topReference.revenue}</Text>
                        <Text style={styles.viralRefStatLabel}>예상 수익</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.viralHooksLabel}>심리 자극 요소 분석</Text>
                  {viralAnalysisResult.hooks.map((hook, i) => (
                    <View key={i} style={styles.viralHookRow}>
                      <View style={styles.viralHookNumber}>
                        <Text style={styles.viralHookNumberText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.viralHookTitle}>{hook.title}</Text>
                        <Text style={styles.viralHookDesc}>{hook.desc}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.viralPreviewBtnWrap}>
                    <TouchableOpacity
                      style={styles.viralPreviewBtn}
                      onPress={() => {
                        if (!viralAnalysisResult) return;
                        setVideoPreviewGenerating(true);
                        setVideoPreviewScenes(null);
                        setVideoRenderComplete(false);
                        setPreviewMediaMode(viralAnalysisResult.mediaMode);
                        videoPreviewProgress.value = 0;
                        videoPreviewProgress.value = withTiming(1, {
                          duration: 2200,
                          easing: Easing.inOut(Easing.ease),
                        });
                        setExpandedStep('analyze');
                        setTimeout(() => {
                          const maxDur = viralAnalysisResult.specs.maxDuration ?? '60초';
                          const totalSec = parseInt(maxDur, 10) || 60;
                          const scenes = viralAnalysisResult.hooks.map((hook, i) => ({
                            time: `${Math.floor((totalSec / viralAnalysisResult.hooks.length) * i)}s`,
                            hook: hook.title,
                            desc: hook.desc,
                          }));
                          setVideoPreviewScenes(scenes);
                          setVideoPreviewGenerating(false);
                        }, 2200);
                      }}
                      activeOpacity={0.85}
                    >
                      {videoPreviewGenerating ? (
                        <Loader size={16} color="#fff" strokeWidth={2} />
                      ) : (
                        <ScanSearch size={16} color="#fff" strokeWidth={2} />
                      )}
                      <Text style={styles.viralPreviewBtnText}>
                        {videoPreviewGenerating
                          ? (viralAnalysisResult.mediaMode === 'image' ? '이미지 생성 중...' : '미리보기 생성 중...')
                          : (viralAnalysisResult.mediaMode === 'image' ? '분석 이미지 미리보기 생성하기' : '분석 영상 미리보기 생성하기')}
                      </Text>
                      <ArrowRight size={14} color="#fff" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.viralStartBtn}
                  onPress={() => {
                    setViralAnalyzing(true);
                    setTimeout(() => {
                      setViralAnalyzing(false);
                      setViralAnalysisResult(
                        generateViralAnalysis(
                          selectedUploadPlatform,
                          selectedBoard,
                          affiliateUrl,
                        ),
                      );
                    }, 1800);
                  }}
                  activeOpacity={0.85}
                >
                  <TrendingUp size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
                  <Text style={styles.viralStartBtnText}>심리 자극 영상 분석 시작</Text>
                  <ArrowRight size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </PillNavCard>

        {/* STEP 2: AI Analysis & Image */}
        <View
          ref={(ref) => { stepRefs.current[2] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<ScanSearch size={22} color={theme.colors.success[400]} strokeWidth={2.5} />}
          title="분석 영상 미리보기"
          subtitle="상위 1% 수익화 영상 분석 · 심리 자극 요소 추출 · 미리보기 생성"
          accentColor={theme.colors.success[400]}
          iconBg={theme.colors.success[500] + '22'}
          stepNumber={2}
          completed={completedSteps.has('analyze')}
          expanded={expandedStep === 'analyze'}
          onToggle={() => setExpandedStep(expandedStep === 'analyze' ? null : 'analyze')}
        >
          {/* Video preview area */}
          <View style={styles.videoPreviewWrap}>
            {imagePreviewUri ? (
              <Image
                source={{ uri: imagePreviewUri }}
                style={styles.videoPreviewThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.videoPreviewPlaceholderBg} />
            )}

            <View style={styles.videoPreviewOverlay}>
              {videoPreviewGenerating ? (
                <View style={styles.videoPreviewGenWrap}>
                  <Loader size={28} color="#fff" strokeWidth={2} />
                  <Text style={styles.videoPreviewGenText}>
                    {previewMediaMode === 'image'
                      ? '심리 자극 요소 기반 이미지 스토리보드 생성 중...'
                      : '심리 자극 요소 기반 스토리보드 생성 중...'}
                  </Text>
                </View>
              ) : videoRendering ? (
                <View style={styles.videoPreviewGenWrap}>
                  <Loader size={28} color="#fff" strokeWidth={2} />
                  <Text style={styles.videoPreviewGenText}>
                    {previewMediaMode === 'image' ? '스토리보드 기반 이미지 렌더링 중...' : '스토리보드 기반 영상 렌더링 중...'}
                  </Text>
                </View>
              ) : videoRenderComplete ? (
                <View style={styles.videoSceneWrap}>
                  <Play size={28} color="#fff" strokeWidth={2} fill="#fff" />
                  <Text style={styles.videoSceneBadgeText}>{previewMediaMode === 'image' ? '이미지 생성 완료' : '영상 생성 완료'}</Text>
                </View>
              ) : videoPreviewScenes ? (
                <View style={styles.videoSceneWrap}>
                  <Text style={styles.videoSceneBadgeText}>{previewMediaMode === 'image' ? '이미지 스토리보드 미리보기' : '스토리보드 미리보기'}</Text>
                </View>
              ) : imagePreviewUri ? (
                <TouchableOpacity style={styles.videoPlayBtn} activeOpacity={0.85}>
                  <Play size={28} color="#fff" strokeWidth={2} fill="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={styles.videoPreviewEmptyInline}>
                  <Clapperboard size={28} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                  <Text style={styles.videoPreviewEmptyInlineText}>
                    미리보기 생성 버튼을 눌러 영상 스토리보드를 만들어보세요
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.videoSpecBadge}>
              <Clapperboard size={11} color="#fff" strokeWidth={2} />
              <Text style={styles.videoSpecBadgeText}>
                {viralAnalysisResult
                  ? `${viralAnalysisResult.specs.ratio} · ${viralAnalysisResult.specs.maxDuration}`
                  : selectedUploadPlatform && selectedBoard
                    ? `${BOARD_VIDEO_SPECS[selectedUploadPlatform]?.[selectedBoard]?.ratio ?? '16:9'} · ${BOARD_VIDEO_SPECS[selectedUploadPlatform]?.[selectedBoard]?.maxDuration ?? '60초'}`
                    : '9:16 · 60초'}
              </Text>
            </View>

            <View style={styles.videoTimelineBar}>
              <Animated.View
                style={[styles.videoTimelineProgress, animatedProgressStyle]}
              />
            </View>
            <View style={styles.videoTimelineLabels}>
              <Text style={styles.videoTimelineLabel}>0:00</Text>
              <Text style={styles.videoTimelineLabel}>
                {viralAnalysisResult?.specs.maxDuration ?? '0:60'}
              </Text>
            </View>
          </View>

          {/* Storyboard scenes from viral hooks */}
          {videoPreviewScenes && videoPreviewScenes.length > 0 && (
            <View style={styles.videoStoryboardWrap}>
              <Text style={styles.videoStoryboardTitle}>
                {previewMediaMode === 'image' ? '심리 자극 요소 기반 이미지 스토리보드' : '심리 자극 요소 기반 스토리보드'}
              </Text>
              <Text style={styles.videoStoryboardDesc}>
                {previewMediaMode === 'image'
                  ? '상위 1% 수익화 이미지 패턴을 적용한 장면 구성'
                  : '상위 1% 수익화 영상 패턴을 적용한 장면 구성'}
              </Text>
              {videoPreviewScenes.map((scene, i) => (
                <View key={i} style={styles.videoSceneCard}>
                  <View style={styles.videoSceneTimeBadge}>
                    <Text style={styles.videoSceneTimeText}>{scene.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoSceneHookText}>{scene.hook}</Text>
                    <Text style={styles.videoSceneDescText} numberOfLines={2}>{scene.desc}</Text>
                  </View>
                  <View style={styles.videoSceneNumber}>
                    <Text style={styles.videoSceneNumberText}>{i + 1}</Text>
                  </View>
                </View>
              ))}

              {/* Render video from storyboard button */}
              <TouchableOpacity
                style={[styles.renderVideoBtn, videoRendering && styles.renderVideoBtnDisabled]}
                onPress={() => {
                  if (videoRendering || videoRenderComplete) return;
                  setVideoRendering(true);
                  setVideoRenderComplete(false);
                  renderProgress.value = 0;
                  renderProgress.value = withTiming(1, {
                    duration: 3000,
                    easing: Easing.inOut(Easing.ease),
                  }, (finished) => {
                    if (finished) {
                      runOnJS(setVideoRendering)(false);
                      runOnJS(setVideoRenderComplete)(true);
                    }
                  });
                }}
                disabled={videoRendering || videoRenderComplete}
                activeOpacity={0.85}
              >
                {videoRendering ? (
                  <Loader size={16} color="#fff" strokeWidth={2} />
                ) : videoRenderComplete ? (
                  <Check size={16} color="#fff" strokeWidth={2.5} />
                ) : (
                  previewMediaMode === 'image' ? <ImageIcon size={16} color="#fff" strokeWidth={2} /> : <Film size={16} color="#fff" strokeWidth={2} />
                )}
                <Text style={styles.renderVideoBtnText}>
                  {videoRendering
                    ? (previewMediaMode === 'image' ? '이미지 렌더링 중...' : '영상 렌더링 중...')
                    : videoRenderComplete
                      ? (previewMediaMode === 'image' ? '이미지 생성 완료' : '영상 생성 완료')
                      : (previewMediaMode === 'image' ? '스토리보드로 이미지 만들기' : '스토리보드로 영상 만들기')}
                </Text>
              </TouchableOpacity>

              {videoRendering && (
                <View style={styles.renderProgressBarWrap}>
                  <Animated.View
                    style={[styles.renderProgressBarFill, animatedRenderStyle]}
                  />
                </View>
              )}

              {videoRenderComplete && (
                <View style={styles.renderCompleteBox}>
                  <Text style={styles.renderCompleteText}>
                    {previewMediaMode === 'image'
                      ? `심리 자극 요소 ${videoPreviewScenes.length}개 요소가 적용된 이미지가 생성되었습니다. 3단계에서 스타일과 음성을 설정해주세요.`
                      : `심리 자극 요소 ${videoPreviewScenes.length}개 장면이 적용된 영상이 생성되었습니다. 3단계에서 스타일과 음성을 설정해주세요.`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* AI 분석 시작 */}
          <TouchableOpacity
            style={[styles.analyzeBtn, (!selectedImage && !affiliateUrl.trim()) && styles.analyzeBtnDisabled]}
            onPress={() => {
              if (selectedImage) {
                handleAnalyzePhoto();
              } else if (affiliateUrl.trim()) {
                handlePickPhoto();
              }
            }}
            disabled={analyzing || (!selectedImage && !affiliateUrl.trim())}
            activeOpacity={0.85}
          >
            {analyzing ? (
              <Loader size={18} color="#fff" strokeWidth={2} />
            ) : (
              <ScanSearch size={18} color="#fff" strokeWidth={2} />
            )}
            <Text style={styles.analyzeBtnText}>
              {analyzing
                ? 'AI 분석 중...'
                : selectedImage
                  ? 'AI 분석 시작하기'
                  : affiliateUrl.trim()
                    ? '상품 사진을 업로드하고 AI 분석 시작하기'
                    : '제휴 링크를 먼저 연결해주세요'}
            </Text>
          </TouchableOpacity>

          {analyzeError && (
            <View style={styles.analyzeErrorBox}>
              <Text style={styles.analyzeErrorText}>{analyzeError}</Text>
            </View>
          )}

          {(completedSteps.has('analyze') || aiRecommendLoading) && (
            aiRecommendLoading ? (
              <View style={styles.aiRecommendBadge}>
                <Loader size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.aiRecommendText}>AI가 최적의 스타일을 분석하는 중...</Text>
              </View>
            ) : aiBundle ? (
              <View style={styles.aiRecommendBundleBox}>
                <View style={styles.aiRecommendBadge}>
                  <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.aiRecommendText}>
                    AI 추천: {aiBundle.templateLabel} · {aiBundle.style.cardStyle} · {aiBundle.style.duration}초
                  </Text>
                </View>
                <Text style={styles.aiRecommendDetail}>{aiBundle.summary}</Text>
                <Text style={styles.aiRecommendReason}>{aiBundle.style.reason}</Text>
              </View>
            ) : aiRecommendation ? (
              <View style={styles.aiRecommendBadge}>
                <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.aiRecommendText}>
                  AI 추천: 이 상품에는 '{aiRecommendation}' 스타일이 가장 잘 어울려요!
                </Text>
              </View>
            ) : null
          )}
        </PillNavCard>

        {/* STEP 3: Content & Template Editing */}
        <View
          ref={(ref) => { stepRefs.current[3] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<Palette size={22} color={theme.colors.warning[400]} strokeWidth={2.5} />}
          title="콘텐츠 및 템플릿 편집"
          subtitle="AI 자동 추천 · 스타일·음성·해시태그 설정 · 문구 입력"
          accentColor={theme.colors.warning[400]}
          iconBg={theme.colors.warning[500] + '22'}
          stepNumber={3}
          completed={completedSteps.has('content')}
          expanded={expandedStep === 'content'}
          onToggle={() => setExpandedStep(expandedStep === 'content' ? null : 'content')}
        >
          {/* AI one-tap auto-recommend button */}
          {lastScanId && completedSteps.has('analyze') && (
            <TouchableOpacity
              style={styles.aiOneTapBtn}
              onPress={() => router.push({ pathname: '/result/[id]', params: { id: lastScanId } })}
              activeOpacity={0.85}
            >
              <Sparkles size={20} color="#fff" strokeWidth={2} />
              <View style={styles.aiOneTapTextWrap}>
                <Text style={styles.aiOneTapBtnTitle}>AI 자동 추천으로 바로 만들기</Text>
                <Text style={styles.aiOneTapBtnSub}>
                  {aiBundle
                    ? aiBundle.summary
                    : 'AI가 최적의 스타일·음성·해시태그를 자동으로 설정했어요'}
                </Text>
              </View>
              <ChevronDown size={18} color="#fff" strokeWidth={2} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>
          )}

          {/* Collapsible custom options */}
          <TouchableOpacity
            style={styles.customToggle}
            onPress={() => setSimpleMode(!simpleMode)}
            activeOpacity={0.7}
          >
            <SettingsIcon size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.customToggleText}>
              {simpleMode ? '직접 스타일 선택하기' : '접기'}
            </Text>
            {simpleMode ? (
              <ChevronDown size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronUp size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {!simpleMode && (
            <>
              {/* AI Recommendation badge */}
              {aiRecommendation && (
                <View style={styles.aiRecommendCard}>
                  <Sparkles size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                  <View style={styles.aiRecommendCardBody}>
                    <Text style={styles.aiRecommendCardTitle}>AI 추천 스타일</Text>
                    <Text style={styles.aiRecommendCardDesc}>
                      이 상품 사진에는 '{aiRecommendation}'이(가) 가장 잘 어울립니다. 아래 버튼을 누르면 바로 적용됩니다.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.aiRecommendApplyBtn}
                    onPress={() => {
                      const match = TEMPLATE_STYLES.find((t) => aiRecommendation?.includes(t.label));
                      if (match) setSelectedTemplate(match.key);
                    }}
                    activeOpacity={0.7}
                  >
                    <Check size={14} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.aiRecommendApplyBtnText}>적용</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Template style selection */}
              <Text style={styles.sectionLabel}>템플릿 스타일</Text>
              <View style={styles.templateRow}>
            {TEMPLATE_STYLES.map((t) => {
              const Icon = t.icon;
              const isActive = selectedTemplate === t.key;
              const isRecommended = aiRecommendation?.includes(t.label);
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.templateChip, isActive && { borderColor: theme.colors.warning[400], backgroundColor: theme.colors.warning[400] + '15' }]}
                  onPress={() => setSelectedTemplate(t.key)}
                  activeOpacity={0.7}
                >
                  <Icon size={16} color={isActive ? theme.colors.warning[400] : theme.colors.dark.textDim} strokeWidth={2} />
                  <View style={styles.templateTextWrap}>
                    <Text style={[styles.templateChipLabel, isActive && { color: theme.colors.warning[400] }]}>{t.label}</Text>
                    <Text style={styles.templateChipDesc}>{t.desc}</Text>
                  </View>
                  {isRecommended && (
                    <View style={styles.recommendBadge}>
                      <Sparkles size={9} color="#fff" strokeWidth={2.5} />
                      <Text style={styles.recommendBadgeText}>추천</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

              {/* Content type selection */}
              <Text style={styles.sectionLabel}>콘텐츠 유형</Text>
              <View style={styles.contentTypeRow}>
                {CONTENT_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isActive = contentType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.contentTypeChip, isActive && { borderColor: t.color, backgroundColor: t.color + '15' }]}
                      onPress={() => setContentType(t.key)}
                      activeOpacity={0.7}
                    >
                      <Icon size={14} color={t.color} strokeWidth={2} />
                      <Text style={[styles.contentTypeText, isActive && { color: t.color }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.contentHint}>
                {CONTENT_TYPES.find((t) => t.key === contentType)?.hint}
              </Text>
            </>
          )}

          <TextInput
            style={styles.contentInput}
            value={contentText}
            onChangeText={setContentText}
            placeholder={simpleMode ? "마케팅 문구를 자유롭게 적어보세요..." : "여기에 마케팅 문구를 입력하세요..."}
            placeholderTextColor={theme.colors.dark.textFaint}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.contentActionRow}>
            <TouchableOpacity
              style={styles.contentSaveBtn}
              onPress={handleSaveContent}
              activeOpacity={0.7}
              disabled={!contentText.trim()}
            >
              <Check size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.contentSaveBtnText}>소재 저장</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contentTemplateBtn}
              onPress={() => router.push('/affiliate/assets')}
              activeOpacity={0.7}
            >
              <FileText size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.contentTemplateBtnText}>보관함 보기</Text>
            </TouchableOpacity>
          </View>
        </PillNavCard>

        {/* STEP 4: Platform Upload */}
        <View
          ref={(ref) => { stepRefs.current[4] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<Share2 size={22} color={theme.colors.success[400]} strokeWidth={2.5} />}
          title="플랫폼 업로드 및 공정위 문구"
          subtitle="릴스·쇼츠·틱톡·블로그 업로드 · 공정위 문구 자동 추가"
          accentColor={theme.colors.success[400]}
          iconBg={theme.colors.success[500] + '22'}
          stepNumber={4}
          completed={completedSteps.has('upload')}
          expanded={expandedStep === 'upload'}
          onToggle={() => setExpandedStep(expandedStep === 'upload' ? null : 'upload')}
        >
          {/* Link summary */}
          {affiliateUrl.trim() ? (
            <View style={styles.linkSummaryBox}>
              <Link2 size={16} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.linkSummaryText} numberOfLines={2}>{affiliateUrl}</Text>
            </View>
          ) : (
            <View style={styles.linkEmptyBox}>
              <Text style={styles.linkEmptyText}>1단계에서 제휴 링크를 먼저 입력해주세요</Text>
            </View>
          )}

          {affiliateUrl.trim() && (
            <ShortLinkCopyBar url={affiliateUrl.trim()} label="제휴 단축 링크" />
          )}

          <Text style={styles.uploadHint}>
            업로드할 플랫폼을 선택하세요. 각 플랫폼에 맞는 형식으로 자동 변환됩니다.
          </Text>

          {/* Auto-disclosure toggle */}
          <TouchableOpacity
            style={styles.disclosureToggleRow}
            onPress={() => setAutoDisclosure(!autoDisclosure)}
            activeOpacity={0.7}
          >
            <View style={styles.disclosureToggleInfo}>
              <ShieldCheck size={16} color={theme.colors.success[400]} strokeWidth={2} />
              <View style={styles.disclosureToggleTextWrap}>
                <Text style={styles.disclosureToggleTitle}>공정위 문구 자동 추가</Text>
                <Text style={styles.disclosureToggleDesc}>
                  업로드 시 제휴 문구가 자동으로 포함됩니다. 위치는 아래에서 선택하세요.
                </Text>
              </View>
            </View>
            <View style={[styles.toggleSwitch, autoDisclosure && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, autoDisclosure && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Disclosure placement selector */}
          {autoDisclosure && (
            <View style={styles.disclosurePlacementRow}>
              <TouchableOpacity
                style={[styles.placementBtn, disclosurePlacement === 'body' && styles.placementBtnActive]}
                onPress={() => setDisclosurePlacement('body')}
                activeOpacity={0.7}
              >
                <FileText size={12} color={disclosurePlacement === 'body' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={[styles.placementBtnText, disclosurePlacement === 'body' && styles.placementBtnTextActive]}>본문에 포함</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.placementBtn, disclosurePlacement === 'comment' && styles.placementBtnActive]}
                onPress={() => setDisclosurePlacement('comment')}
                activeOpacity={0.7}
              >
                <MessageSquare size={12} color={disclosurePlacement === 'comment' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={[styles.placementBtnText, disclosurePlacement === 'comment' && styles.placementBtnTextActive]}>댓글로 복사</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Caption preview with disclosure */}
          {autoDisclosure && disclosureText && (contentText || affiliateUrl).trim() && (
            <View style={styles.captionPreviewBox}>
              <Text style={styles.captionPreviewLabel}>기본 캡션 미리보기</Text>
              {disclosurePlacement === 'body' && (
                <Text style={styles.captionPreviewDisclosure}>{disclosureText}</Text>
              )}
              <Text style={styles.captionPreviewDivider}>{"─".repeat(20)}</Text>
              <Text style={styles.captionPreviewContent}>
                {contentText || '마케팅 문구를 입력하면 여기에 표시됩니다.'}
              </Text>
              {affiliateUrl.trim() && (
                <Text style={styles.captionPreviewLink}>{affiliateUrl.trim()}</Text>
              )}
              {disclosurePlacement === 'comment' && (
                <>
                  <Text style={styles.captionPreviewDivider}>{"─".repeat(20)}</Text>
                  <Text style={styles.captionPreviewLabel}>댓글용 공정위 문구 (별도 복사)</Text>
                  <Text style={styles.captionPreviewDisclosure}>{disclosureText}</Text>
                </>
              )}
            </View>
          )}

          <View style={styles.uploadGrid}>
            {UPLOAD_PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isUploaded = uploadedPlatforms.has(p.key);
              const isActive = uploadPlatform === p.key;
              const dl = getDeepLink(p.key as UploadPlatformKey);
              const tmpl = getCaptionTemplate(p.key as UploadPlatformKey);
              const built = buildPlatformCaption(
                p.key as UploadPlatformKey,
                contentText,
                affiliateUrl,
                selectedPlatform ? [selectedPlatform] : [],
                autoDisclosure,
                disclosurePlacement,
              );
              return (
                <View key={p.key} style={[styles.uploadCardWrap, isActive && { borderColor: p.color }]}>
                  <TouchableOpacity
                    style={[styles.uploadCard, isUploaded && { borderColor: p.color, backgroundColor: p.color + '12' }]}
                    onPress={() => handleUploadToPlatform(p.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.uploadIcon, { backgroundColor: p.color + '20' }]}>
                      <Icon size={22} color={p.color} strokeWidth={2} />
                    </View>
                    <Text style={styles.uploadLabel}>{p.label}</Text>
                    {isUploaded ? (
                      <View style={[styles.uploadDoneBadge, { backgroundColor: p.color }]}>
                        <Check size={10} color="#fff" strokeWidth={2.5} />
                        <Text style={styles.uploadDoneText}>완료</Text>
                      </View>
                    ) : (
                      <Text style={styles.uploadBtn}>업로드</Text>
                    )}
                  </TouchableOpacity>

                  {/* One-Tap Copy & Open — copies full script to clipboard then opens the app */}
                  <TouchableOpacity
                    style={[styles.oneTapBtn, { backgroundColor: p.color + '15', borderColor: p.color + '60' }]}
                    onPress={() => handleOneTapCopyAndOpen(p.key)}
                    activeOpacity={0.7}
                  >
                    {copyFeedback === p.key ? (
                      <Check size={12} color={p.color} strokeWidth={2.5} />
                    ) : (
                      <Copy size={12} color={p.color} strokeWidth={2} />
                    )}
                    <Text style={[styles.oneTapBtnText, { color: p.color }]}>
                      {copyFeedback === p.key ? '복사 완료! 앱 열기...' : '원탭 복사 & 앱 열기'}
                    </Text>
                  </TouchableOpacity>

                  {/* Deep link button — opens the platform app directly */}
                  <TouchableOpacity
                    style={[styles.deepLinkBtn, { borderColor: p.color + '40' }]}
                    onPress={() => handleOpenDeepLink(p.key)}
                    activeOpacity={0.7}
                  >
                    <ExternalLink size={12} color={p.color} strokeWidth={2} />
                    <Text style={[styles.deepLinkBtnText, { color: p.color }]}>
                      {deepLinkFeedback === p.key ? '앱 여는 중...' : dl.label}
                    </Text>
                  </TouchableOpacity>

                  {/* Caption style description */}
                  <Text style={styles.captionStyleDesc}>{tmpl.captionStyle}</Text>

                  {/* Platform-specific hashtags */}
                  <Text style={styles.platformHashtags} numberOfLines={1}>
                    {tmpl.hashtagSet.join(' ')}
                  </Text>

                  {/* Comment disclosure copy button — only when placement is 'comment' */}
                  {disclosurePlacement === 'comment' && built.commentText && (
                    <TouchableOpacity
                      style={styles.commentCopyBtn}
                      onPress={async () => {
                        try {
                          if (Platform.OS === 'web') {
                            await navigator.clipboard.writeText(built.commentText);
                          } else {
                            const { default: Clipboard } = await import('expo-clipboard');
                            await Clipboard.setStringAsync(built.commentText);
                          }
                        } catch {
                          // clipboard failed
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <MessageSquare size={10} color={theme.colors.dark.textDim} strokeWidth={2} />
                      <Text style={styles.commentCopyText}>댓글용 문구 복사</Text>
                    </TouchableOpacity>
                  )}

                  {/* Mark as uploaded — manual tracking */}
                  {!isUploaded && (
                    <TouchableOpacity
                      style={styles.markUploadedBtn}
                      onPress={() => handleMarkUploaded(p.key)}
                      activeOpacity={0.7}
                    >
                      <Check size={11} color={theme.colors.success[400]} strokeWidth={2.5} />
                      <Text style={styles.markUploadedText}>업로드 완료로 표시</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Per-platform algorithm-aware caption optimizer */}
          <Text style={styles.optimizerSectionTitle}>플랫폼별 알고리즘 최적화 캡션</Text>
          <Text style={styles.optimizerSectionDesc}>
            각 플랫폼의 추천 알고리즘과 UX에 맞춰 제목, 본문, 해시태그, 공정위 문구 배치를 자동 최적화합니다. 섹션별로 복사할 수 있습니다.
          </Text>
          {UPLOAD_PLATFORMS.map((p) => (
            <PlatformCaptionOptimizer
              key={p.key}
              platformKey={p.key as UploadPlatformKey}
              platformLabel={p.label}
              platformColor={p.color}
              contentText={contentText}
              affiliateUrl={affiliateUrl}
              disclosurePlatforms={selectedPlatform ? [selectedPlatform] : []}
              autoDisclosure={autoDisclosure}
              disclosurePlacement={disclosurePlacement}
              isActive={uploadPlatform === p.key}
              onCopy={handleCopyText}
            />
          ))}

          {/* Upload checklist */}
          {uploadedPlatforms.size > 0 && (
            <View style={styles.uploadChecklistBox}>
              <Text style={styles.uploadChecklistTitle}>업로드 체크리스트</Text>
              {UPLOAD_PLATFORMS.filter((p) => uploadedPlatforms.has(p.key)).map((p) => {
                const Icon = p.icon;
                return (
                  <View key={p.key} style={styles.checklistItem}>
                    <View style={[styles.checklistIcon, { backgroundColor: p.color + '20' }]}>
                      <Icon size={12} color={p.color} strokeWidth={2} />
                    </View>
                    <Text style={styles.checklistLabel}>{p.label}</Text>
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                  </View>
                );
              })}
              <Text style={styles.checklistHint}>
                제작물 탭에서 해당 콘텐츠의 발행 상태가 '업로드 완료'로 표시됩니다.
              </Text>
            </View>
          )}

          {uploadPlatform && uploadedPlatforms.has(uploadPlatform) && (
            <View style={styles.uploadSuccessBox}>
              <Check size={16} color={theme.colors.success[400]} strokeWidth={2} />
              <Text style={styles.uploadSuccessText}>
                {UPLOAD_PLATFORMS.find((p) => p.key === uploadPlatform)?.label}에 업로드가 완료되었습니다. 제휴 링크를 통해 수익이 발생하면 '분석' 탭에서 확인할 수 있습니다.
              </Text>
            </View>
          )}
        </PillNavCard>

        <TouchableOpacity
          style={styles.marketingCtaButton}
          onPress={() => { setItem('marketing_handoff', 'true'); router.push('/marketing' as never); }}
          activeOpacity={0.85}
        >
          <View style={styles.marketingCtaIcon}>
            <Flame size={28} color={theme.colors.warning[400]} strokeWidth={2.5} />
          </View>
          <View style={styles.marketingCtaTextWrap}>
            <Text style={styles.marketingCtaTitle}>이 소재로 마케팅 숏폼 만들기</Text>
            <Text style={styles.marketingCtaDesc}>
              훅 선택 · 템플릿 · 카피 · TTS까지 한 번에
            </Text>
          </View>
          <ArrowRight size={20} color={theme.colors.warning[400]} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Global Localization — multilingual caption & TTS translation */}
        {(contentText || productMeta?.productName) && (
          <View style={styles.globalLocalizerWrap}>
            <GlobalLocalizer
              hook={contentText.slice(0, 100) || productMeta?.productName || ''}
              title={productMeta?.productName || ''}
              caption={contentText || ''}
              hashtags={[]}
              productName={productMeta?.productName || ''}
              productCategory={productMeta?.description || ''}
              narrationText={contentText.slice(0, 200)}
              affiliateUrl={affiliateUrl}
            />
          </View>
        )}

        {/* Recent revenue */}
        <Text style={styles.sectionTitle}>최근 수익 기록</Text>
        {revenue.length === 0 ? (
          <View style={styles.emptyRevenue}>
            <TrendingUp size={40} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
            <Text style={styles.emptyRevenueTitle}>아직 수익 기록이 없습니다</Text>
            <Text style={styles.emptyRevenueDesc}>
              제휴 링크를 공유하고 수익이 발생하면 여기에 표시됩니다
            </Text>
          </View>
        ) : (
          <View style={styles.revenueList}>
            {revenue.slice(0, 5).map((r) => (
              <View key={r.id} style={styles.revenueItem}>
                <View style={styles.revenueItemLeft}>
                  <Store size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <View>
                    <Text style={styles.revenuePlatform}>{r.platform}</Text>
                    {r.note ? <Text style={styles.revenueNote} numberOfLines={1}>{r.note}</Text> : null}
                  </View>
                </View>
                <Text style={styles.revenueAmount}>{(r.amount ?? 0).toLocaleString('ko-KR')}원</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tip */}
        <View style={styles.tipBox}>
          <ShoppingBag size={16} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.tipText}>
            팁: 카메라 탭에서 촬영 후 결과 화면의 '쇼핑커넥트'에서도 제휴 링크를 바로 추가할 수 있습니다. 정기적으로 콘텐츠를 올리면 노출이 늘어납니다.
          </Text>
        </View>
        </>
        )}
      </ScrollView>

      {/* CapturePreviewModal — same as camera tab */}
      {previewCapture && (
        <CapturePreviewModal
          visible={!!previewCapture}
          imageBase64={previewCapture.base64}
          mimeType={previewCapture.mimeType}
          onConfirm={handlePreviewConfirm}
          onRetake={handlePreviewRetake}
        />
      )}

      {/* Upload preview modal */}
      <UploadPreviewModal
        visible={!!previewUpload}
        data={previewUpload}
        onConfirm={handleConfirmUpload}
        onClose={() => setPreviewUpload(null)}
      />

      {/* URL validation toast */}
      {urlToast && (
        <View style={styles.urlToastContainer}>
          <View style={styles.urlToastBox}>
            <AlertTriangle size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.urlToastText}>{urlToast}</Text>
          </View>
        </View>
      )}

      {/* Upload completion confirm popup — shown after returning from platform app */}
      {showUploadConfirm && (
        <View style={styles.uploadConfirmOverlay}>
          <View style={styles.uploadConfirmModal}>
            <View style={styles.uploadConfirmIcon}>
              <Check size={28} color={theme.colors.success[400]} strokeWidth={2} />
            </View>
            <Text style={styles.uploadConfirmTitle}>업로드를 완료하셨나요?</Text>
            <Text style={styles.uploadConfirmDesc}>
              {UPLOAD_PLATFORMS.find((p) => p.key === showUploadConfirm)?.label}에 업로드를 마치셨다면 '완료'를 눌러 발행 상태를 기록하세요. 클릭 수와 제휴 전환 수수료가 자동으로 추적됩니다.
            </Text>
            <View style={styles.uploadConfirmBtnRow}>
              <TouchableOpacity
                style={styles.uploadConfirmCancelBtn}
                onPress={handleCancelUploadConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.uploadConfirmCancelText}>아직이에요</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadConfirmDoneBtn}
                onPress={handleConfirmUploadComplete}
                activeOpacity={0.7}
              >
                <Check size={14} color="#fff" strokeWidth={2.5} />
                <Text style={styles.uploadConfirmDoneText}>업로드 완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function PlatformListSection({
  platforms,
  isConfigured,
  copiedPlatform,
  onOpenUrl,
  onCopySignup,
  customPlatforms,
  onAddCustomPlatform,
  onRemoveCustomPlatform,
  onSelectCustomPlatform,
  selectedPlatform,
}: {
  platforms: typeof PLATFORMS;
  isConfigured: (key: string) => boolean;
  copiedPlatform: string | null;
  onOpenUrl: (url: string) => void;
  onCopySignup: (platform: string, url: string) => void;
  customPlatforms: { key: string; label: string; url: string }[];
  onAddCustomPlatform: (name: string, url: string) => void;
  onRemoveCustomPlatform: (key: string) => void;
  onSelectCustomPlatform: (key: string, url: string) => void;
  selectedPlatform: string;
}) {
  const [showAddBox, setShowAddBox] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    onAddCustomPlatform(newName.trim(), newUrl.trim());
    setNewName('');
    setNewUrl('');
    setShowAddBox(false);
  };

  return (
    <View>
      {platforms.map((p) => {
        const Icon = p.icon;
        const configured = isConfigured(p.key);
        return (
          <View key={p.key} style={styles.platformRow}>
            <View style={[styles.platformIcon, { backgroundColor: p.color + '20' }]}>
              <Icon size={18} color={p.color} strokeWidth={2} />
            </View>
            <View style={styles.platformInfo}>
              <View style={styles.platformTitleRow}>
                <Text style={styles.platformLabel}>{p.label}</Text>
                {configured ? (
                  <View style={styles.configuredBadge}>
                    <Check size={10} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.configuredBadgeText}>설정됨</Text>
                  </View>
                ) : (
                  <View style={styles.unconfiguredBadge}>
                    <Text style={styles.unconfiguredBadgeText}>미설정</Text>
                  </View>
                )}
              </View>
              <Text style={styles.platformDesc}>{p.desc}</Text>
            </View>
            <View style={styles.platformActions}>
              <TouchableOpacity onPress={() => onOpenUrl(p.signupUrl)} activeOpacity={0.7}>
                <ExternalLink size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onCopySignup(p.key, p.signupUrl)} activeOpacity={0.7}>
                {copiedPlatform === p.key ? (
                  <Check size={16} color={theme.colors.success[400]} strokeWidth={2} />
                ) : (
                  <Copy size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {customPlatforms.map((cp) => {
        const isActive = selectedPlatform === cp.key;
        return (
          <View key={cp.key} style={styles.platformRow}>
            <View style={[styles.platformIcon, { backgroundColor: theme.colors.accent[400] + '20' }]}>
              <Link2 size={18} color={theme.colors.accent[300]} strokeWidth={2} />
            </View>
            <View style={styles.platformInfo}>
              <View style={styles.platformTitleRow}>
                <Text style={styles.platformLabel}>{cp.label}</Text>
                {isActive ? (
                  <View style={styles.configuredBadge}>
                    <Check size={10} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.configuredBadgeText}>선택됨</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.platformDesc} numberOfLines={1}>{cp.url}</Text>
            </View>
            <View style={styles.platformActions}>
              <TouchableOpacity onPress={() => onSelectCustomPlatform(cp.key, cp.url)} activeOpacity={0.7}>
                <ExternalLink size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onRemoveCustomPlatform(cp.key)} activeOpacity={0.7}>
                <X size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {showAddBox ? (
        <View style={styles.addPlatformBox}>
          <View style={styles.addPlatformHeader}>
            <Text style={styles.addPlatformTitle}>제휴플랫폼 수동 추가</Text>
            <TouchableOpacity onPress={() => { setShowAddBox(false); setNewName(''); setNewUrl(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.addPlatformInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="플랫폼 이름 (예: 11번가)"
            placeholderTextColor={theme.colors.dark.textFaint}
          />
          <TextInput
            style={styles.addPlatformInput}
            value={newUrl}
            onChangeText={setNewUrl}
            placeholder="제휴 링크 URL"
            placeholderTextColor={theme.colors.dark.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.addPlatformConfirmBtn, (!newName.trim() || !newUrl.trim()) && styles.addPlatformConfirmBtnDisabled]}
            onPress={handleAdd}
            activeOpacity={0.7}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            <Check size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.addPlatformConfirmBtnText}>추가하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.manualAddBtn}
          onPress={() => setShowAddBox(true)}
          activeOpacity={0.7}
        >
          <Plus size={16} color={theme.colors.accent[300]} strokeWidth={2} />
          <Text style={styles.manualAddBtnText}>제휴플랫폼 수동 추가하기</Text>
        </TouchableOpacity>
      )}
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
  verticalHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 4,
  },
  verticalTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  verticalSubtitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: theme.spacing.md,
  },
  mediaPreviewWrap: {
    position: 'relative',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    aspectRatio: 1.2,
    backgroundColor: '#000',
    marginBottom: theme.spacing.sm,
  },
  mediaPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  imageSourceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  imageSourceBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '40',
    marginBottom: theme.spacing.md,
  },
  mediaBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
    marginBottom: theme.spacing.sm,
    ...theme.shadows.elevated,
  },
  analyzeBtnDisabled: {
    opacity: 0.4,
  },
  analyzeBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  analyzeErrorBox: {
    backgroundColor: theme.colors.error[500] + '20',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  analyzeErrorText: {
    color: theme.colors.error[400],
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 17,
  },
  addPlatformBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '30',
  },
  addPlatformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  addPlatformTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  addPlatformInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    marginBottom: 8,
  },
  addPlatformConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  addPlatformConfirmBtnDisabled: {
    opacity: 0.4,
  },
  addPlatformConfirmBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  affiliateInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.sm,
    minHeight: 60,
  },
  affiliateActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  affiliateSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  affiliateSaveBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  affiliateSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  affiliateSettingsBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  platformListLabel: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  aiRecommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '30',
  },
  aiRecommendText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
    lineHeight: 17,
  },
  aiRecommendBundleBox: {
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '30',
    gap: 6,
  },
  aiRecommendDetail: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
    lineHeight: 16,
  },
  aiRecommendReason: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  aiOneTapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: theme.spacing.md + 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500],
    marginBottom: theme.spacing.sm,
    ...theme.shadows.card,
  },
  aiOneTapTextWrap: {
    flex: 1,
  },
  aiOneTapBtnTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  aiOneTapBtnSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#fff' + 'CC',
    marginTop: 3,
    lineHeight: 15,
  },
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
  },
  customToggleText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  analyzeWaitingBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md + 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  videoPreviewWrap: {
    position: 'relative',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    aspectRatio: 9 / 16,
    maxHeight: 380,
    marginBottom: theme.spacing.md,
    backgroundColor: '#000',
  },
  videoPreviewThumb: {
    flex: 1,
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  videoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  videoSpecBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,15,30,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  videoSpecBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  videoTimelineBar: {
    position: 'absolute',
    bottom: 28,
    left: 12,
    right: 12,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  videoTimelineProgress: {
    width: '35%',
    height: '100%',
    backgroundColor: theme.colors.success[400],
    borderRadius: 2,
  },
  videoTimelineLabels: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoTimelineLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  videoPreviewPlaceholderBg: {
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  videoPreviewEmptyInline: {
    alignItems: 'center',
    gap: 8,
    padding: theme.spacing.lg,
  },
  videoPreviewEmptyInlineText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 17,
  },
  videoPreviewEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: theme.spacing.lg,
  },
  videoPreviewEmptyText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 17,
  },
  videoPreviewGenWrap: {
    alignItems: 'center',
    gap: 10,
  },
  videoPreviewGenText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  videoSceneWrap: {
    alignItems: 'center',
    gap: 4,
  },
  videoSceneBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    backgroundColor: 'rgba(10,15,30,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  videoStoryboardWrap: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  videoStoryboardTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    marginBottom: 2,
  },
  videoStoryboardDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  videoSceneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.border,
  },
  videoSceneTimeBadge: {
    backgroundColor: theme.colors.success[500] + '22',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 38,
    alignItems: 'center',
  },
  videoSceneTimeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  videoSceneHookText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  videoSceneDescText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 14,
  },
  videoSceneNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.success[500] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoSceneNumberText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  renderVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.success[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  renderVideoBtnDisabled: {
    opacity: 0.6,
  },
  renderVideoBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  renderProgressBarWrap: {
    height: 4,
    backgroundColor: theme.colors.dark.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  renderProgressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success[400],
    borderRadius: 2,
  },
  renderCompleteBox: {
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm + 2,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.success[500] + '40',
  },
  renderCompleteText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 16,
  },
  analyzeWaitingText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
  },
  aiToolDivider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: theme.spacing.md,
  },
  aiToolSectionLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 4,
  },
  aiToolSectionDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  aiGeneratedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400] + '60',
  },
  aiGeneratedNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 15,
  },
  aiRecommendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '30',
  },
  aiRecommendCardBody: {
    flex: 1,
  },
  aiRecommendCardTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  aiRecommendCardDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
    lineHeight: 16,
  },
  aiRecommendApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[500],
  },
  aiRecommendApplyBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    alignItems: 'center',
  },
  modeToggleBtnActive: {
    borderColor: theme.colors.warning[400],
    backgroundColor: theme.colors.warning[400] + '15',
  },
  modeToggleText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  modeToggleTextActive: {
    color: theme.colors.warning[400],
    fontFamily: theme.typography.fontFamily.bold,
  },
  simpleModeHintBox: {
    backgroundColor: theme.colors.warning[500] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning[400] + '60',
  },
  simpleModeHintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.warning[500],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  recommendBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  extractErrorBox: {
    backgroundColor: theme.colors.error[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400] + '60',
  },
  extractErrorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 17,
    marginBottom: 8,
  },
  extractErrorActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  extractRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.error[500] + '18',
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '40',
  },
  extractRetryBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  extractManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  extractManualBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  urlToastContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  urlToastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.full,
    ...theme.shadows.elevated,
  },
  urlToastText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  urlWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning[400] + '60',
  },
  urlWarningText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    lineHeight: 15,
  },
  productMetaCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  productMetaImage: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  productMetaInfo: {
    flex: 1,
    gap: 2,
  },
  productMetaName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  productMetaPrice: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
  },
  productMetaBrand: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  productMetaDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
    marginTop: 2,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  platformIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  platformDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  platformActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  configuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  configuredBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  unconfiguredBadge: {
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  unconfiguredBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  manualAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '12',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
    borderStyle: 'dashed',
  },
  manualAddBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: theme.spacing.sm,
  },
  templateRow: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  templateTextWrap: {
    flex: 1,
  },
  templateChipLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  templateChipDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  contentTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  contentTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  contentTypeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  contentHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
    lineHeight: 17,
  },
  contentInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    minHeight: 80,
    marginBottom: theme.spacing.sm,
  },
  contentActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contentSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
  },
  comicShortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
    marginBottom: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  comicShortBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  contentSaveBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  contentTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  contentTemplateBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  linkSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
  },
  linkSummaryText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[300],
  },
  affiliateUrlInputWrap: {
    marginBottom: theme.spacing.md,
  },
  affiliateUrlInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  affiliateUrlInputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    height: 46,
  },
  affiliateUrlInputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  affiliateUrlInput: {
    flex: 1,
    paddingLeft: 36,
    paddingRight: 12,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  affiliateUrlConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    height: 46,
  },
  affiliateUrlConnectBtnDisabled: {
    opacity: 0.4,
  },
  affiliateUrlConnectBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  linkEmptyBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  linkEmptyText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  uploadHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
    marginBottom: theme.spacing.sm,
  },
  uploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uploadCard: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 6,
  },
  uploadBtn: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  platformSelectBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  manualPlatformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: 8,
  },
  manualPlatformLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  manualPlatformInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  manualPlatformInput: {
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  manualPlatformAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  manualPlatformAddBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  platformSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  platformSummaryText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  boardListWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  boardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  boardChipActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  boardChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  boardChipTextActive: {
    color: '#fff',
  },
  viralAnalysisBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '30',
  },
  viralAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.sm + 2,
  },
  viralAnalysisIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.warning[400] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viralAnalysisTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  viralAnalysisSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  viralLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: theme.spacing.sm + 2,
  },
  viralLoadingText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
    flex: 1,
  },
  viralResultWrap: {
    gap: 10,
  },
  viralSpecRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  viralSpecChip: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  viralSpecLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  viralSpecValue: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: 1,
  },
  viralRefBox: {
    backgroundColor: theme.colors.warning[400] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '25',
  },
  viralRefTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 8,
  },
  viralRefStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viralRefStat: {
    flex: 1,
  },
  viralRefStatValue: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  viralRefStatLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  viralRefDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.dark.border,
  },
  viralHooksLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: 4,
  },
  viralHookRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  viralHookNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.warning[400],
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  viralHookNumberText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  viralHookTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  viralHookDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  viralPreviewBtnWrap: {
    marginTop: theme.spacing.sm,
  },
  viralPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  viralPreviewBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  viralStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '60',
    backgroundColor: theme.colors.warning[400] + '10',
  },
  viralStartBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
    flex: 1,
  },
  uploadDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  uploadDoneText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  uploadSuccessBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginTop: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400] + '60',
  },
  uploadSuccessText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    lineHeight: 17,
  },
  disclosureToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  disclosureToggleInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  disclosureToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  disclosureToggleTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  disclosureToggleDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  toggleSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.dark.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.success[500],
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  captionPreviewBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: 6,
  },
  captionPreviewLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 2,
  },
  captionPreviewDisclosure: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    lineHeight: 16,
  },
  captionPreviewDivider: {
    fontSize: 10,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
  },
  captionPreviewContent: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  captionPreviewLink: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[400],
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  globalLocalizerWrap: {
    marginBottom: theme.spacing.md,
  },
  emptyRevenue: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: 8,
  },
  emptyRevenueTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  emptyRevenueDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
    lineHeight: 17,
  },
  revenueList: {
    gap: 6,
  },
  revenueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.glass.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  revenueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  revenuePlatform: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  revenueNote: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  revenueAmount: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[300],
    lineHeight: 17,
  },
  uploadCardWrap: {
    width: '48%',
    gap: 4,
  },
  oneTapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: theme.radius.sm,
    paddingVertical: 7,
    borderWidth: 1.5,
    marginTop: 4,
  },
  oneTapBtnText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  disclosurePlacementRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  placementBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  placementBtnActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  placementBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  placementBtnTextActive: {
    color: '#fff',
  },
  commentCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 5,
    marginTop: 3,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  commentCopyText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  uploadConfirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadConfirmModal: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg + 4,
    marginHorizontal: theme.spacing.lg + 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  uploadConfirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.success[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  uploadConfirmTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 6,
  },
  uploadConfirmDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: theme.spacing.md,
  },
  uploadConfirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadConfirmCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  uploadConfirmCancelText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  uploadConfirmDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  uploadConfirmDoneText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  deepLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  deepLinkBtnText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
  },
  captionStyleDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
    marginTop: 2,
  },
  platformHashtags: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  markUploadedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 5,
    marginTop: 4,
  },
  markUploadedText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
  platformCaptionPreviewBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: 6,
  },
  platformCaptionPreviewLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  platformCaptionStyleHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 14,
  },
  platformCaptionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 16,
  },
  optimizerSectionTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.md,
    marginBottom: 2,
  },
  optimizerSectionDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  uploadChecklistBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.success[500] + '30',
    gap: 8,
  },
  uploadChecklistTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistIcon: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  checklistHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
    marginTop: 2,
  },
  marketingCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.lg,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: theme.colors.warning[400] + '40',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  marketingCtaIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500] + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketingCtaTextWrap: {
    flex: 1,
    gap: 3,
  },
  marketingCtaTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  marketingCtaDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
