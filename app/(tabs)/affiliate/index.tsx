import { useState, useCallback, useEffect, useRef } from 'react';
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
  Dimensions,
  Modal,
} from 'react-native';
import {
  ShoppingBag,
  Send,
  Globe,
  ShoppingBasket,
  Hop as Home,
  Ticket,
  TreePalm as Palmtree,
  Store,
  ExternalLink,
  Settings as SettingsIcon,
  ChevronRight,
  TrendingUp,
  Link2,
  Copy,
  Check,
  Camera,
  Image as ImageIcon,
  Film,
  Sparkles,
  Eye,
  Edit3,
  Upload,
  FileText,
  Hash,
  Type,
  ChevronDown,
  ChevronUp,
  Wand as Wand2,
  Loader,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '@/lib/theme';
import { getUserSettings } from '@/lib/settings';
import { fetchRevenueRecords } from '@/lib/revenue';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSubTabBarHeight } from '@/hooks/useSubTabBarHeight';
import { VerticalSectionCard } from '@/components/VerticalSectionCard';
import { StepIndicator } from '@/components/StepIndicator';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';
import { compressImageToBase64 } from '@/lib/imageEdit';
import { pickImageWeb, isWebPlatform } from '@/lib/webImagePicker';
import { saveManualScan, uploadImage } from '@/lib/analysis';
import { friendlyError } from '@/lib/errors';
import type { UserSettings, RevenueRecord } from '@/types/database';

const { width: screenWidth } = Dimensions.get('window');

const PLATFORMS = [
  { key: 'Coupang', label: '쿠팡 파트너스', icon: ShoppingBag, color: '#FF3E3E', signupUrl: 'https://partners.coupang.com/', desc: '쿠팡 상품 링크를 공유하고 수수료를 받으세요' },
  { key: 'Toss', label: '토스 쉐어링크', icon: Send, color: '#0064FF', signupUrl: 'https://sharelink.toss.im/', desc: '토스로 링크를 공유하고 보상을 받으세요' },
  { key: 'BrandConnect', label: '네이버 브랜드커넥트', icon: Globe, color: '#03C75A', signupUrl: 'https://brandconnect.naver.com/about/creator', desc: '네이버 쇼핑 제휴 링크를 발급받으세요' },
  { key: 'OliveYoung', label: '올리브영', icon: ShoppingBasket, color: '#1A1A1A', signupUrl: 'https://www.oliveyoung.co.kr/', desc: '올리브영 상품 링크를 공유하세요' },
  { key: 'TodayHouse', label: '오늘의집', icon: Home, color: '#35C5F0', signupUrl: 'https://ohou.se/', desc: '오늘의집 상품 링크를 공유하세요' },
  { key: 'Kurly', label: '컬리', icon: ShoppingBasket, color: '#5F0080', signupUrl: 'https://kurly.com/', desc: '컬리 상품 링크를 공유하세요' },
  { key: 'MyRealTrip', label: '마이리얼트립', icon: Palmtree, color: '#FF6B35', signupUrl: 'https://www.myrealtrip.com/', desc: '여행 상품 링크를 공유하세요' },
  { key: 'Klook', label: '클룩', icon: Ticket, color: '#FF5722', signupUrl: 'https://www.klook.com/', desc: '여행 활동 링크를 공유하세요' },
] as const;

const UPLOAD_PLATFORMS = [
  { key: 'instagram', label: '인스타그램', icon: Camera, color: '#E1306C' },
  { key: 'blog', label: '네이버 블로그', icon: FileText, color: '#03C75A' },
  { key: 'tiktok', label: '틱톡', icon: Film, color: '#000000' },
  { key: 'twitter', label: '트위터/스레드', icon: Hash, color: '#1DA1F2' },
] as const;

const CONTENT_TYPES = [
  { key: 'copy', label: '마케팅 문구', icon: Type, color: theme.colors.primary[400], hint: '제품을 한 줄로 매력적으로 표현하세요' },
  { key: 'hashtag', label: '해시태그', icon: Hash, color: theme.colors.accent[400], hint: '관련 키워드를 # 과 함께 나열하세요' },
  { key: 'hook', label: '후킹 문장', icon: Sparkles, color: theme.colors.warning[400], hint: '시선을 끄는 첫 문장을 만드세요' },
] as const;

type StepKey = 'media' | 'affiliate' | 'content' | 'preview' | 'upload';

