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
import { ShoppingBag, Send, Globe, Store, ExternalLink, Settings as SettingsIcon, TrendingUp, Link2, Copy, Check, Camera, Image as ImageIcon, Film, Sparkles, FileText, Hash, Type, Youtube, ChevronDown, ChevronUp, Loader, Plus, X, ScanSearch, Palette, Share2, ShieldCheck, TriangleAlert as AlertTriangle, ArrowRight, RefreshCw, Music2, Play, Clapperboard, Download, Video, PenLine } from 'lucide-react-native';
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
import { saveManualScan, uploadImage, analyzeImage, analyzeImageWithProductContext, extractProductMeta, updateScanWithAnalysis } from '@/lib/analysis';
import { validateAffiliateUrl } from '@/lib/affiliate';
import { friendlyError } from '@/lib/errors';
import { getDisclosureForPlatforms } from '@/lib/disclosure';
import { fetchAiRecommendBundle, type AiRecommendBundle } from '@/lib/aiRecommend';
import { TTS_VOICES, VOICE_CATEGORIES, type VoiceCategory } from '@/lib/ttsVoices';
import { getDeepLink, getCaptionTemplate, buildPlatformCaption, type UploadPlatformKey, type DisclosurePlacement } from '@/lib/platformUpload';
import { PlatformCaptionOptimizer } from '@/components/PlatformCaptionOptimizer';
import { generatePsychAnalysis, type PsychAnalysis, type PsychScene } from '@/lib/psychologyEngine';
import { GlobalLocalizer } from '@/components/GlobalLocalizer';
import { StockVideoPicker } from '@/components/StockVideoPicker';
import { VideoEditPlanCard } from '@/components/VideoEditPlanCard';
import { VideoRenderCard } from '@/components/VideoRenderCard';
import type { StockVideoClip } from '@/lib/pexelsVideo';
import type { EditPlan } from '@/lib/videoEditPlan';
import { MessageSquare } from 'lucide-react-native';
import type { UserSettings, RevenueRecord } from '@/types/database';

const PLATFORMS = [
  { key: 'Coupang', label: '쿠팡 파트너스', icon: ShoppingBag, color: '#FF3E3E', signupUrl: 'https://partners.coupang.com/', desc: '쿠팡 상품 링크를 공유하고 수수료를 받으세요' },
  { key: 'Toss', label: '토스 쉐어링크', icon: Send, color: '#0064FF', signupUrl: 'https://sharelink.toss.im/', desc: '토스로 링크를 공유하고 보상을 받으세요' },
  { key: 'BrandConnect', label: '네이버 브랜드커넥트', icon: Globe, color: '#03C75A', signupUrl: 'https://brandconnect.naver.com/about/creator', desc: '네이버 쇼핑 제휴 링크를 발급받으세요' },
] as const;

const UPLOAD_PLATFORMS = [
  { key: 'instagram', label: '인스타그램', icon: Camera, color: '#E1306C' },
  { key: 'youtube', label: '유튜브', icon: Youtube, color: '#FF0000' },
  { key: 'tiktok', label: '틱톡', icon: Music2, color: '#000000' },
  { key: 'naver_clip', label: '네이버 클립', icon: Video, color: '#03C75A' },
  { key: 'blog', label: '네이버 블로그', icon: FileText, color: '#03C75A' },
  { key: 'pinterest', label: '핀터레스트', icon: ImageIcon, color: '#E60023' },
  { key: 'twitter', label: '트위터/스레드', icon: Hash, color: '#1DA1F2' },
] as const;

const PLATFORM_BOARDS: Record<string, { key: string; label: string; desc: string }[]> = {
  instagram: [
    { key: 'reels', label: '릴스', desc: '트렌디한 숏폼 중심. 음악, 시각적 효과, 2030 타겟 유입에 최적화된 세로형 영상' },
    { key: 'feed', label: '피드 게시물', desc: '이미지와 텍스트 중심. 미학적 큐레이션과 카드뉴스에 적합' },
    { key: 'story', label: '스토리', desc: '24시간 소멸형 콘텐츠. 긴박감과 희소성으로 즉각적 반응 유도' },
  ],
  youtube: [
    { key: 'shorts', label: '쇼츠', desc: '검색 유입과 알고리즘 추천이 강력한 숏폼. 롱텀 조회수와 구독자 확보에 유리' },
    { key: 'community', label: '커뮤니티 탭', desc: '이미지와 텍스트 투표 등 피드형. 구독자와 직접 소통하며 가볍게 제안' },
    { key: 'video', label: '일반 영상', desc: '긴 호흡의 정보 전달. 3막 구조(문제-해결-결과)로 신뢰 구축' },
  ],
  tiktok: [
    { key: 'video', label: '틱톡 영상', desc: '바이럴 확산 속도가 가장 빠른 숏폼. 챌린지와 밈 기반 대중적 노출에 최적화' },
    { key: 'carousel', label: '캐러셀', desc: '여러 장 이미지 슬라이드. 정보성 카드뉴스나 전후 비교(Before & After) 콘텐츠에 적합' },
    { key: 'story', label: '스토리', desc: '24시간 소멸형 숏폼. 긴박감으로 즉각적 반응 유도' },
  ],
  naver_clip: [
    { key: 'clip', label: '네이버 클립', desc: '네이버 블로그·검색·NOW 등 생태계와 연동되는 숏폼. 국내 검색 사용자 대상 제휴 마케팅 유입에 효과적' },
  ],
  blog: [
    { key: 'category_post', label: '카테고리 포스트', desc: '상세한 리뷰와 정보성 텍스트 중심. 검색 엔진 상위 노출로 꾸준한 유기적 유입' },
    { key: 'review', label: '리뷰 글', desc: '상세한 사용 후기. 비교 분석 정보로 신뢰 구축 후 전환' },
    { key: 'promotion', label: '프로모션 글', desc: '할인·이벤트 정보 전달. 직관적인 구매 유도' },
  ],
  pinterest: [
    { key: 'pin', label: '핀', desc: '이미지와 시각적 큐레이션 중심. 인테리어, 패션, 리빙 등 구매 전환 직전 검색 유입이 매우 높음' },
    { key: 'idea_pin', label: '아이디어 핀', desc: '여러 장면이 슬라이드처럼 전환. 각 장면마다 하나의 핵심 메시지' },
    { key: 'board', label: '보드', desc: '테마별 컬렉션 구성. 큐레이션 자체가 소유 심리를 충족' },
  ],
  twitter: [
    { key: 'thread', label: '스레드', desc: '연속 트윗 구조. 정보 갭의 연속으로 끝까지 읽게 만드는 정보성 콘텐츠' },
    { key: 'tweet', label: '일반 트윗', desc: '짧고 강렬한 한 줄. 트렌드 편승으로 노출 5배 이상 증가' },
    { key: 'reply', label: '답글', desc: '기존 트윗에 대한 반응. 즉각적 도파민 루프로 참여 유도' },
  ],
};

function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('coupang.com')) return 'Coupang';
  if (u.includes('brand.naver.com')) return 'BrandConnect';
  if (u.includes('smartstore.naver.com')) return 'NaverShopping';
  if (u.includes('11st.co.kr')) return '11st';
  if (u.includes('gmarket.com')) return 'Gmarket';
  if (u.includes('aliexpress.com')) return 'AliExpress';
  if (u.includes('amazon.com')) return 'Amazon';
  if (u.includes('shopee.')) return 'Shopee';
  if (u.includes('toss.to')) return 'Toss';
  return '';
}

function buildFallbackSearchUrl(url: string, platform: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    let productId = '';
    if (platform === 'Coupang') {
      const vpIdx = segments.findIndex((s) => s === 'vp');
      if (vpIdx >= 0 && segments[vpIdx + 1]) productId = segments[vpIdx + 1];
    } else if (platform === 'NaverShopping' || platform === 'BrandConnect') {
      const pIdx = segments.findIndex((s) => s === 'products');
      if (pIdx >= 0 && segments[pIdx + 1]) productId = segments[pIdx + 1];
    } else if (platform === 'AliExpress') {
      const iIdx = segments.findIndex((s) => s.startsWith('item'));
      if (iIdx >= 0 && segments[iIdx + 1]) productId = segments[iIdx + 1];
    } else if (platform === 'Amazon') {
      const dpIdx = segments.findIndex((s) => s === 'dp');
      if (dpIdx >= 0 && segments[dpIdx + 1]) productId = segments[dpIdx + 1];
    }
    for (const seg of segments) {
      if (/^\d{6,}$/.test(seg)) { productId = seg; break; }
    }
    switch (platform) {
      case 'Coupang': return `https://www.coupang.com/np/search?q=${productId}`;
      case 'NaverShopping': case 'BrandConnect': return `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(parsed.hostname + ' ' + productId)}`;
      case 'AliExpress': return `https://www.aliexpress.com/wholesale?SearchText=${productId}`;
      case 'Amazon': return `https://www.amazon.com/s?k=${productId}`;
      case '11st': return `https://search.11st.co.kr/Search.tmall?kwd=${productId}`;
      case 'Gmarket': return `https://browse.gmarket.co.kr/search?keyword=${productId}`;
      default: return `https://www.google.com/search?q=${encodeURIComponent(parsed.hostname + ' ' + productId)}`;
    }
  } catch {
    return '';
  }
}

