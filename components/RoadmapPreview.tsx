import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  Animated,
  Easing,
} from 'react-native';
import {
  Rocket,
  CloudRain,
  Package,
  Shirt,
  X,
  ChevronRight,
  Sparkles,
  Zap,
  TrendingUp,
  Check,
  ArrowRight,
  CircleCheck as CheckCircle2,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';

type RoadmapSlide = {
  icon: typeof Rocket;
  title: string;
  desc: string;
  tag: string;
  tagColor: string;
  status: 'live' | 'beta' | 'preview';
};

const SLIDES: RoadmapSlide[] = [
  {
    icon: Shirt,
    title: 'AI 가상핏 2.0',
    desc: '의류 사진 한 장으로 3-way 스타일 자동 합성 — 데일리·스트릿·스튜디오 무드를 동시 렌더링합니다.',
    tag: 'AI 2.0 프리뷰',
    tagColor: theme.colors.accent[400],
    status: 'preview',
  },
  {
    icon: Package,
    title: '실시간 POS / 재고 연동',
    desc: '오프라인 매장 POS 데이터와 실시간 연동하여 재고 소진 시 자동으로 마감 특가 숏폼을 생성합니다.',
    tag: '실시간 연동 베타',
    tagColor: theme.colors.primary[400],
    status: 'beta',
  },
  {
    icon: CloudRain,
    title: '우천 날씨 트리거 자동화',
    desc: '비·눈·한파 감지 시 즉시 따뜻한 국물·실내 템플릿으로 전환하여 긴급 마케팅 숏폼을 발송합니다.',
    tag: '실시간 연동 베타',
    tagColor: theme.colors.primary[400],
    status: 'beta',
  },
  {
    icon: Sparkles,
    title: '하이퍼 휴먼 엔진',
    desc: '인간의 미세 표정·호흡 패턴까지 학습하여 AI 모델이 실제 인플루언서처럼 자연스럽게 제품을 소개합니다.',
    tag: '프리미엄 얼리버드',
    tagColor: theme.colors.warning[400],
    status: 'preview',
  },
];

const STATUS_BADGE: Record<RoadmapSlide['status'], { label: string; color: string }> = {
  live: { label: 'LIVE', color: theme.colors.success[400] },
  beta: { label: 'BETA', color: theme.colors.primary[400] },
  preview: { label: 'PREVIEW', color: theme.colors.accent[400] },
};

export function RoadmapPreview() {
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [weatherSimOpen, setWeatherSimOpen] = useState(false);
  const [posSimOpen, setPosSimOpen] = useState(false);
  const [weatherSimOn, setWeatherSimOn] = useState(false);
  const [posSimOn, setPosSimOn] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [posLoaded, setPosLoaded] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;

  const handlePosSimulate = () => {
    setPosSimOn(true);
    setPosLoading(true);
    setPosLoaded(false);
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ).stop();
      spinAnim.setValue(0);
      setPosLoading(false);
      setPosLoaded(true);
    }, 2200);
  };

  const spinStyle = {
    transform: [
      {
        rotate: spinAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const nextSlide = () => {
    setSlideIndex((i) => (i + 1 < SLIDES.length ? i + 1 : 0));
  };

  const slide = SLIDES[slideIndex];
  const SlideIcon = slide.icon;
  const statusBadge = STATUS_BADGE[slide.status];

  return (
    <View style={styles.container}>
      {/* Info bar */}
      <TouchableOpacity
        style={styles.infoBar}
        onPress={() => setRoadmapOpen(true)}
        activeOpacity={0.85}
      >
        <View style={styles.infoBarLeft}>
          <Animated.View style={styles.infoBarIconWrap}>
            <Rocket size={18} color="#fff" strokeWidth={2.5} />
          </Animated.View>
          <View style={styles.infoBarText}>
            <Text style={styles.infoBarTitle}>숏커넥트 V2 고기능 로드맵 미리보기</Text>
            <Text style={styles.infoBarSub}>탭하여 미래 기능 체험하기</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Quick access tiles */}
      <View style={styles.tileRow}>
        <TouchableOpacity
          style={styles.tile}
          onPress={() => setWeatherSimOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.tileIconWrap}>
            <CloudRain size={20} color={theme.colors.primary[300]} strokeWidth={2.5} />
          </View>
          <Text style={styles.tileTitle}>우천 트리거</Text>
          <View style={[styles.tileBadge, { backgroundColor: theme.colors.primary[500] + '20' }]}>
            <Text style={[styles.tileBadgeText, { color: theme.colors.primary[300] }]}>BETA</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tile}
          onPress={() => setPosSimOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.tileIconWrap}>
            <Package size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
          </View>
          <Text style={styles.tileTitle}>POS 재고 연동</Text>
          <View style={[styles.tileBadge, { backgroundColor: theme.colors.accent[500] + '20' }]}>
            <Text style={[styles.tileBadgeText, { color: theme.colors.accent[400] }]}>BETA</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tile}
          onPress={() => setRoadmapOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.tileIconWrap}>
            <Shirt size={20} color={theme.colors.warning[400]} strokeWidth={2.5} />
          </View>
          <Text style={styles.tileTitle}>AI 가상핏 2.0</Text>
          <View style={[styles.tileBadge, { backgroundColor: theme.colors.warning[500] + '20' }]}>
            <Text style={[styles.tileBadgeText, { color: theme.colors.warning[400] }]}>PREVIEW</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Roadmap slide modal */}
      <Modal visible={roadmapOpen} transparent animationType="fade" onRequestClose={() => setRoadmapOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.roadmapModal}>
            <View style={styles.roadmapHeader}>
              <View style={styles.roadmapHeaderLeft}>
                <Rocket size={22} color={theme.colors.primary[300]} strokeWidth={2.5} />
                <Text style={styles.roadmapHeaderTitle}>V2 고기능 로드맵</Text>
              </View>
              <TouchableOpacity onPress={() => setRoadmapOpen(false)} activeOpacity={0.7}>
                <X size={22} color={theme.colors.dark.textDim} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.roadmapScroll} showsVerticalScrollIndicator={false}>
              {/* Current slide card */}
              <View style={styles.slideCard}>
                <View style={[styles.slideIconWrap, { backgroundColor: slide.tagColor + '20' }]}>
                  <SlideIcon size={28} color={slide.tagColor} strokeWidth={2.5} />
                </View>
                <View style={styles.slideHeaderRow}>
                  <Text style={styles.slideTitle}>{slide.title}</Text>
                  <View style={[styles.slideStatusBadge, { backgroundColor: statusBadge.color + '20' }]}>
                    <Text style={[styles.slideStatusText, { color: statusBadge.color }]}>{statusBadge.label}</Text>
                  </View>
                </View>
                <Text style={styles.slideDesc}>{slide.desc}</Text>
                <View style={styles.slideTagRow}>
                  <View style={[styles.slideTag, { backgroundColor: slide.tagColor + '15' }]}>
                    <Text style={[styles.slideTagText, { color: slide.tagColor }]}>{slide.tag}</Text>
                  </View>
                </View>
              </View>

              {/* Progress dots */}
              <View style={styles.dotsRow}>
                {SLIDES.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === slideIndex && styles.dotActive]}
                  />
                ))}
              </View>

              {/* Next button */}
              <TouchableOpacity style={styles.slideNextBtn} onPress={nextSlide} activeOpacity={0.85}>
                <Text style={styles.slideNextText}>다음 기능 보기</Text>
                <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>

              {/* Feature list */}
              <View style={styles.featureListWrap}>
                <Text style={styles.featureListLabel}>전체 기능 라인업</Text>
                {SLIDES.map((s, i) => {
                  const Icon = s.icon;
                  const sb = STATUS_BADGE[s.status];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.featureRow, i === slideIndex && styles.featureRowActive]}
                      onPress={() => setSlideIndex(i)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.featureIconWrap, { backgroundColor: s.tagColor + '18' }]}>
                        <Icon size={16} color={s.tagColor} strokeWidth={2.5} />
                      </View>
                      <Text style={styles.featureTitle} numberOfLines={1}>{s.title}</Text>
                      <View style={[styles.featureBadge, { backgroundColor: sb.color + '20' }]}>
                        <Text style={[styles.featureBadgeText, { color: sb.color }]}>{sb.label}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Weather simulator modal */}
      <Modal visible={weatherSimOpen} transparent animationType="fade" onRequestClose={() => setWeatherSimOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.simModal}>
            <View style={styles.simHeader}>
              <View style={styles.simHeaderLeft}>
                <CloudRain size={22} color={theme.colors.primary[300]} strokeWidth={2.5} />
                <Text style={styles.simTitle}>우천 감지 시뮬레이션</Text>
              </View>
              <TouchableOpacity onPress={() => setWeatherSimOpen(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.simBody}>
              <Text style={styles.simDesc}>
                현재 날씨: 맑음{'\n'}
                테스트를 위해 우천 감지 시뮬레이션을 켜시겠습니까?
              </Text>

              <View style={styles.simToggleRow}>
                <Text style={styles.simToggleLabel}>우천 감지 시뮬레이션</Text>
                <Switch
                  value={weatherSimOn}
                  onValueChange={setWeatherSimOn}
                  trackColor={{ false: theme.colors.dark.border, true: theme.colors.primary[500] }}
                  thumbColor="#fff"
                />
              </View>

              {weatherSimOn && (
                <View style={styles.simPreviewCard}>
                  <View style={styles.simPreviewIconWrap}>
                    <CloudRain size={32} color={theme.colors.primary[300]} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.simPreviewTitle}>따뜻한 국물 우천 특화 템플릿</Text>
                  <Text style={styles.simPreviewDesc}>
                    비 오는 날, 따뜻한 국물 요리 매장에 즉시 적용되는 긴급 마케팅 템플릿이 활성화됩니다.
                  </Text>
                  <View style={styles.simPreviewSteps}>
                    <View style={styles.simPreviewStep}>
                      <CheckCircle2 size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                      <Text style={styles.simPreviewStepText}>날씨 감지: 비</Text>
                    </View>
                    <View style={styles.simPreviewStep}>
                      <CheckCircle2 size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                      <Text style={styles.simPreviewStepText}>템플릿 자동 전환: 국물 특화</Text>
                    </View>
                    <View style={styles.simPreviewStep}>
                      <CheckCircle2 size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                      <Text style={styles.simPreviewStepText}>후킹 문구: "비 오는 날엔 이것!"</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.simActionBtn, !weatherSimOn && styles.simActionBtnDisabled]}
                onPress={() => {
                  setWeatherSimOpen(false);
                  setWeatherSimOn(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.simActionText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POS / Inventory simulator modal */}
      <Modal visible={posSimOpen} transparent animationType="fade" onRequestClose={() => setPosSimOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.simModal}>
            <View style={styles.simHeader}>
              <View style={styles.simHeaderLeft}>
                <Package size={22} color={theme.colors.accent[400]} strokeWidth={2.5} />
                <Text style={styles.simTitle}>POS 실시간 재고 연동 시뮬레이터</Text>
              </View>
              <TouchableOpacity onPress={() => setPosSimOpen(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View style={styles.simBody}>
              {!posSimOn && !posLoaded && (
                <>
                  <Text style={styles.simDesc}>
                    오프라인 POS 데이터와 실시간 연동을 시뮬레이션합니다.{'\n'}
                    가상 매장 재고를 불러와 자동 마감 특가 숏폼을 생성합니다.
                  </Text>
                  <TouchableOpacity style={styles.simActionBtn} onPress={handlePosSimulate} activeOpacity={0.85}>
                    <Zap size={18} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.simActionText}>POS 연동 시뮬레이션 시작</Text>
                  </TouchableOpacity>
                </>
              )}

              {posLoading && (
                <View style={styles.posLoadingWrap}>
                  <Animated.View style={spinStyle}>
                    <Package size={36} color={theme.colors.accent[400]} strokeWidth={2.5} />
                  </Animated.View>
                  <Text style={styles.posLoadingText}>POS 데이터 불러오는 중...</Text>
                  <Text style={styles.posLoadingSub}>가상 매장 재고 동기화</Text>
                </View>
              )}

              {posLoaded && !posLoading && (
                <View style={styles.posResultWrap}>
                  <View style={styles.posResultHeader}>
                    <CheckCircle2 size={20} color={theme.colors.success[400]} strokeWidth={2.5} />
                    <Text style={styles.posResultTitle}>재고 연동 완료</Text>
                  </View>

                  <View style={styles.posInventoryCard}>
                    <View style={styles.posInventoryRow}>
                      <Text style={styles.posItemName}>르무통 메이트 발 편한 메리노울 운동화</Text>
                      <View style={styles.posStockWrap}>
                        <Text style={styles.posStockNum}>3</Text>
                        <Text style={styles.posStockUnit}>개 남음</Text>
                      </View>
                    </View>
                    <View style={styles.posAlertRow}>
                      <Zap size={12} color={theme.colors.error[400]} strokeWidth={2.5} />
                      <Text style={styles.posAlertText}>임계치 5개 이하 — 마감 특가 숏폼 자동 생성</Text>
                    </View>
                  </View>

                  <View style={styles.posInventoryCard}>
                    <View style={styles.posInventoryRow}>
                      <Text style={styles.posItemName}>수제 시리얼 바 (오리지널)</Text>
                      <View style={styles.posStockWrap}>
                        <Text style={styles.posStockNum}>12</Text>
                        <Text style={styles.posStockUnit}>개 남음</Text>
                      </View>
                    </View>
                    <View style={styles.posStatusRow}>
                      <Check size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
                      <Text style={styles.posStatusText}>재고 충분</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.simActionBtn}
                    onPress={() => {
                      setPosSimOpen(false);
                      setPosSimOn(false);
                      setPosLoaded(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <TrendingUp size={18} color="#fff" strokeWidth={2.5} />
                    <Text style={styles.simActionText}>마감 특가 숏폼 생성하러 가기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[600] + 'F0',
    ...theme.shadows.glowPrimary,
  },
  infoBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  infoBarIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBarText: {
    flex: 1,
    gap: 2,
  },
  infoBarTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  infoBarSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.75)',
  },
  tileRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  tileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileTitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  tileBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  tileBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  roadmapModal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  roadmapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.border,
  },
  roadmapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roadmapHeaderTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  roadmapScroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  slideCard: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  slideIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  slideStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  slideStatusText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  slideDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
  },
  slideTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  slideTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
  },
  slideTagText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.dark.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary[400],
    width: 20,
  },
  slideNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[600],
  },
  slideNextText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  featureListWrap: {
    marginTop: 20,
    marginBottom: 20,
    gap: 6,
  },
  featureListLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  featureRowActive: {
    borderColor: theme.colors.primary[400] + '40',
    backgroundColor: theme.colors.primary[500] + '08',
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  featureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  featureBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
  },
  simModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  simHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.border,
  },
  simHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  simTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    flexShrink: 1,
  },
  simBody: {
    padding: 18,
    gap: 16,
  },
  simDesc: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 21,
  },
  simToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
  },
  simToggleLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  simPreviewCard: {
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '10',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
  },
  simPreviewIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  simPreviewTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
    textAlign: 'center',
  },
  simPreviewDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  simPreviewSteps: {
    gap: 6,
    alignSelf: 'stretch',
    marginTop: 4,
  },
  simPreviewStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simPreviewStepText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  simActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[600],
  },
  simActionBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  simActionText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  posLoadingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  posLoadingText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  posLoadingSub: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  posResultWrap: {
    gap: 14,
  },
  posResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  posResultTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  posInventoryCard: {
    gap: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  posInventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  posItemName: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  posStockWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  posStockNum: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.error[400],
  },
  posStockUnit: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  posAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  posAlertText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  posStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  posStatusText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