const STEP_ORDER: StepKey[] = ['media', 'affiliate', 'content', 'preview', 'upload'];
const STEP_META: Record<StepKey, { num: number; color: string }> = {
  media: { num: 1, color: theme.colors.primary[400] },
  affiliate: { num: 2, color: theme.colors.accent[400] },
  content: { num: 3, color: theme.colors.warning[400] },
  preview: { num: 4, color: theme.colors.success[400] },
  upload: { num: 5, color: theme.colors.primary[300] },
};

export default function AffiliateScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useSubTabBarHeight();
  const scrollRef = useRef<ScrollView>(null);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  // Step state
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [expandedStep, setExpandedStep] = useState<StepKey | null>('media');

  // Step 1: Media
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  // Step 2: Affiliate link
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');

  // Step 3: Content
  const [contentText, setContentText] = useState('');
  const [contentType, setContentType] = useState<string>('copy');

  // Step 4: Preview
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Step 5: Upload
  const [uploadPlatform, setUploadPlatform] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([getUserSettings(), fetchRevenueRecords(10)]);
      setSettings(s);
      setRevenue(r);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalRevenue = revenue.reduce((sum, r) => sum + (r.amount || 0), 0);

  const toggleStep = (key: StepKey) => {
    setExpandedStep((prev) => (prev === key ? null : key));
  };

  const markCompleted = (key: StepKey) => {
    setCompletedSteps((prev) => new Set(prev).add(key));
  };

  const scrollToNext = (currentKey: StepKey) => {
    const idx = STEP_ORDER.indexOf(currentKey);
    if (idx < STEP_ORDER.length - 1) {
      const nextKey = STEP_ORDER[idx + 1];
      setExpandedStep(nextKey);
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

  const isConfigured = (key: string): boolean => {
    if (!settings) return false;
    if (key === 'Coupang') return !!settings.coupang_partners_id;
    if (key === 'Toss') return !!settings.toss_share_id;
    if (key === 'BrandConnect') return !!settings.naver_shopping_id;
    return false;
  };

  // Step 1: Pick image
  const handlePickPhoto = async () => {
    setMediaLoading(true);
    try {
      if (isWebPlatform()) {
        const images = await pickImageWeb(false, 1);
        if (images.length === 0) {
          setMediaLoading(false);
          return;
        }
        setSelectedImage(images[0].base64);
        setSelectedImageMime(images[0].mimeType);
        setMediaType('photo');
        markCompleted('media');
        scrollToNext('media');
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
        setSelectedImage(base64);
        setSelectedImageMime(mimeType);
        setMediaType('photo');
        markCompleted('media');
        scrollToNext('media');
      }
    } catch (err) {
      setMediaLoading(false);
    }
    setMediaLoading(false);
  };

  const handlePickVideo = async () => {
    if (isWebPlatform()) {
      return;
    }
    setMediaLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        base64: false,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setMediaLoading(false);
        return;
      }
      setSelectedImage(result.assets[0].uri);
      setSelectedImageMime('video/mp4');
      setMediaType('video');
      markCompleted('media');
      scrollToNext('media');
    } catch {
      setMediaLoading(false);
    }
    setMediaLoading(false);
  };

  // Step 2: Save affiliate link
  const handleSaveAffiliate = () => {
    if (!affiliateUrl.trim()) return;
    markCompleted('affiliate');
    scrollToNext('affiliate');
  };

  // Step 3: Save content
  const handleSaveContent = () => {
    if (!contentText.trim()) return;
    markCompleted('content');
    scrollToNext('content');
  };

  // Step 4: Go to editor or upload
  const handleEditInEditor = async () => {
    if (!selectedImage) return;
    try {
      if (mediaType === 'photo') {
        const imageUrl = await uploadImage(selectedImage, selectedImageMime);
        const scanId = await saveManualScan(imageUrl);
        router.push({ pathname: '/result/[id]', params: { id: scanId } });
      }
    } catch (err) {
      // ignore
    }
  };

  const handleConfirmPreview = () => {
    setShowPreviewModal(false);
    markCompleted('preview');
    scrollToNext('preview');
  };

  // Step 5: Upload to platform
  const handleUploadToPlatform = (platformKey: string) => {
    setUploadPlatform(platformKey);
    markCompleted('upload');
  };

  const imagePreviewUri = selectedImage
    ? mediaType === 'photo' && selectedImage.startsWith('data:')
      ? selectedImage
      : mediaType === 'photo'
        ? buildDataUrl(selectedImage, selectedImageMime)
        : selectedImage
    : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <Text style={styles.headerTitle}>제휴쇼핑 제작</Text>
        <Text style={styles.headerSubtext}>
          아래 5단계를 위에서부터 차례대로 따라 하시면 됩니다
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <TrendingUp size={20} color={theme.colors.success[400]} strokeWidth={2} />
            <View>
              <Text style={styles.summaryLabel}>총 수익</Text>
              <Text style={styles.summaryValue}>
                {totalRevenue.toLocaleString('ko-KR')}원
              </Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryCount}>{revenue.length}건</Text>
            <Text style={styles.summaryCountLabel}>최근 기록</Text>
          </View>
        </View>

        {/* Step indicator */}
        <View style={{ alignSelf: 'center', marginBottom: theme.spacing.md }}>
          <StepIndicator activeStep={Math.min(completedSteps.size + 1, 4)} />
        </View>

        {/* STEP 1: Media import */}
        <VerticalSectionCard
          icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
          title="1. 사진 / 영상 불러오기"
          desc="판매할 상품의 사진이나 영상을 준비하세요."
          iconBg={theme.colors.primary[500] + '18'}
          accentColor={STEP_META.media.color}
          stepNumber={1}
          completed={completedSteps.has('media')}
        >
          <View style={styles.mediaHintBox}>
            <Text style={styles.mediaHintText}>
              갤러리에서 사진이나 동영상을 선택하세요. 사진은 AI가 자동으로 분석하고, 영상은 숏폼 제작에 활용됩니다.
            </Text>
          </View>

          {imagePreviewUri && (
            <View style={styles.mediaPreviewWrap}>
              <Image
                source={{ uri: imagePreviewUri }}
                style={styles.mediaPreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.mediaRemoveBtn}
                onPress={() => { setSelectedImage(null); setMediaType(null); setCompletedSteps((prev) => { const n = new Set(prev); n.delete('media'); return n; }); }}
                activeOpacity={0.7}
              >
                <Text style={styles.mediaRemoveText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}

          {!imagePreviewUri && (
            <View style={styles.mediaBtnRow}>
              <TouchableOpacity style={styles.mediaBtn} onPress={handlePickPhoto} activeOpacity={0.7} disabled={mediaLoading}>
                {mediaLoading ? (
                  <Loader size={20} color={theme.colors.primary[300]} strokeWidth={2} />
                ) : (
                  <ImageIcon size={20} color={theme.colors.primary[300]} strokeWidth={2} />
                )}
                <Text style={styles.mediaBtnText}>사진 선택</Text>
              </TouchableOpacity>

              {!isWebPlatform() && (
                <TouchableOpacity style={styles.mediaBtnSecondary} onPress={handlePickVideo} activeOpacity={0.7} disabled={mediaLoading}>
                  <Film size={20} color={theme.colors.accent[300]} strokeWidth={2} />
                  <Text style={styles.mediaBtnSecondaryText}>동영상 선택</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </VerticalSectionCard>

        {/* STEP 2: Affiliate link */}
        <VerticalSectionCard
          icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
          title="2. 제휴 링크 연결"
          desc="상품의 제휴 링크를 입력하면 단축 URL이 자동 생성됩니다."
          iconBg={theme.colors.accent[500] + '18'}
          accentColor={STEP_META.affiliate.color}
          stepNumber={2}
          completed={completedSteps.has('affiliate')}
        >
          <View style={styles.affiliateHintBox}>
            <Text style={styles.affiliateHintText}>
              아래 플랫폼에 가입하고 파트너스 ID를 설정하면, 링크에 자동으로 추적 코드가 포함됩니다.
            </Text>
          </View>

          {/* Platform quick select */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.platformChipsScroll}>
            {PLATFORMS.slice(0, 4).map((p) => {
              const Icon = p.icon;
              const isActive = selectedPlatform === p.key;
              const configured = isConfigured(p.key);
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.platformChip, isActive && { borderColor: p.color, backgroundColor: p.color + '15' }]}
                  onPress={() => { setSelectedPlatform(p.key); setAffiliateUrl(''); }}
                  activeOpacity={0.7}
                >
                  <Icon size={14} color={p.color} strokeWidth={2} />
                  <Text style={[styles.platformChipText, isActive && { color: p.color }]}>{p.label.split(' ')[0]}</Text>
                  {configured && <Check size={10} color={theme.colors.success[400]} strokeWidth={3} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TextInput
            style={styles.affiliateInput}
            value={affiliateUrl}
            onChangeText={setAffiliateUrl}
            placeholder="제휴 링크 URL을 여기에 붙여넣으세요"
            placeholderTextColor={theme.colors.dark.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline
          />

          <View style={styles.affiliateActionRow}>
            <TouchableOpacity
              style={styles.affiliateSaveBtn}
              onPress={handleSaveAffiliate}
              activeOpacity={0.7}
              disabled={!affiliateUrl.trim()}
            >
              <Check size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.affiliateSaveBtnText}>링크 저장</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.affiliateSettingsBtn}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
            >
              <SettingsIcon size={14} color={theme.colors.primary[300]} strokeWidth={2} />
              <Text style={styles.affiliateSettingsBtnText}>ID 설정</Text>
            </TouchableOpacity>
          </View>

          {/* Platform list (collapsible) */}
          <PlatformListSection
            platforms={PLATFORMS}
            isConfigured={isConfigured}
            copiedPlatform={copiedPlatform}
            onOpenUrl={handleOpenUrl}
            onCopySignup={handleCopySignup}
          />
        </VerticalSectionCard>

        {/* STEP 3: Content creation */}
        <VerticalSectionCard
          icon={<Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
          title="3. 마케팅 소재 만들기"
          desc="제품을 소개할 문구, 해시태그, 후킹 문장을 작성하세요."
          iconBg={theme.colors.warning[500] + '18'}
          accentColor={STEP_META.content.color}
          stepNumber={3}
          completed={completedSteps.has('content')}
        >
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

          <TextInput
            style={styles.contentInput}
            value={contentText}
            onChangeText={setContentText}
            placeholder="여기에 마케팅 문구를 입력하세요..."
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
              <Check size={16} color="#fff" strokeWidth={2.5} />
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
        </VerticalSectionCard>

        {/* STEP 4: Preview & edit */}
        <VerticalSectionCard
          icon={<Eye size={20} color={theme.colors.success[400]} strokeWidth={2} />}
          title="4. 미리보기 및 수정"
          desc="완성된 콘텐츠를 확인하고 필요하면 수정하세요."
          iconBg={theme.colors.success[500] + '18'}
          accentColor={STEP_META.preview.color}
          stepNumber={4}
          completed={completedSteps.has('preview')}
        >
          <View style={styles.previewSummary}>
            {imagePreviewUri && (
              <Image source={{ uri: imagePreviewUri }} style={styles.previewThumb} resizeMode="cover" />
            )}
            <View style={styles.previewInfo}>
              {mediaType && (
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>{mediaType === 'photo' ? '사진' : '동영상'}</Text>
                </View>
              )}
              {affiliateUrl.trim() && (
                <Text style={styles.previewLink} numberOfLines={1}>링크: {affiliateUrl}</Text>
              )}
              {contentText.trim() && (
                <Text style={styles.previewContent} numberOfLines={3}>{contentText}</Text>
              )}
              {!imagePreviewUri && !affiliateUrl.trim() && !contentText.trim() && (
                <Text style={styles.previewEmpty}>아직 입력된 내용이 없습니다. 위 단계부터 진행하세요.</Text>
              )}
            </View>
          </View>

          <View style={styles.previewActionRow}>
            <TouchableOpacity
              style={styles.previewEditBtn}
              onPress={handleEditInEditor}
              activeOpacity={0.7}
              disabled={!selectedImage}
            >
              <Edit3 size={16} color={theme.colors.success[400]} strokeWidth={2} />
              <Text style={styles.previewEditBtnText}>편집기에서 수정</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewConfirmBtn}
              onPress={() => setShowPreviewModal(true)}
              activeOpacity={0.7}
              disabled={!imagePreviewUri && !contentText.trim()}
            >
              <Eye size={16} color="#fff" strokeWidth={2} />
              <Text style={styles.previewConfirmBtnText}>최종 확인</Text>
            </TouchableOpacity>
          </View>
        </VerticalSectionCard>

        {/* STEP 5: Platform upload */}
        <VerticalSectionCard
          icon={<Upload size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
          title="5. 플랫폼에 업로드"
          desc="완성된 콘텐츠를 SNS나 블로그에 바로 공유하세요."
          iconBg={theme.colors.primary[500] + '18'}
          accentColor={STEP_META.upload.color}
          stepNumber={5}
          completed={completedSteps.has('upload')}
        >
          <Text style={styles.uploadHint}>
            업로드할 플랫폼을 선택하세요. 각 플랫폼에 맞는 형식으로 자동 변환됩니다.
          </Text>

          <View style={styles.uploadGrid}>
            {UPLOAD_PLATFORMS.map((p) => {
              const Icon = p.icon;
              const isUploaded = uploadPlatform === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.uploadCard, isUploaded && { borderColor: p.color, backgroundColor: p.color + '12' }]}
                  onPress={() => handleUploadToPlatform(p.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.uploadIcon, { backgroundColor: p.color + '20' }]}>
                    <Icon size={22} color={p.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.uploadLabel}>{p.label}</Text>
                  {isUploaded ? (
                    <View style={styles.uploadDoneBadge}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                      <Text style={styles.uploadDoneText}>완료</Text>
                    </View>
                  ) : (
                    <Text style={styles.uploadBtn}>업로드</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {uploadPlatform && (
            <View style={styles.uploadSuccessBox}>
              <Check size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.uploadSuccessText}>
                {UPLOAD_PLATFORMS.find((p) => p.key === uploadPlatform)?.label}에 업로드가 완료되었습니다. 제휴 링크를 통해 수익이 발생하면 '분석' 탭에서 확인할 수 있습니다.
              </Text>
            </View>
          )}
        </VerticalSectionCard>

        {/* Recent revenue */}
        <Text style={styles.sectionTitle}>최근 수익 기록</Text>
        {revenue.length === 0 ? (
          <View style={styles.emptyRevenue}>
            <Link2 size={40} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
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
                <Text style={styles.revenueAmount}>{r.amount.toLocaleString('ko-KR')}원</Text>
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
      </ScrollView>

      {/* Final preview modal */}
      <Modal visible={showPreviewModal} transparent animationType="slide" onRequestClose={() => setShowPreviewModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Eye size={20} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.modalTitle}>최종 미리보기</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {imagePreviewUri && (
                <Image source={{ uri: imagePreviewUri }} style={styles.modalImage} resizeMode="contain" />
              )}

              {contentText.trim() && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>마케팅 문구</Text>
                  <Text style={styles.modalContentText}>{contentText}</Text>
                </View>
              )}

              {affiliateUrl.trim() && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>제휴 링크</Text>
                  <Text style={styles.modalLinkText} numberOfLines={2}>{affiliateUrl}</Text>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionLabel}>선택 플랫폼</Text>
                <Text style={styles.modalPlatformText}>
                  {selectedPlatform || '미선택'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalEditBtn}
                onPress={() => setShowPreviewModal(false)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color={theme.colors.dark.text} strokeWidth={2} />
                <Text style={styles.modalEditBtnText}>수정하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmPreview}
                activeOpacity={0.85}
              >
                <Check size={18} color="#fff" strokeWidth={2.5} />
                <Text style={styles.modalConfirmBtnText}>확인 완료</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PlatformListSection({
  platforms,
  isConfigured,
  copiedPlatform,
  onOpenUrl,
  onCopySignup,
}: {
  platforms: typeof PLATFORMS;
  isConfigured: (key: string) => boolean;
  copiedPlatform: string | null;
  onOpenUrl: (url: string) => void;
  onCopySignup: (platform: string, url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visiblePlatforms = expanded ? platforms : platforms.slice(0, 3);

  return (
    <View>
      {visiblePlatforms.map((p) => {
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
                    <Check size={10} color="#fff" strokeWidth={3} />
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

      <TouchableOpacity
        style={styles.platformToggleBtn}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.platformToggleText}>
          {expanded ? '접기' : `전체 ${platforms.length}개 플랫폼 보기`}
        </Text>
        {expanded ? (
          <ChevronUp size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
        ) : (
          <ChevronDown size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.glass.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md + 4,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.glass.border,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginTop: 2,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryCount: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  summaryCountLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  mediaHintBox: {
    backgroundColor: theme.colors.primary[500] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary[400] + '60',
  },
  mediaHintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  mediaPreviewWrap: {
    position: 'relative',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    aspectRatio: 1.2,
    backgroundColor: '#000',
  },
  mediaPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  mediaRemoveText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  mediaBtnRow: {
    flexDirection: 'row',
    gap: 10,
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
  },
  mediaBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  mediaBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '12',
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '30',
  },
  mediaBtnSecondaryText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  affiliateHintBox: {
    backgroundColor: theme.colors.accent[500] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent[400] + '60',
  },
  affiliateHintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  platformChipsScroll: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginRight: 6,
  },
  platformChipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
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
  platformToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
  },
  platformToggleText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
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
  previewSummary: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm,
  },
  previewThumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
  },
  previewInfo: {
    flex: 1,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary[500] + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    marginBottom: 4,
  },
  previewBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  previewLink: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  previewContent: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 17,
  },
  previewEmpty: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  previewEditBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  previewConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  previewConfirmBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: theme.spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modalCloseText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
    marginBottom: theme.spacing.md,
  },
  modalSection: {
    marginBottom: theme.spacing.md,
  },
  modalSectionLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  modalContentText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 20,
  },
  modalLinkText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.primary[300],
  },
  modalPlatformText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.sm,
  },
  modalEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  modalEditBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  modalConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  modalConfirmBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