const BOARD_VIDEO_SPECS: Record<string, Record<string, { ratio: string; resolution: string; maxDuration: string; format: string }>> = {
  instagram: {
    reels: { ratio: '9:16', resolution: '1080×1920', maxDuration: '90초', format: 'MP4' },
    feed: { ratio: '1:1 또는 4:5', resolution: '1080×1080', maxDuration: '60초', format: 'MP4' },
    story: { ratio: '9:16', resolution: '1080×1920', maxDuration: '15초', format: 'MP4' },
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
  naver_clip: {
    clip: { ratio: '9:16', resolution: '1080×1920', maxDuration: '60초', format: 'MP4' },
  },
  blog: {
    category_post: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
    review: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
    promotion: { ratio: '16:9', resolution: '1920×1080', maxDuration: '제한 없음', format: 'MP4/YouTube 임베드' },
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

type ViralAnalysisResult = PsychAnalysis;


const CONTENT_TYPES = [
  { key: 'copy', label: '마케팅 문구', icon: Type, color: theme.colors.primary[400], hintVideo: '제품을 한 줄로 매력적으로 표현하세요', hintImage: '이미지에 어울리는 제품 문구를 작성하세요' },
  { key: 'hashtag', label: '해시태그', icon: Hash, color: theme.colors.accent[400], hintVideo: '관련 키워드를 # 과 함께 나열하세요', hintImage: '이미지 검색에 잘 걸리는 키워드를 # 과 함께 나열하세요' },
  { key: 'hook', label: '후킹 문장', icon: Sparkles, color: theme.colors.warning[400], hintVideo: '시선을 끄는 첫 문장을 만드세요', hintImage: '스크롤을 멈추게 하는 첫 문장을 만드세요' },
] as const;

const TEMPLATE_STYLES = [
  { key: 'shortform', label: '숏폼 영상', desc: '릴스·쇼츠용 임팩트', icon: Film, mediaType: 'video' as const },
  { key: 'comic', label: '웹툰형 만화', desc: '스토리텔링 만화', icon: Palette, mediaType: 'both' as const },
  { key: 'cardnews', label: '카드뉴스', desc: '정보 전달 템플릿', icon: FileText, mediaType: 'image' as const },
] as const;

function getBoardMediaType(platform: string | null, board: string | null): 'image' | 'video' {
  if (!platform || !board) return 'video';
  const specs = BOARD_VIDEO_SPECS[platform]?.[board];
  if (!specs) return 'video';
  const fmt = specs.format.toUpperCase();
  if (fmt.includes('JPG') || fmt.includes('PNG') || fmt.includes('GIF') || specs.maxDuration === '정지형') return 'image';
  return 'video';
}

type StepKey = 'affiliate' | 'platformSelect' | 'analyze' | 'content' | 'upload';

const STEP_ORDER: StepKey[] = ['affiliate', 'platformSelect', 'content', 'analyze', 'upload'];
const STEP_META: Record<StepKey, { num: number; color: string }> = {
  affiliate: { num: 1, color: theme.colors.accent[400] },
  platformSelect: { num: 2, color: theme.colors.warning[400] },
  content: { num: 3, color: theme.colors.warning[400] },
  analyze: { num: 4, color: theme.colors.success[400] },
  upload: { num: 5, color: theme.colors.success[400] },
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

  // Multi-angle images for TV commercial style video
  const [multiImages, setMultiImages] = useState<{ uri: string; mime: string }[]>([]);
  const [aiSceneImages, setAiSceneImages] = useState<string[]>([]);
  const [aiImageGenerating, setAiImageGenerating] = useState(false);

  // Step 1: Affiliate link & product selection
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
  const [videoPreviewScenes, setVideoPreviewScenes] = useState<PsychScene[] | null>(null);
  const [previewMediaMode, setPreviewMediaMode] = useState<'video' | 'image'>('video');
  const videoPreviewProgress = useSharedValue(0);
  const [videoRendering, setVideoRendering] = useState(false);
  const [videoRenderComplete, setVideoRenderComplete] = useState(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderedVideoMime, setRenderedVideoMime] = useState<string>('video/webm');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [stockVideoClip, setStockVideoClip] = useState<StockVideoClip | null>(null);
  const [videoEditPlan, setVideoEditPlan] = useState<EditPlan | null>(null);
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
    imageBase64: string;
    imageMimeType: string;
    platform: string;
    brand: string;
    searchUrl: string;
  } | null>(null);

  // Step 3: AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [aiGeneratedUrl, setAiGeneratedUrl] = useState<string | null>(null);

  const imageDataUrl = useMemo(() => {
    if (!selectedImage || mediaType !== 'photo') return '';
    if (selectedImage.startsWith('data:')) return selectedImage;
    return buildDataUrl(selectedImage, selectedImageMime);
  }, [selectedImage, selectedImageMime, mediaType]);

  // Step 4: Content
  const [simpleMode, setSimpleMode] = useState(true);
  const [contentSubStep, setContentSubStep] = useState<number | null>(0);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [aiBundle, setAiBundle] = useState<AiRecommendBundle | null>(null);
  const [aiRecommendLoading, setAiRecommendLoading] = useState(false);
  const [lastScanId, setLastScanId] = useState<string | null>(null);
  const [contentText, setContentText] = useState('');
  const [contentType, setContentType] = useState<string>('copy');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('shortform');
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<string | null>(null);
  const [recommendedVoiceKey, setRecommendedVoiceKey] = useState<string | null>(null);
  const [voiceCategoryFilter, setVoiceCategoryFilter] = useState<VoiceCategory | 'all'>('all');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showAdvancedVideo, setShowAdvancedVideo] = useState(false);

  // Step 5: Upload
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

  useEffect(() => {
    if (selectedUploadPlatform && !PLATFORM_BOARDS[selectedUploadPlatform]) {
      markCompleted('platformSelect');
    }
  }, [selectedUploadPlatform]);

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

  // Step 3: Pick own photo (optional — product image is used by default)
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
        imageBase64: meta.imageBase64 || '',
        imageMimeType: meta.imageMimeType || '',
        platform: meta.platform || '',
        brand: meta.brand || '',
        searchUrl: meta.searchUrl || '',
      };
      if (!newMeta.productName && !newMeta.description && !newMeta.image) {
        const searchHint = newMeta.searchUrl
          ? `상품 정보를 자동으로 가져오지 못했습니다. AI가 URL 패턴을 분석하여 ${newMeta.platform || '쇼핑몰'} ${newMeta.brand ? `· ${newMeta.brand} ` : ''}정보를 추론했습니다. 검색 페이지에서 상품을 확인하거나, 사진을 업로드하여 진행할 수 있습니다. 영상 생성은 바로 가능합니다.|||${newMeta.searchUrl}`
          : `상품 정보를 자동으로 가져오지 못했습니다. AI가 URL 패턴을 분석하여 ${newMeta.platform || '쇼핑몰'} ${newMeta.brand ? `· ${newMeta.brand} ` : ''}정보를 추론했습니다. 사진을 업로드하면 더 정확한 분석이 가능합니다. 영상 생성은 바로 가능합니다.`;
        setExtractError(searchHint);
        setProductMeta({ ...newMeta, productName: newMeta.platform ? `${newMeta.platform} 상품` : '상품' });
        markCompleted('affiliate');
        return;
      }
      setProductMeta(newMeta);
      if (newMeta.platform && newMeta.platform !== 'Unknown') {
        setSelectedPlatform(newMeta.platform);
      }
      markCompleted('affiliate');
      // Use server-captured base64 image directly — bypasses CORS entirely
      if (newMeta.imageBase64) {
        setSelectedImage(newMeta.imageBase64);
        setSelectedImageMime(newMeta.imageMimeType || 'image/jpeg');
        setMediaType('photo');
        setImageSource('product');
      } else if (newMeta.image) {
        // Fallback: try browser-side fetch (may fail due to CORS)
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
      const platformKey = detectPlatformFromUrl(validation.normalizedUrl);
      const searchUrl = buildFallbackSearchUrl(validation.normalizedUrl, platformKey);
      setProductMeta({
        productName: platformKey ? `${platformKey} 상품` : '상품',
        description: '',
        price: '',
        image: '',
        imageBase64: '',
        imageMimeType: '',
        platform: platformKey,
        brand: platformKey,
        searchUrl,
      });
      if (platformKey) setSelectedPlatform(platformKey);
      setExtractError(
        searchUrl
          ? `상품 정보를 자동으로 가져오지 못했습니다. AI가 URL 패턴을 분석하여 ${platformKey || '쇼핑몰'} 정보를 추론했습니다. 검색 페이지에서 상품을 확인하거나, 사진을 업로드하여 진행할 수 있습니다. 영상 생성은 바로 가능합니다.|||${searchUrl}`
          : `상품 정보를 자동으로 가져오지 못했습니다. AI가 URL 패턴을 분석하여 ${platformKey || '쇼핑몰'} 정보를 추론했습니다. 사진을 업로드하면 더 정확한 분석이 가능합니다. 영상 생성은 바로 가능합니다.`,
      );
      markCompleted('affiliate');
    } finally {
      setExtracting(false);
    }
  };

  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleOpenLinkPage = () => {
    if (!affiliateUrl.trim()) return;
    Linking.openURL(affiliateUrl.trim()).catch(() => {
      setCaptureError('링크 페이지를 열 수 없습니다. URL을 확인해주세요.');
    });
  };

  const handlePickFromGallery = async () => {
    setCaptureError(null);
    setMediaLoading(true);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(true, 4);
        if (images.length === 0) {
          setMediaLoading(false);
          return;
        }
        const newImages = images.map((img) => ({ uri: img.uri, mime: img.mimeType }));
        setMultiImages((prev) => [...prev, ...newImages].slice(0, 4));
        const first = images[0];
        setSelectedImage(cleanBase64(first.base64));
        setSelectedImageMime(first.mimeType);
        setMediaType('photo');
        setImageSource('user');
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: false,
          quality: 0.7,
          selectionLimit: 4,
          allowsMultipleSelection: true,
        });
        if (result.canceled || !result.assets?.[0]?.uri) {
          setMediaLoading(false);
          return;
        }
        const compressed = await Promise.all(
          result.assets.slice(0, 4).map((a) => compressImageToBase64(a.uri, 1280, 0.7)),
        );
        const newImages = compressed.map((c) => ({ uri: buildDataUrl(c.base64, c.mimeType), mime: c.mimeType }));
        setMultiImages((prev) => [...prev, ...newImages].slice(0, 4));
        setSelectedImage(compressed[0].base64);
        setSelectedImageMime(compressed[0].mimeType);
        setMediaType('photo');
        setImageSource('user');
      }
    } catch {
      setCaptureError('이미지를 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setMediaLoading(false);
    }
  };

  const handleRemoveMultiImage = (idx: number) => {
    setMultiImages((prev) => prev.filter((_, i) => i !== idx));
  };

  // Map scenes to available images based on emotion phase
  const sceneImageMap = useMemo(() => {
    if (!videoPreviewScenes) return null;
    const userImages = multiImages.map((m) => m.uri);
    const allImages = [...userImages, ...aiSceneImages];
    if (allImages.length === 0) return null;

    const total = videoPreviewScenes.length;
    const map: number[] = [];
    for (let i = 0; i < total; i++) {
      if (allImages.length >= total) {
        map.push(i % allImages.length);
      } else {
        // Distribute images across scenes, prioritizing product-heavy scenes
        const scene = videoPreviewScenes[i];
        if (scene.emotion === 'desire' || scene.emotion === 'shock') {
          map.push(Math.min(i, allImages.length - 1));
        } else if (scene.emotion === 'action') {
          map.push(0);
        } else {
          map.push(i % allImages.length);
        }
      }
    }
    return map;
  }, [videoPreviewScenes, multiImages, aiSceneImages]);

  // Generate AI scene images for scenes without user photos
  const handleGenerateAiSceneImages = async () => {
    if (!videoPreviewScenes || !productMeta) return;
    setAiImageGenerating(true);
    try {
      const productName = productMeta.productName || '이 제품';
      const productDesc = productMeta.description || '';
      const scenesNeedingImages = videoPreviewScenes.length - multiImages.length;
      if (scenesNeedingImages <= 0) {
        setAiImageGenerating(false);
        return;
      }
      const prompts: string[] = [];
      for (let i = 0; i < videoPreviewScenes.length; i++) {
        const scene = videoPreviewScenes[i];
        if (i < multiImages.length) continue;
        const promptMap: Record<string, string> = {
          curiosity: `Professional product photography of ${productName}, clean studio lighting, minimalist background, hero shot angle`,
          shock: `Dramatic close-up shot of ${productName}, high contrast lighting, bold composition, premium product photography`,
          empathy: `Lifestyle scene with ${productName} being used naturally, warm ambient lighting, authentic moment, soft focus background`,
          desire: `Luxurious product shot of ${productName}, golden hour lighting, shallow depth of field, aspirational mood, premium aesthetic`,
          action: `Dynamic product shot of ${productName} with bold colored background, vibrant energy, call-to-action mood, commercial advertising style`,
        };
        const prompt = promptMap[scene.emotion] || `Professional product photography of ${productName}, ${productDesc}`;
        prompts.push(prompt);
      }
      const generated: string[] = [];
      for (const prompt of prompts.slice(0, 4)) {
        try {
          const resp = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/functions/v1/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, size: '1024x1024', quality: 'hd', style: 'vivid' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.image) {
              generated.push(`data:image/png;base64,${data.image}`);
            }
          }
        } catch { /* skip failed generation */ }
      }
      setAiSceneImages(generated);
    } catch {
      // AI generation is optional — video can still use user images
    } finally {
      setAiImageGenerating(false);
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
      let analysisResult = null;
      try {
        const dataUrl = selectedImage.startsWith('data:') ? selectedImage : buildDataUrl(selectedImage, selectedImageMime);
        if (productMeta) {
          analysisResult = await analyzeImageWithProductContext(
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
        } else {
          analysisResult = await analyzeImage(
            dataUrl,
            'scan.jpg',
            selectedImageMime || 'image/jpeg',
            'single',
          );
        }
        await updateScanWithAnalysis(scanId, analysisResult);
      } catch {
        // analysis enhancement is best-effort; scan already saved
      }
      markCompleted('analyze');
      setLastScanId(scanId);

      setAiRecommendLoading(true);
      try {
        const bundle = await fetchAiRecommendBundle({
          productName: productMeta?.productName || analysisResult?.productName || '',
          productCategory: productMeta?.platform || analysisResult?.productCategory || '',
          hook: analysisResult?.templateData?.hook || '',
          oneLiner: analysisResult?.oneLiner || '',
          fallbackHashtags: analysisResult?.templateData?.hashtags || [],
        });
        setAiBundle(bundle);
        setAiRecommendation(bundle.templateLabel);
        const match = TEMPLATE_STYLES.find((t) => bundle.templateLabel.includes(t.label));
        if (match) setSelectedTemplate(match.key);
        setRecommendedVoiceKey(bundle.voice.key);
        setSelectedVoiceKey(bundle.voice.key);
      } catch {
        setAiRecommendation('웹툰형 만화');
      } finally {
        setAiRecommendLoading(false);
      }

      setAnalyzing(false);
    } catch (err) {
      setAnalyzeError(friendlyError(err, 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
      setAnalyzing(false);
    }
  };

  // Step 4: Save content
  const handleSaveContent = () => {
    if (!contentText.trim()) return;
    markCompleted('content');
  };

  // Step 5: Open preview before upload
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
    const platformKey = previewUpload.platformKey;
    setContentText(edited.caption);
    setAffiliateUrl(edited.affiliateUrl);
    setAutoDisclosure(edited.autoDisclosure);
    setUploadPlatform(platformKey);
    setPreviewUpload(null);
    setPendingUploadPlatform(platformKey);
    setShowUploadConfirm(platformKey);
    setTimeout(() => handleOpenDeepLink(platformKey), 300);
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

  const disclosureText = useMemo(() => {
    const platforms = selectedPlatform ? [selectedPlatform] : [];
    return getDisclosureForPlatforms(platforms, autoDisclosure);
  }, [selectedPlatform, autoDisclosure]);

  const generatePreviewVideo = useCallback(async () => {
    if (Platform.OS !== 'web') {
      setRenderError('웹 브라우저에서만 영상 생성이 가능합니다.');
      return;
    }
    if (!videoPreviewScenes) {
      setRenderError('먼저 스토리보드를 생성해주세요.');
      return;
    }
    setVideoRendering(true);
    setVideoRenderComplete(false);
    setRenderError(null);
    setRenderedVideoUrl(null);
    renderProgress.value = 0;

    try {
      // Load all available images: user multi-angle photos + AI-generated scene images
      const allImageUris = [...multiImages.map((m) => m.uri), ...aiSceneImages];
      const sceneImgs: (HTMLImageElement | null)[] = [];

      if (allImageUris.length > 0 && sceneImageMap) {
        const uniqueUris = [...new Set(allImageUris)];
        const loadedImgs = await Promise.all(
          uniqueUris.map(async (uri): Promise<HTMLImageElement | null> => {
            try {
              const { urlToDataUrl } = await import('@/lib/base64');
              const safeUri = await urlToDataUrl(uri);
              return await new Promise<HTMLImageElement>((resolve, reject) => {
                const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('이미지 로드 실패'));
                el.src = safeUri;
              });
            } catch {
              return null;
            }
          }),
        );
        const uriToImg = new Map(uniqueUris.map((uri, i) => [uri, loadedImgs[i]]));
        for (const uri of allImageUris) {
          sceneImgs.push(uriToImg.get(uri) ?? null);
        }
      }

      // Fallback: load single image if no multi-images
      let fallbackImg: HTMLImageElement | null = null;
      if (sceneImgs.length === 0 && imagePreviewUri) {
        try {
          const { urlToDataUrl } = await import('@/lib/base64');
          const safeImageUrl = await urlToDataUrl(imagePreviewUri);
          fallbackImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('이미지 로드 실패'));
            el.src = safeImageUrl;
          });
        } catch {
          fallbackImg = null;
        }
      }

      const analysis = viralAnalysisResult;
      const specsRatio = analysis?.specs.ratio ?? '9:16';
      const isPortrait = specsRatio.includes('9:16') || specsRatio.includes('16:9') === false;
      const W = isPortrait ? 1080 : 1920;
      const H = isPortrait ? 1920 : 1080;
      const FPS = 30;
      const totalSec = parseInt(analysis?.specs.maxDuration ?? '60', 10) || 60;
      const DURATION = Math.min(totalSec, 60);
      const cg = analysis?.colorGrading ?? { warm: 10, contrast: 20, saturation: 15, vignette: 30 };
      const bpm = analysis?.pacingBpm ?? 100;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.');

      // Set up audio context for BGM + TTS voiceover
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const audioDest = audioCtx.createMediaStreamDestination();
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(audioDest);

      // Generate BGM: platform-specific beat pattern using oscillators
      const bgmGain = audioCtx.createGain();
      bgmGain.gain.value = 0.15;
      bgmGain.connect(masterGain);

      const beatInterval = 60 / bpm; // seconds per beat
      const bgmOsc = audioCtx.createOscillator();
      const bgmOscGain = audioCtx.createGain();
      bgmOsc.type = 'sine';
      bgmOsc.frequency.value = selectedUploadPlatform === 'tiktok' ? 80 : selectedUploadPlatform === 'instagram' ? 60 : 70;
      bgmOsc.connect(bgmOscGain);
      bgmOscGain.gain.value = 0;
      bgmOsc.connect(bgmGain);
      bgmOsc.start();

      // Schedule beat pulses throughout the video
      const totalBeats = Math.floor(DURATION / beatInterval);
      for (let b = 0; b < totalBeats; b++) {
        const beatTime = b * beatInterval;
        bgmOscGain.gain.setValueAtTime(0.3, beatTime);
        bgmOscGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.15);
      }
      bgmOscGain.connect(bgmGain);

      // Add a secondary melody oscillator for richness
      const melodyOsc = audioCtx.createOscillator();
      const melodyGain = audioCtx.createGain();
      melodyOsc.type = 'triangle';
      melodyOsc.frequency.value = selectedUploadPlatform === 'tiktok' ? 220 : selectedUploadPlatform === 'instagram' ? 165 : 196;
      melodyGain.gain.value = 0;
      melodyOsc.connect(melodyGain);
      melodyGain.connect(bgmGain);
      melodyOsc.start();

      // Schedule melody notes on every other beat
      const melodyNotes = [261.63, 293.66, 329.63, 392.00, 329.63, 293.66];
      for (let b = 0; b < totalBeats; b += 2) {
        const noteTime = b * beatInterval;
        const freq = melodyNotes[(b / 2) % melodyNotes.length];
        melodyOsc.frequency.setValueAtTime(freq, noteTime);
        melodyGain.gain.setValueAtTime(0.08, noteTime);
        melodyGain.gain.exponentialRampToValueAtTime(0.001, noteTime + beatInterval * 1.5);
      }

      // Combine canvas video stream + audio stream
      const canvasStream = (canvas as unknown as { captureStream: (fps: number) => MediaStream }).captureStream(FPS);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const codecCandidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      let mimeType = '';
      for (const c of codecCandidates) {
        try {
          if (MediaRecorder.isTypeSupported(c)) { mimeType = c; break; }
        } catch { /* try next */ }
      }
      if (!mimeType) throw new Error('이 브라우저는 영상 생성을 지원하지 않습니다.');

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start();

      // Compute base dimensions for each scene image
      const getBaseDims = (imgEl: HTMLImageElement | null) => {
        if (!imgEl) return { baseW: W, baseH: H };
        const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight;
        const canvasAspect = W / H;
        if (imgAspect > canvasAspect) return { baseW: W, baseH: W / imgAspect };
        return { baseH: H, baseW: H * imgAspect };
      };

      const scenes = videoPreviewScenes;
      const totalScenes = scenes.length;
      const sceneDuration = DURATION / totalScenes;
      const startTime = performance.now();
      const durationMs = DURATION * 1000;

      // Generate TTS voiceover from scene texts
      try {
        const narrationText = scenes.map(s => s.textOverlay).join('. ');
        if ('speechSynthesis' in window) {
          const ttsUtterance = new SpeechSynthesisUtterance(narrationText);
          ttsUtterance.lang = 'ko-KR';
          ttsUtterance.rate = selectedUploadPlatform === 'tiktok' ? 1.15 : selectedUploadPlatform === 'youtube' ? 0.95 : 1.05;
          ttsUtterance.pitch = 1.0;
          const voices = window.speechSynthesis.getVoices();
          const koreanVoice = voices.find(v => v.lang.startsWith('ko'));
          if (koreanVoice) ttsUtterance.voice = koreanVoice;
          setTimeout(() => {
            window.speechSynthesis.speak(ttsUtterance);
          }, 200);
        }
      } catch { /* TTS is optional */ }

      // Add transition sound effects (whoosh/zip) at scene boundaries
      const sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 0.2;
      sfxGain.connect(masterGain);
      for (let i = 1; i < totalScenes; i++) {
        const sfxTime = (DURATION / totalScenes) * i;
        const sfxOsc = audioCtx.createOscillator();
        const sfxOscGain = audioCtx.createGain();
        sfxOsc.type = 'sawtooth';
        sfxOsc.frequency.setValueAtTime(800, sfxTime);
        sfxOsc.frequency.exponentialRampToValueAtTime(200, sfxTime + 0.1);
        sfxOscGain.gain.setValueAtTime(0.15, sfxTime);
        sfxOscGain.gain.exponentialRampToValueAtTime(0.001, sfxTime + 0.12);
        sfxOsc.connect(sfxOscGain);
        sfxOscGain.connect(sfxGain);
        sfxOsc.start(sfxTime);
        sfxOsc.stop(sfxTime + 0.15);
      }

      const applyColorGrading = (brightness: number, contrast: number, saturation: number) => {
        ctx.filter = `brightness(${brightness}) contrast(${1 + contrast}) saturate(${1 + saturation})`;
      };
      const resetFilter = () => { ctx.filter = 'none'; };

      const getMotionTransform = (motionType: PsychScene['motionType'], t: number, baseW: number, baseH: number) => {
        switch (motionType) {
          case 'zoom-in': return { scale: 1.0 + t * 0.35, offsetX: 0, offsetY: 0 };
          case 'zoom-out': return { scale: 1.35 - t * 0.35, offsetX: 0, offsetY: 0 };
          case 'pan-right': return { scale: 1.2, offsetX: -baseW * 0.15 * t, offsetY: 0 };
          case 'pan-left': return { scale: 1.2, offsetX: baseW * 0.15 * t, offsetY: 0 };
          case 'tilt-up': return { scale: 1.2, offsetX: 0, offsetY: baseH * 0.15 * t };
          case 'shake': return { scale: 1.1 + t * 0.1, offsetX: Math.sin(t * Math.PI * 8) * 12, offsetY: Math.cos(t * Math.PI * 6) * 8 };
          case 'pulse': return { scale: 1.0 + Math.sin(t * Math.PI * 3) * 0.08, offsetX: 0, offsetY: 0 };
          default: return { scale: 1.0 + t * 0.2, offsetX: 0, offsetY: 0 };
        }
      };

      const getTextY = (position: PsychScene['textPosition']) => {
        if (position === 'top') return H * 0.12;
        if (position === 'center') return H * 0.42;
        return H * 0.72;
      };

      // TV commercial style: advanced transitions between scenes
      const getSceneTransitionAlpha = (localT: number, sceneIdx: number) => {
        const fadeIn = Math.min(localT * 8, 1);
        const fadeOut = Math.min((1 - localT) * 8, 1);
        const cutFlash = localT < 0.05 ? 1 - localT * 20 : 0;
        return Math.min(fadeIn * fadeOut + cutFlash * 0.3, 1);
      };

      // Advanced transition effects: whip pan, zoom blur, glitch, match cut
      const drawTransitionEffect = (
        transitionType: 'whip-pan' | 'zoom-blur' | 'glitch' | 'match-cut' | 'cross-fade',
        localT: number,
        sceneIdx: number,
      ) => {
        if (localT > 0.15 && localT < 0.85) return; // Only at boundaries

        const isEnter = localT < 0.15;
        const t = isEnter ? localT / 0.15 : (1 - localT) / 0.15;

        switch (transitionType) {
          case 'whip-pan': {
            const blurX = isEnter ? (1 - t) * 80 : t * 80;
            ctx.filter = `blur(${blurX}px)`;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#0a0f1e';
            ctx.fillRect(0, 0, W, H);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            break;
          }
          case 'zoom-blur': {
            const scale = isEnter ? 1 + (1 - t) * 0.3 : 1 + t * 0.3;
            ctx.filter = `blur(${(1 - t) * 6}px)`;
            ctx.globalAlpha = 0.4;
            ctx.fillRect(0, 0, W, H);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            break;
          }
          case 'glitch': {
            if (t > 0.3) {
              const glitchY = Math.random() * H;
              const glitchH = 20 + Math.random() * 40;
              ctx.globalAlpha = 0.6 * (1 - t);
              ctx.fillStyle = '#ff0044';
              ctx.fillRect(0, glitchY, W, glitchH);
              ctx.fillStyle = '#00ffff';
              ctx.fillRect(-10 + Math.random() * 20, glitchY, W, glitchH);
              ctx.globalAlpha = 1;
            }
            break;
          }
          case 'match-cut': {
            const flash = isEnter ? (1 - t) * 0.3 : t * 0.3;
            ctx.fillStyle = `rgba(255,255,255,${flash})`;
            ctx.fillRect(0, 0, W, H);
            break;
          }
          case 'cross-fade':
          default: {
            // Standard cross-fade handled by transitionAlpha
            break;
          }
        }
      };

      // Assign transition types to scene boundaries (cycling through)
      const transitionTypes: Array<'whip-pan' | 'zoom-blur' | 'glitch' | 'match-cut' | 'cross-fade'> = ['whip-pan', 'zoom-blur', 'glitch', 'match-cut', 'cross-fade'];

      // Emotion-specific overlay rendering — TV commercial style
      const drawEmotionOverlay = (
        emotion: PsychScene['emotion'],
        localT: number,
        color: { primary: string; accent: string; overlay: string },
      ) => {
        switch (emotion) {
          case 'curiosity': {
            const spotR = W * (0.3 + localT * 0.25);
            const spotGrad = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, spotR);
            spotGrad.addColorStop(0, 'rgba(0,0,0,0)');
            spotGrad.addColorStop(1, color.overlay);
            ctx.fillStyle = spotGrad;
            ctx.fillRect(0, 0, W, H);
            break;
          }
          case 'shock': {
            const flashIntensity = Math.max(0, 1 - localT * 3) * 0.4;
            ctx.fillStyle = `rgba(255,40,40,${flashIntensity})`;
            ctx.fillRect(0, 0, W, H);
            const shockVignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.6);
            shockVignette.addColorStop(0, 'rgba(0,0,0,0)');
            shockVignette.addColorStop(1, `rgba(20,0,0,${0.5 + localT * 0.2})`);
            ctx.fillStyle = shockVignette;
            ctx.fillRect(0, 0, W, H);
            break;
          }
          case 'empathy': {
            const warmth = 0.15 + Math.sin(localT * Math.PI) * 0.1;
            const warmGrad = ctx.createLinearGradient(0, H * 0.3, 0, H);
            warmGrad.addColorStop(0, 'rgba(0,0,0,0)');
            warmGrad.addColorStop(0.5, `rgba(255,200,100,${warmth * 0.3})`);
            warmGrad.addColorStop(1, `rgba(255,180,80,${warmth * 0.5})`);
            ctx.fillStyle = warmGrad;
            ctx.fillRect(0, 0, W, H);
            break;
          }
          case 'desire': {
            const desireGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.65);
            desireGrad.addColorStop(0, 'rgba(0,0,0,0)');
            desireGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
            desireGrad.addColorStop(1, `rgba(15,5,0,${0.6 + localT * 0.2})`);
            ctx.fillStyle = desireGrad;
            ctx.fillRect(0, 0, W, H);
            break;
          }
          case 'action': {
            const pulse = Math.sin(localT * Math.PI * 4) * 0.5 + 0.5;
            const borderW = 8 + pulse * 6;
            ctx.strokeStyle = color.accent;
            ctx.lineWidth = borderW;
            ctx.globalAlpha = 0.6 + pulse * 0.3;
            ctx.strokeRect(borderW / 2, borderW / 2, W - borderW, H - borderW);
            ctx.globalAlpha = 1;
            const actionGrad = ctx.createLinearGradient(0, H, 0, H * 0.7);
            actionGrad.addColorStop(0, color.primary + '50');
            actionGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = actionGrad;
            ctx.fillRect(0, 0, W, H);
            break;
          }
        }
      };

      // Draw decorative particles for text-only scenes
      const drawDecorativeElements = (
        emotion: PsychScene['emotion'],
        localT: number,
        color: { primary: string; accent: string },
      ) => {
        const particleCount = emotion === 'shock' ? 12 : emotion === 'action' ? 8 : 6;
        for (let i = 0; i < particleCount; i++) {
          const seed = i * 137.5;
          const angle = (seed + localT * 180) * (Math.PI / 180);
          const radius = W * (0.15 + (i % 3) * 0.12) + Math.sin(localT * Math.PI * 2 + seed) * 30;
          const px = W / 2 + Math.cos(angle) * radius;
          const py = H / 2 + Math.sin(angle) * radius * 0.6;
          const size = 3 + Math.sin(localT * Math.PI * 3 + seed) * 2;
          ctx.globalAlpha = 0.15 + Math.sin(localT * Math.PI * 2 + seed) * 0.1;
          ctx.fillStyle = i % 2 === 0 ? color.primary : color.accent;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };

      // TV commercial style: draw a quick brand bumper between scenes
      const drawBrandBumper = (alpha: number) => {
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '900 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.fillText(productMeta?.productName || 'CHECK THIS OUT', W / 2, H / 2);
        ctx.shadowColor = 'transparent';
        ctx.globalAlpha = 1;
      };

      const drawFrame = () => {
        const elapsed = performance.now() - startTime;
        const globalT = Math.min(elapsed / durationMs, 1);
        const pct = Math.round(globalT * 100);
        renderProgress.value = globalT;

        const sceneIdx = Math.min(Math.floor(globalT * totalScenes), totalScenes - 1);
        const scene = scenes[sceneIdx];
        const sceneLocalT = (globalT * totalScenes) - sceneIdx;
        const transitionAlpha = getSceneTransitionAlpha(sceneLocalT, sceneIdx);

        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, W, H);

        if (scene) {
          // Determine which image to use for this scene
          let sceneImg: HTMLImageElement | null = null;
          if (sceneImageMap && sceneImgs.length > 0) {
            const imgIdx = sceneImageMap[sceneIdx] ?? 0;
            sceneImg = sceneImgs[imgIdx] ?? null;
          } else if (fallbackImg) {
            sceneImg = fallbackImg;
          }

          // TV commercial: show brand bumper at start of first scene
          if (sceneIdx === 0 && sceneLocalT < 0.08) {
            drawBrandBumper(1 - sceneLocalT * 12);
          }

          if (sceneImg) {
            // Multi-angle / AI-generated image scene with motion
            const { baseW, baseH } = getBaseDims(sceneImg);
            const motion = getMotionTransform(scene.motionType, sceneLocalT, baseW, baseH);
            const drawW = baseW * motion.scale;
            const drawH = baseH * motion.scale;
            const drawX = (W - drawW) / 2 + motion.offsetX;
            const drawY = (H - drawH) / 2 + motion.offsetY;

            ctx.globalAlpha = transitionAlpha;
            applyColorGrading(
              1.0 + cg.warm * 0.003,
              cg.contrast * 0.005,
              cg.saturation * 0.005,
            );
            ctx.drawImage(sceneImg, drawX, drawY, drawW, drawH);
            resetFilter();
            ctx.globalAlpha = 1;
          } else {
            // Text-only story scene: gradient background + decorative elements
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, scene.colorTheme.primary + '30');
            bgGrad.addColorStop(0.5, scene.colorTheme.accent + '20');
            bgGrad.addColorStop(1, '#0a0f1e');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            ctx.globalAlpha = transitionAlpha;
            drawDecorativeElements(scene.emotion, sceneLocalT, scene.colorTheme);
            ctx.globalAlpha = 1;
          }

          // Advanced transition effect at scene boundaries
          if (sceneIdx > 0) {
            const transitionType = transitionTypes[sceneIdx % transitionTypes.length];
            drawTransitionEffect(transitionType, sceneLocalT, sceneIdx);
          }

          // Emotion-specific overlay
          ctx.globalAlpha = transitionAlpha;
          drawEmotionOverlay(scene.emotion, sceneLocalT, scene.colorTheme);
          ctx.globalAlpha = 1;

          // Standard color overlay
          const overlayGrad = ctx.createLinearGradient(0, 0, 0, H);
          const overlayColor = scene.colorTheme.overlay;
          overlayGrad.addColorStop(0, overlayColor);
          overlayGrad.addColorStop(0.4, 'rgba(10,15,30,0.2)');
          overlayGrad.addColorStop(1, overlayColor);
          ctx.fillStyle = overlayGrad;
          ctx.globalAlpha = transitionAlpha * 0.7;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;

          // Vignette
          const vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
          vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vignetteGrad.addColorStop(1, `rgba(0,0,0,${cg.vignette * 0.01})`);
          ctx.fillStyle = vignetteGrad;
          ctx.fillRect(0, 0, W, H);

          // Kinetic caption animation: word-by-word reveal with bounce
          ctx.globalAlpha = transitionAlpha;
          const textY = getTextY(scene.textPosition);
          const words = scene.textOverlay.split(' ');
          const totalWords = words.length;
          // Reveal words progressively: each word appears at 1/totalWords of scene duration
          const wordsRevealed = Math.min(Math.floor(sceneLocalT * totalWords * 1.5) + 1, totalWords);

          ctx.font = `900 ${scene.fontSize}px sans-serif`;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.95)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetY = 4;

          // Measure total text width for centering
          const visibleWords = words.slice(0, wordsRevealed);
          const fullText = visibleWords.join(' ');
          const lines = fullText.match(/.{1,14}/g) || [fullText];

          lines.slice(0, 3).forEach((line, lineI) => {
            const lineWords = line.split(' ');
            let xOffset = 0;
            // Measure each word for kinetic positioning
            const lineWidth = ctx.measureText(line).width;
            let wordX = (W - lineWidth) / 2;

            lineWords.forEach((word, wordI) => {
              const globalWordIdx = lines.slice(0, lineI).reduce((sum, l) => sum + l.split(' ').length, 0) + wordI;
              const wordProgress = Math.min(sceneLocalT * totalWords * 1.5 - globalWordIdx + 1, 1);
              const wordAlpha = Math.max(0, Math.min(wordProgress, 1));
              const bounce = wordProgress < 1 ? Math.sin(wordProgress * Math.PI) * 8 : 0;
              const scale = wordProgress < 1 ? 0.8 + wordProgress * 0.2 : 1;

              ctx.globalAlpha = transitionAlpha * wordAlpha;
              ctx.save();
              ctx.translate(wordX + ctx.measureText(word).width / 2, textY + lineI * (scene.fontSize + 12) - bounce);
              ctx.scale(scale, scale);
              ctx.fillStyle = '#fff';
              ctx.fillText(word, 0, 0);
              ctx.restore();

              wordX += ctx.measureText(word + ' ').width;
            });
          });

          // Subtext with typewriter effect
          ctx.font = `600 ${scene.subFontSize}px sans-serif`;
          ctx.fillStyle = scene.colorTheme.accent + 'DD';
          ctx.shadowBlur = 10;
          const descLines = scene.subtext.match(/.{1,24}/g) || [scene.subtext];
          const descY = textY + lines.length * (scene.fontSize + 12) + 16;
          const totalDescChars = scene.subtext.length;
          const charsRevealed = Math.min(Math.floor(sceneLocalT * totalDescChars * 1.2) + 1, totalDescChars);

          descLines.slice(0, 3).forEach((line, i) => {
            const charsBeforeLine = descLines.slice(0, i).reduce((sum, l) => sum + l.length, 0);
            const lineChars = Math.max(0, Math.min(charsRevealed - charsBeforeLine, line.length));
            const visibleLine = line.slice(0, lineChars);
            if (visibleLine) {
              ctx.fillText(visibleLine, W / 2, descY + i * (scene.subFontSize + 8));
            }
          });

          // Blinking cursor at end of typewriter text
          if (charsRevealed < totalDescChars) {
            const cursorBlink = Math.sin(elapsed / 100) > 0;
            if (cursorBlink) {
              const lastLine = descLines[Math.min(Math.floor(charsRevealed / 24), descLines.length - 1)];
              const lastLineWidth = ctx.measureText(lastLine.slice(0, charsRevealed % 24)).width;
              ctx.fillStyle = scene.colorTheme.accent;
              ctx.fillRect(W / 2 + lastLineWidth / 2 + 4, descY + Math.min(Math.floor(charsRevealed / 24), 2) * (scene.subFontSize + 8), 3, scene.subFontSize);
            }
          }

          ctx.fillStyle = scene.colorTheme.primary;
          ctx.font = '700 18px sans-serif';
          ctx.textAlign = 'left';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.fillText(`[${scene.emotion.toUpperCase()}]`, 30, textY - 28);

          ctx.shadowColor = 'transparent';
          ctx.globalAlpha = 1;
        }

        // Auto-insert affiliate disclosure text at the bottom of every frame
        if (disclosureText) {
          const discFontSize = Math.round(W * 0.022);
          ctx.globalAlpha = 0.82;
          ctx.font = `600 ${discFontSize}px sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 6;
          const discLines = disclosureText.match(/.{1,28}/g) || [disclosureText];
          const discLineH = discFontSize + 6;
          discLines.slice(0, 2).forEach((line, i) => {
            ctx.fillText(line, W / 2, H - 12 - (discLines.length - 1 - i) * discLineH);
          });
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        const beatPhase = (elapsed / 1000) * (bpm / 60) * Math.PI * 2;
        const beatPulse = Math.sin(beatPhase) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + beatPulse * 0.15;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, H - 4, W * globalT, 4);
        ctx.globalAlpha = 1;

        ctx.globalAlpha = Math.min(globalT * 5, 1);
        ctx.fillStyle = scene?.colorTheme.primary ?? theme.colors.accent[400];
        ctx.font = '700 22px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(`${pct}%`, W - 30, 30);
        ctx.textAlign = 'left';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        if (globalT < 1) {
          requestAnimationFrame(drawFrame);
        } else {
          setTimeout(() => {
            if (recorder.state === 'recording') recorder.stop();
          }, 200);
        }
      };
      requestAnimationFrame(drawFrame);

      await done;
      // Clean up audio resources
      try {
        bgmOsc.stop();
        melodyOsc.stop();
        audioCtx.close();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      } catch { /* cleanup best-effort */ }
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRenderedVideoUrl(url);
      setRenderedVideoMime(mimeType);
      setVideoRenderComplete(true);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : '영상 생성에 실패했습니다.');
    } finally {
      setVideoRendering(false);
      renderProgress.value = 1;
    }
  }, [videoPreviewScenes, viralAnalysisResult, renderProgress, disclosureText, imagePreviewUri, multiImages, aiSceneImages, sceneImageMap, productMeta]);

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
        <View
          ref={(ref) => { stepRefs.current[1] = ref; }}
          collapsable={false}
        />
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

          {/* Link page open + gallery pick — below URL input */}
          {affiliateUrl.trim() && (
            <View style={styles.captureImageRow}>
              <TouchableOpacity
                style={styles.openLinkBtn}
                onPress={handleOpenLinkPage}
                activeOpacity={0.85}
              >
                <ExternalLink size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.openLinkBtnText}>링크 페이지 열기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureImageBtn, mediaLoading && styles.captureImageBtnDisabled]}
                onPress={handlePickFromGallery}
                disabled={mediaLoading}
                activeOpacity={0.85}
              >
                {mediaLoading ? (
                  <Loader size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                ) : (
                  <ImageIcon size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                )}
                <Text style={styles.captureImageBtnText}>
                  {mediaLoading ? '불러오는 중...' : '갤러리에서 불러오기'}
                </Text>
              </TouchableOpacity>
              {selectedImage && imageSource === 'user' && (
                <View style={styles.captureImageDoneBadge}>
                  <Check size={11} color={theme.colors.success[400]} strokeWidth={2.5} />
                  <Text style={styles.captureImageDoneText}>이미지 선택됨</Text>
                </View>
              )}
            </View>
          )}
          {captureError && (
            <View style={styles.captureErrorBox}>
              <Text style={styles.captureErrorText}>{captureError}</Text>
            </View>
          )}
          {affiliateUrl.trim() && !selectedImage && (
            <View style={styles.captureHintBox}>
              <Text style={styles.captureHintText}>
                1. '링크 페이지 열기'로 상품 페이지를 열어 상품 사진을 캡처/저장하세요{'\n'}
                2. '갤러리에서 불러오기'로 저장한 사진을 선택하면 상품 분석이 진행됩니다
              </Text>
            </View>
          )}
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
              <Text style={styles.extractErrorText}>
                {extractError.split('|||')[0]}
              </Text>
              {extractError.includes('|||') && (
                <TouchableOpacity
                  style={styles.extractSearchBtn}
                  onPress={() => {
                    const searchUrl = extractError.split('|||')[1];
                    if (searchUrl) Linking.openURL(searchUrl).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <ScanSearch size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.extractSearchBtnText}>검색 페이지에서 상품 확인</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.extractHintText}>
                AI가 URL 패턴으로 플랫폼과 브랜드를 추론했습니다. 사진을 업로드하면 더 정확한 분석이 가능하고, 바로 영상 생성도 가능합니다.
              </Text>
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
                    scrollToStep(4);
                  }}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                  <Text style={styles.extractManualBtnText}>사진 업로드로 진행</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.extractManualBtn, { borderColor: theme.colors.success[400], marginLeft: 8 }]}
                  onPress={() => {
                    setExtractError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <ArrowRight size={12} color={theme.colors.success[400]} strokeWidth={2} />
                  <Text style={[styles.extractManualBtnText, { color: theme.colors.success[400] }]}>그대로 진행</Text>
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
              {imagePreviewUri ? (
                <Image
                  source={{ uri: imagePreviewUri }}
                  style={styles.productMetaImage}
                  resizeMode="cover"
                />
              ) : productMeta.image ? (
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
        <View
          ref={(ref) => { stepRefs.current[2] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<Share2 size={22} color={theme.colors.warning[400]} strokeWidth={2.5} />}
          title="플랫폼 선택하기"
          subtitle="주요 플랫폼 업로드 게시판 선택 · 수동 입력"
          accentColor={theme.colors.warning[400]}
          iconBg={theme.colors.warning[500] + '22'}
          stepNumber={2}
          completed={completedSteps.has('platformSelect')}
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
                      onPress={() => {
                        const newBoard = isBoardSelected ? null : b.key;
                        setSelectedBoard(newBoard);
                        if (newBoard) {
                          setPreviewMediaMode(getBoardMediaType(selectedUploadPlatform, newBoard));
                          markCompleted('platformSelect');
                        }
                      }}
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
              {selectedBoard && (() => {
                const board = PLATFORM_BOARDS[selectedUploadPlatform]?.find((b) => b.key === selectedBoard);
                if (!board?.desc) return null;
                return (
                  <View style={styles.boardDescBox}>
                    <Text style={styles.boardDescText}>{board.desc}</Text>
                  </View>
                );
              })()}
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
                  <Text style={styles.viralAnalysisTitle}>{getBoardMediaType(selectedUploadPlatform, selectedBoard) === 'image' ? '상위 1% 수익화 이미지 분석' : '상위 1% 수익화 영상 분석'}</Text>
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

                  <Text style={styles.viralHooksLabel}>플랫폼 심리 분석 결과</Text>
                  {viralAnalysisResult.platformPsychology && (
                    <View style={styles.viralHookRow}>
                      <View style={[styles.viralHookNumber, { backgroundColor: theme.colors.warning[500] }]}>
                        <Text style={styles.viralHookNumberText}>★</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.viralHookTitle}>시선 패턴: {viralAnalysisResult.platformPsychology.attentionPattern}</Text>
                        <Text style={styles.viralHookDesc}>핵심 드라이브: {viralAnalysisResult.platformPsychology.primaryDrive} · 평균 시청 {viralAnalysisResult.platformPsychology.avgWatchTime} · 최적 후크 {viralAnalysisResult.platformPsychology.optimalHookSec}초</Text>
                      </View>
                    </View>
                  )}
                  {viralAnalysisResult.psychologicalTriggers.map((trigger, i) => (
                    <View key={i} style={styles.viralHookRow}>
                      <View style={styles.viralHookNumber}>
                        <Text style={styles.viralHookNumberText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.viralHookTitle}>{trigger.name}</Text>
                        <Text style={styles.viralHookDesc}>{trigger.description}</Text>
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
                          setVideoPreviewScenes(viralAnalysisResult.scenes);
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
                    const boardMedia = getBoardMediaType(selectedUploadPlatform, selectedBoard);
                    setPreviewMediaMode(boardMedia);
                    setTimeout(() => {
                      setViralAnalyzing(false);
                      setViralAnalysisResult(
                        generatePsychAnalysis(
                          selectedUploadPlatform,
                          selectedBoard,
                          affiliateUrl,
                          undefined,
                          {
                            productName: productMeta?.productName,
                            price: productMeta?.price,
                            brand: productMeta?.brand,
                            description: productMeta?.description,
                          },
                        ),
                      );
                    }, 1800);
                  }}
                  activeOpacity={0.85}
                >
                  <TrendingUp size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
                  <Text style={styles.viralStartBtnText}>
                    {getBoardMediaType(selectedUploadPlatform, selectedBoard) === 'image' ? '심리 자극 이미지 분석 시작' : '심리 자극 영상 분석 시작'}
                  </Text>
                  <ArrowRight size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
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
          subtitle={previewMediaMode === 'image' ? 'AI 자동 추천 · 스타일·해시태그 설정 · 이미지용 문구 입력' : 'AI 자동 추천 · 스타일·음성·해시태그 설정 · 문구 입력'}
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

          {/* ── Sub-accordion: ① 원소재 선택 ── */}
          <TouchableOpacity
            style={styles.subAccordionHeader}
            onPress={() => setContentSubStep(contentSubStep === 0 ? null : 0)}
            activeOpacity={0.7}
          >
            <View style={styles.subAccordionLeft}>
              <View style={[styles.subAccordionNum, contentSubStep === 0 && styles.subAccordionNumActive]}>
                <Text style={[styles.subAccordionNumText, contentSubStep === 0 && styles.subAccordionNumTextActive]}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subAccordionTitle}>소재 선택</Text>
                <Text style={styles.subAccordionDesc} numberOfLines={1}>
                  {previewMediaMode === 'video'
                    ? stockVideoClip ? 'Pexels 영상 선택됨' : '가로 스크롤로 무료 영상을 선택하세요'
                    : 'AI 분석 결과를 바탕으로 이미지가 준비됩니다'}
                </Text>
              </View>
            </View>
            {contentSubStep === 0 ? (
              <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {contentSubStep === 0 && (
            <View style={styles.subAccordionBody}>
              {previewMediaMode === 'video' && (
                <>
                  <StockVideoPicker
                    productName={productMeta?.productName}
                    productCategory={undefined}
                    orientation={(() => {
                      const specs = selectedUploadPlatform && selectedBoard
                        ? BOARD_VIDEO_SPECS[selectedUploadPlatform]?.[selectedBoard]
                        : null;
                      if (!specs) return 'portrait';
                      return specs.ratio.includes('9:16') ? 'portrait'
                        : specs.ratio.includes('16:9') ? 'landscape'
                        : 'square';
                    })()}
                    selectedClip={stockVideoClip}
                    onSelectClip={setStockVideoClip}
                  />

                  {stockVideoClip && (
                    <View style={styles.subStepHintBox}>
                      <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
                      <Text style={styles.subStepHintText}>영상이 선택되었습니다.</Text>
                    </View>
                  )}
                </>
              )}

              {previewMediaMode === 'image' && (
                <View style={styles.subStepHintBox}>
                  <ImageIcon size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={styles.subStepHintText}>
                    AI 분석 후 이미지가 자동으로 사용됩니다. AI 자동 추천 버튼을 누르면 스타일까지 한 번에 적용됩니다.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.subNextBtn}
                onPress={() => setContentSubStep(1)}
                activeOpacity={0.8}
              >
                <Text style={styles.subNextBtnText}>다음: 스타일 및 문구</Text>
                <ChevronDown size={14} color="#fff" strokeWidth={2} style={{ transform: [{ rotate: '-90deg' }] }} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Sub-accordion: ② 스타일 & 카피 설정 ── */}
          <TouchableOpacity
            style={styles.subAccordionHeader}
            onPress={() => setContentSubStep(contentSubStep === 1 ? null : 1)}
            activeOpacity={0.7}
          >
            <View style={styles.subAccordionLeft}>
              <View style={[styles.subAccordionNum, contentSubStep === 1 && styles.subAccordionNumActive]}>
                <Text style={[styles.subAccordionNumText, contentSubStep === 1 && styles.subAccordionNumTextActive]}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subAccordionTitle}>편집 길이 및 스타일</Text>
                <Text style={styles.subAccordionDesc} numberOfLines={1}>
                  {videoEditPlan ? `${videoEditPlan.duration}초 편집 계획 적용됨` : '15초/30초 중 선택하세요'}
                </Text>
              </View>
            </View>
            {contentSubStep === 1 ? (
              <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {contentSubStep === 1 && (
            <View style={styles.subAccordionBody}>
              {previewMediaMode === 'video' && (
                <VideoEditPlanCard
                  productName={productMeta?.productName}
                  productCategory={undefined}
                  platform={selectedUploadPlatform || undefined}
                  accentColor={undefined}
                  hook={undefined}
                  oneLiner={undefined}
                  hasVideoSelected={stockVideoClip !== null}
                  onPlanGenerated={setVideoEditPlan}
                  hideCopyVariants
                />
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
                {TEMPLATE_STYLES
                  .filter((t) => {
                    const boardMedia = getBoardMediaType(selectedUploadPlatform, selectedBoard);
                    if (t.mediaType === 'both') return true;
                    return t.mediaType === boardMedia;
                  })
                  .map((t) => {
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
                    {(() => {
                      const ct = CONTENT_TYPES.find((t) => t.key === contentType);
                      if (!ct) return '';
                      const boardMedia = getBoardMediaType(selectedUploadPlatform, selectedBoard);
                      return boardMedia === 'image' ? ct.hintImage : ct.hintVideo;
                    })()}
                  </Text>
                </>
              )}

              {/* TTS Voice Picker — collapsed by default to reduce cognitive overload */}
              <TouchableOpacity
                style={styles.customToggle}
                onPress={() => setShowVoicePicker(!showVoicePicker)}
                activeOpacity={0.7}
              >
                <Music2 size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.customToggleText}>
                  {showVoicePicker ? '성우 선택 접기' : '성우 선택 펼치기'}
                </Text>
                {showVoicePicker ? (
                  <ChevronUp size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                ) : (
                  <ChevronDown size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                )}
              </TouchableOpacity>

              {showVoicePicker && (
                <>
              {recommendedVoiceKey && (
                <View style={styles.voiceRecommendBadge}>
                  <Sparkles size={12} color={theme.colors.warning[400]} strokeWidth={2.5} />
                  <Text style={styles.voiceRecommendText}>
                    AI 추천: {TTS_VOICES.find((v) => v.key === recommendedVoiceKey)?.label ?? ''}
                  </Text>
                  {selectedVoiceKey !== recommendedVoiceKey && (
                    <TouchableOpacity
                      style={styles.voiceRecommendApplyBtn}
                      onPress={() => setSelectedVoiceKey(recommendedVoiceKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.voiceRecommendApplyBtnText}>적용</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Category filter chips */}
              <View style={styles.voiceCategoryRow}>
                <TouchableOpacity
                  style={[styles.voiceCategoryChip, voiceCategoryFilter === 'all' && styles.voiceCategoryChipActive]}
                  onPress={() => setVoiceCategoryFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.voiceCategoryChipText, voiceCategoryFilter === 'all' && styles.voiceCategoryChipTextActive]}>전체</Text>
                </TouchableOpacity>
                {(Object.keys(VOICE_CATEGORIES) as VoiceCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.voiceCategoryChip, voiceCategoryFilter === cat && styles.voiceCategoryChipActive]}
                    onPress={() => setVoiceCategoryFilter(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.voiceCategoryChipText, voiceCategoryFilter === cat && styles.voiceCategoryChipTextActive]}>
                      {VOICE_CATEGORIES[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Voice list */}
              <View style={styles.voiceList}>
                {TTS_VOICES
                  .filter((v) => voiceCategoryFilter === 'all' || v.category === voiceCategoryFilter)
                  .map((v) => {
                    const isSelected = selectedVoiceKey === v.key;
                    const isRecommended = recommendedVoiceKey === v.key;
                    return (
                      <TouchableOpacity
                        key={v.key}
                        style={[
                          styles.voiceChip,
                          isSelected && { borderColor: theme.colors.warning[400], backgroundColor: theme.colors.warning[400] + '15' },
                        ]}
                        onPress={() => setSelectedVoiceKey(v.key)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.voiceChipLeft}>
                          <Text style={[styles.voiceChipLabel, isSelected && { color: theme.colors.warning[400] }]}>{v.label}</Text>
                          <Text style={styles.voiceChipDesc}>{v.desc}</Text>
                        </View>
                        {isRecommended && (
                          <View style={styles.recommendBadge}>
                            <Sparkles size={9} color="#fff" strokeWidth={2.5} />
                            <Text style={styles.recommendBadgeText}>추천</Text>
                          </View>
                        )}
                        {isSelected && !isRecommended && (
                          <Check size={14} color={theme.colors.warning[400]} strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
                </>
              )}

              {!showVoicePicker && selectedVoiceKey && (
                <View style={styles.subStepHintBox}>
                  <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
                  <Text style={styles.subStepHintText}>
                    선택된 성우: {TTS_VOICES.find((v) => v.key === selectedVoiceKey)?.label ?? ''}
                  </Text>
                </View>
              )}

              {!showVoicePicker && !selectedVoiceKey && recommendedVoiceKey && (
                <View style={styles.subStepHintBox}>
                  <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.subStepHintText}>
                    AI 추천 성우: {TTS_VOICES.find((v) => v.key === recommendedVoiceKey)?.label ?? ''} · 펼치면 직접 선택 가능
                  </Text>
                </View>
              )}

              <TextInput
                value={contentText}
                onChangeText={setContentText}
                placeholder={(() => {
                  const boardMedia = getBoardMediaType(selectedUploadPlatform, selectedBoard);
                  if (simpleMode) {
                    return boardMedia === 'image'
                      ? "이미지에 넣을 마케팅 문구를 자유롭게 적어보세요..."
                      : "영상에 넣을 마케팅 문구를 자유롭게 적어보세요...";
                  }
                  return boardMedia === 'image'
                    ? "여기에 이미지용 마케팅 문구를 입력하세요..."
                    : "여기에 영상용 마케팅 문구를 입력하세요...";
                })()}
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

              <TouchableOpacity
                style={[styles.subNextBtn, { marginTop: 8 }]}
                onPress={() => setContentSubStep(2)}
                activeOpacity={0.8}
              >
                <Text style={styles.subNextBtnText}>다음: 카피 및 발행</Text>
                <ChevronDown size={14} color="#fff" strokeWidth={2} style={{ transform: [{ rotate: '-90deg' }] }} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Sub-accordion: ③ 최종 확인 ── */}
          <TouchableOpacity
            style={styles.subAccordionHeader}
            onPress={() => setContentSubStep(contentSubStep === 2 ? null : 2)}
            activeOpacity={0.7}
          >
            <View style={styles.subAccordionLeft}>
              <View style={[styles.subAccordionNum, contentSubStep === 2 && styles.subAccordionNumActive]}>
                <Text style={[styles.subAccordionNumText, contentSubStep === 2 && styles.subAccordionNumTextActive]}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subAccordionTitle}>카피 및 발행</Text>
                <Text style={styles.subAccordionDesc} numberOfLines={1}>
                  {contentText.trim() ? 'A/B 카피 입력됨 · 플랫폼 선택 후 발행' : '카피 변형과 발행 플랫폼을 확인하세요'}
                </Text>
              </View>
            </View>
            {contentSubStep === 2 ? (
              <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {contentSubStep === 2 && (
            <View style={styles.subAccordionBody}>
              <View style={styles.subSummaryBox}>
                <View style={styles.subSummaryRow}>
                  <Text style={styles.subSummaryLabel}>템플릿</Text>
                  <Text style={styles.subSummaryValue}>
                    {TEMPLATE_STYLES.find((t) => t.key === selectedTemplate)?.label || '미선택'}
                  </Text>
                </View>
                <View style={styles.subSummaryRow}>
                  <Text style={styles.subSummaryLabel}>콘텐츠 유형</Text>
                  <Text style={styles.subSummaryValue}>
                    {CONTENT_TYPES.find((t) => t.key === contentType)?.label || '미선택'}
                  </Text>
                </View>
                <View style={styles.subSummaryRow}>
                  <Text style={styles.subSummaryLabel}>TTS 성우</Text>
                  <Text style={styles.subSummaryValue}>
                    {TTS_VOICES.find((v) => v.key === selectedVoiceKey)?.label || '미선택'}
                  </Text>
                </View>
                {previewMediaMode === 'video' && (
                  <View style={styles.subSummaryRow}>
                    <Text style={styles.subSummaryLabel}>원본 영상</Text>
                    <Text style={styles.subSummaryValue}>
                      {stockVideoClip ? '선택됨' : '미선택'}
                    </Text>
                  </View>
                )}
                {previewMediaMode === 'video' && videoEditPlan && (
                  <View style={styles.subSummaryRow}>
                    <Text style={styles.subSummaryLabel}>편집 계획</Text>
                    <Text style={styles.subSummaryValue}>
                      {videoEditPlan.duration}초 · {videoEditPlan.segments.length}컷
                    </Text>
                  </View>
                )}
                <View style={styles.subSummaryRow}>
                  <Text style={styles.subSummaryLabel}>마케팅 문구</Text>
                  <Text style={styles.subSummaryValue} numberOfLines={2}>
                    {contentText.trim() ? contentText.trim() : '미입력'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.subFinishBtn}
                onPress={() => {
                  setContentSubStep(null);
                  setExpandedStep('upload');
                  setTimeout(() => stepRefs.current[5]?.measureInWindow((x, y) => {
                    if (typeof window !== 'undefined') window.scrollTo({ top: y, behavior: 'smooth' });
                  }), 100);
                }}
                activeOpacity={0.8}
              >
                <PenLine size={14} color="#fff" strokeWidth={2.5} />
                <Text style={styles.subFinishBtnText}>플랫폼 선택 후 발행으로 이동</Text>
              </TouchableOpacity>
            </View>
          )}
        </PillNavCard>

        {/* STEP 4: AI Analysis & Image */}
        <View
          ref={(ref) => { stepRefs.current[4] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<ScanSearch size={22} color={theme.colors.success[400]} strokeWidth={2.5} />}
          title={previewMediaMode === 'image' ? '분석 이미지 미리보기' : '분석 영상 미리보기'}
          subtitle={previewMediaMode === 'image' ? '상위 1% 수익화 이미지 분석 · 심리 자극 요소 추출 · 미리보기 생성' : '상위 1% 수익화 영상 분석 · 심리 자극 요소 추출 · 미리보기 생성'}
          accentColor={theme.colors.success[400]}
          iconBg={theme.colors.success[500] + '22'}
          stepNumber={4}
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
                  {previewMediaMode === 'image'
                    ? <ImageIcon size={28} color="#fff" strokeWidth={2} />
                    : <Play size={28} color="#fff" strokeWidth={2} fill="#fff" />}
                  <Text style={styles.videoSceneBadgeText}>{previewMediaMode === 'image' ? '이미지 생성 완료' : '영상 생성 완료'}</Text>
                </View>
              ) : videoPreviewScenes ? (
                <View style={styles.videoSceneWrap}>
                  <Text style={styles.videoSceneBadgeText}>{previewMediaMode === 'image' ? '이미지 스토리보드 미리보기' : '스토리보드 미리보기'}</Text>
                </View>
              ) : imagePreviewUri ? (
                <TouchableOpacity style={styles.videoPlayBtn} activeOpacity={0.85} onPress={() => scrollToStep(2)}>
                  {previewMediaMode === 'image'
                    ? <ImageIcon size={28} color="#fff" strokeWidth={2} />
                    : <Play size={28} color="#fff" strokeWidth={2} fill="#fff" />}
                </TouchableOpacity>
              ) : (
                <View style={styles.videoPreviewEmptyInline}>
                  {previewMediaMode === 'image'
                    ? <ImageIcon size={28} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                    : <Clapperboard size={28} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />}
                  <Text style={styles.videoPreviewEmptyInlineText}>
                    {previewMediaMode === 'image'
                      ? '미리보기 생성 버튼을 눌러 이미지 스토리보드를 만들어보세요'
                      : '미리보기 생성 버튼을 눌러 영상 스토리보드를 만들어보세요'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.videoSpecBadge}>
              {previewMediaMode === 'image'
                ? <ImageIcon size={11} color="#fff" strokeWidth={2} />
                : <Clapperboard size={11} color="#fff" strokeWidth={2} />}
              <Text style={styles.videoSpecBadgeText}>
                {viralAnalysisResult
                  ? `${viralAnalysisResult.specs.ratio} · ${viralAnalysisResult.specs.maxDuration}`
                  : selectedUploadPlatform && selectedBoard
                    ? `${BOARD_VIDEO_SPECS[selectedUploadPlatform]?.[selectedBoard]?.ratio ?? '16:9'} · ${BOARD_VIDEO_SPECS[selectedUploadPlatform]?.[selectedBoard]?.maxDuration ?? '60초'}`
                    : '9:16 · 60초'}
              </Text>
            </View>

            {previewMediaMode === 'video' && (
              <>
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
              </>
            )}
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

              {autoDisclosure && disclosureText ? (
                <View style={styles.storyboardDisclosureBadge}>
                  <ShieldCheck size={13} color={theme.colors.success[400]} strokeWidth={2} />
                  <Text style={styles.storyboardDisclosureText} numberOfLines={2}>
                    공정위 제휴 문구 자동 삽입: {disclosureText}
                  </Text>
                </View>
              ) : null}
              {videoPreviewScenes.map((scene, i) => (
                <View key={i} style={styles.videoSceneCard}>
                  <View style={[styles.videoSceneTimeBadge, { backgroundColor: scene.colorTheme.primary }]}>
                    <Text style={styles.videoSceneTimeText}>{scene.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.videoSceneHookText}>{scene.textOverlay}</Text>
                    <Text style={styles.videoSceneDescText} numberOfLines={2}>{scene.subtext}</Text>
                    <Text style={[styles.videoSceneDescText, { color: scene.colorTheme.accent, fontSize: 10, marginTop: 4 }]}>
                      {scene.emotion} · {scene.motionType}
                    </Text>
                  </View>
                  <View style={styles.videoSceneNumber}>
                    <Text style={styles.videoSceneNumberText}>{i + 1}</Text>
                  </View>
                </View>
              ))}

              {/* Multi-angle image upload for TV commercial style */}
              {videoPreviewScenes && (
                <View style={styles.multiImageSection}>
                  <Text style={styles.multiImageTitle}>다각도 사진으로 TV광고풍 영상 만들기</Text>
                  <Text style={styles.multiImageHint}>
                    상품을 여러 각도에서 촬영한 사진을 업로드하면 각 장면에 맞춰 배정됩니다. 부족한 장면은 AI가 자동 생성합니다.
                  </Text>
                  <View style={styles.multiImageRow}>
                    {multiImages.map((img, idx) => (
                      <View key={idx} style={styles.multiImageThumb}>
                        <Image source={{ uri: img.uri }} style={styles.multiImageThumbImg} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.multiImageRemoveBtn}
                          onPress={() => handleRemoveMultiImage(idx)}
                          activeOpacity={0.7}
                        >
                          <X size={12} color="#fff" strokeWidth={2.5} />
                        </TouchableOpacity>
                        <Text style={styles.multiImageLabel}>{idx + 1}번</Text>
                      </View>
                    ))}
                    {multiImages.length < 4 && (
                      <TouchableOpacity
                        style={styles.multiImageAddBtn}
                        onPress={handlePickFromGallery}
                        disabled={mediaLoading}
                        activeOpacity={0.85}
                      >
                        {mediaLoading ? (
                          <Loader size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                        ) : (
                          <Plus size={20} color={theme.colors.accent[400]} strokeWidth={2} />
                        )}
                        <Text style={styles.multiImageAddText}>사진 추가</Text>
                        <Text style={styles.multiImageAddSub}>{multiImages.length}/4</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {multiImages.length > 0 && multiImages.length < videoPreviewScenes.length && (
                    <TouchableOpacity
                      style={[styles.aiGenBtn, aiImageGenerating && styles.aiGenBtnDisabled]}
                      onPress={handleGenerateAiSceneImages}
                      disabled={aiImageGenerating}
                      activeOpacity={0.85}
                    >
                      {aiImageGenerating ? (
                        <Loader size={14} color="#fff" strokeWidth={2} />
                      ) : (
                        <Sparkles size={14} color="#fff" strokeWidth={2} />
                      )}
                      <Text style={styles.aiGenBtnText}>
                        {aiImageGenerating ? 'AI가 장면 이미지 생성 중...' : `AI로 남은 ${videoPreviewScenes.length - multiImages.length}개 장면 이미지 생성`}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {aiSceneImages.length > 0 && (
                    <View style={styles.aiSceneImagesRow}>
                      <Text style={styles.aiSceneImagesLabel}>AI 생성 이미지 ({aiSceneImages.length})</Text>
                      <View style={styles.aiSceneImagesThumbs}>
                        {aiSceneImages.map((uri, idx) => (
                          <View key={idx} style={styles.multiImageThumb}>
                            <Image source={{ uri }} style={styles.multiImageThumbImg} resizeMode="cover" />
                            <Text style={styles.multiImageLabel}>AI</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Render video from storyboard button */}
              <TouchableOpacity
                style={[styles.renderVideoBtn, (videoRendering || videoRenderComplete) && styles.renderVideoBtnDisabled]}
                onPress={() => {
                  if (videoRendering || videoRenderComplete) return;
                  generatePreviewVideo();
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

              {renderError && (
                <View style={styles.renderCompleteBox}>
                  <Text style={[styles.renderCompleteText, { color: theme.colors.error[400] }]}>
                    {renderError}
                  </Text>
                </View>
              )}

              {renderedVideoUrl && videoRenderComplete && (
                <View style={styles.renderedVideoWrap}>
                  {previewMediaMode === 'video' ? (
                    <>
                      {/* @ts-ignore web-only video element */}
                      <video
                        src={renderedVideoUrl}
                        controls
                        autoPlay
                        loop
                        style={{
                          width: '100%',
                          maxHeight: 400,
                          borderRadius: 12,
                          backgroundColor: '#000',
                        }}
                      />
                    </>
                  ) : (
                    <Image
                      source={{ uri: renderedVideoUrl }}
                      style={{
                        width: '100%',
                        maxHeight: 400,
                        borderRadius: 12,
                        backgroundColor: '#000',
                      }}
                      resizeMode="contain"
                    />
                  )}
                  <View style={styles.renderedVideoActions}>
                    <TouchableOpacity
                      style={styles.renderedDownloadBtn}
                      onPress={() => {
                        if (Platform.OS === 'web' && renderedVideoUrl) {
                          const ext = renderedVideoMime.includes('mp4') ? 'mp4' : 'webm';
                          const a = document.createElement('a');
                          a.href = renderedVideoUrl;
                          a.download = `preview-${Date.now()}.${ext}`;
                          a.click();
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Download size={15} color="#fff" strokeWidth={2} />
                      <Text style={styles.renderedDownloadBtnText}>다운로드</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.renderedRegenBtn}
                      onPress={() => {
                        setRenderedVideoUrl(null);
                        setVideoRenderComplete(false);
                        renderProgress.value = 0;
                      }}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={15} color={theme.colors.dark.text} strokeWidth={2} />
                      <Text style={styles.renderedRegenBtnText}>다시 생성</Text>
                    </TouchableOpacity>
                  </View>
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

        {/* STEP 5: Platform Upload */}
        <View
          ref={(ref) => { stepRefs.current[5] = ref; }}
          collapsable={false}
        />
        <PillNavCard
          icon={<Share2 size={22} color={theme.colors.success[400]} strokeWidth={2.5} />}
          title="최종 확인 후 업로드"
          subtitle="생성 이미지 최종 확인·수정 · 게시판 연결 후 직접 업로드"
          accentColor={theme.colors.success[400]}
          iconBg={theme.colors.success[500] + '22'}
          stepNumber={5}
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
            {(() => {
              const boardMedia = getBoardMediaType(selectedUploadPlatform, selectedBoard);
              return boardMedia === 'image'
                ? '업로드할 플랫폼을 선택하세요. 이미지에 맞는 형식으로 자동 변환됩니다.'
                : '업로드할 플랫폼을 선택하세요. 각 플랫폼에 맞는 영상 형식으로 자동 변환됩니다.';
            })()}
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
                {contentText || (previewMediaMode === 'image' ? '이미지용 마케팅 문구를 입력하면 여기에 표시됩니다.' : '마케팅 문구를 입력하면 여기에 표시됩니다.')}
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
          <Text style={styles.optimizerSectionTitle}>플랫폼별 최적화 캡션</Text>
          <Text style={styles.optimizerSectionDesc}>
            각 플랫폼에 맞춰 제목·본문·해시태그·공정위 문구를 자동 배치합니다. 섹션별 복사 가능.
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
            <Text style={styles.uploadConfirmTitle}>게시판에서 업로드하셨나요?</Text>
            <Text style={styles.uploadConfirmDesc}>
              최종 확인·수정한 콘텐츠를 {UPLOAD_PLATFORMS.find((p) => p.key === showUploadConfirm)?.label} 게시판에서 직접 업로드해주세요. 업로드를 마친 뒤 완료를 누르면 발행 상태가 기록됩니다.
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
  subAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  subAccordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  subAccordionNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  subAccordionNumActive: {
    backgroundColor: theme.colors.warning[400] + '22',
    borderColor: theme.colors.warning[400],
  },
  subAccordionNumText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textDim,
  },
  subAccordionNumTextActive: {
    color: theme.colors.warning[400],
  },
  subAccordionTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  subAccordionDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 1,
  },
  subAccordionBody: {
    marginTop: 6,
    paddingBottom: 4,
  },
  subStepHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    padding: 8,
  },
  subStepHintText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  subNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    marginTop: 10,
  },
  subNextBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  subSummaryBox: {
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    padding: 4,
    gap: 6,
  },
  subSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  subSummaryLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    flexShrink: 0,
  },
  subSummaryValue: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'right',
    flex: 1,
  },
  subFinishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    marginTop: 10,
  },
  subFinishBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  voiceRecommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warning[400] + '12',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  voiceRecommendText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
  },
  voiceRecommendApplyBtn: {
    backgroundColor: theme.colors.warning[400],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  voiceRecommendApplyBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  voiceCategoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  voiceCategoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  voiceCategoryChipActive: {
    backgroundColor: theme.colors.warning[400] + '22',
    borderColor: theme.colors.warning[400],
  },
  voiceCategoryChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  voiceCategoryChipTextActive: {
    color: theme.colors.warning[400],
  },
  voiceList: {
    gap: 6,
    marginBottom: 10,
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  voiceChipLeft: {
    flex: 1,
  },
  voiceChipLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  voiceChipDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 1,
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
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.md,
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
  storyboardDisclosureBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '10',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  storyboardDisclosureText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 16,
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
  multiImageSection: {
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    padding: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  multiImageTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[300],
    marginBottom: 4,
  },
  multiImageHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  multiImageRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  multiImageThumb: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  multiImageThumbImg: {
    width: '100%',
    height: '100%',
  },
  multiImageRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiImageLabel: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  multiImageAddBtn: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '50',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  multiImageAddText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  multiImageAddSub: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  aiGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    marginTop: theme.spacing.sm,
  },
  aiGenBtnDisabled: {
    opacity: 0.6,
  },
  aiGenBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  aiSceneImagesRow: {
    marginTop: theme.spacing.sm,
  },
  aiSceneImagesLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
    marginBottom: 6,
  },
  aiSceneImagesThumbs: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
  renderedVideoWrap: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  renderedVideoActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  renderedDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  renderedDownloadBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  renderedRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  renderedRegenBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
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
    backgroundColor: theme.colors.accent[500] + '18',
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '40',
  },
  extractManualBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  extractHintText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
    marginBottom: 8,
  },
  extractSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent[500] + '18',
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '40',
    marginBottom: 8,
  },
  extractSearchBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
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
  captureImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.md,
  },
  openLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[400] + '12',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  openLinkBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  captureImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[400] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '50',
  },
  captureImageBtnDisabled: {
    opacity: 0.5,
  },
  captureImageBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  captureImageDoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  captureImageDoneText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
  captureErrorBox: {
    backgroundColor: theme.colors.error[400] + '12',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
  },
  captureErrorText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
  captureHintBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
  },
  captureHintText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
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
  boardDescBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginTop: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary[400] + '60',
  },
  boardDescText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
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
});
