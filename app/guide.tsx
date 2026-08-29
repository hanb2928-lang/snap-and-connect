import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  Camera, Sparkles, Info, ExternalLink, Link2, ChevronDown, ChevronRight,
  ChartBar as BarChart3, Flame, FolderOpen, ClipboardList, CalendarDays,
  MessageSquare, Bug, Send, Film, LayoutTemplate, BookOpen, PenLine,
  Image as ImageIcon, Scissors, Type, Stamp, Share2, Lightbulb, Smartphone,
  Clapperboard, Music2, Instagram, Youtube, Globe, Shirt, ShoppingBag,
  Wand as Wand2, Target, Users, Layers, Store, Video, Shuffle, TrendingUp,
  History, BookMarked,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingModal } from '@/components/OnboardingModal';

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, paddingTop: 16 }]}
      showsVerticalScrollIndicator={false}
    >

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>네이버 쇼핑커넥트 안내</Text>
        <Text style={styles.sectionDesc}>
          네이버 쇼핑커넥트는 브랜드커넥트(banner.naver.com)에서 크리에이터로 가입 후, 상품별로 전용 수수료 링크를 직접 발급받는 시스템입니다. 단순한 ID 입력으로는 자동 추적 링크를 만들 수 없습니다.
        </Text>
        <View style={styles.guideCard}>
          <Text style={styles.guideStepTitle} numberOfLines={2}>이용 방법</Text>
          <Text style={styles.guideStepText}>
            1. 네이버 브랜드커넥트에 크리에이터로 가입합니다{'\n'}
            2. 채널(블로그/인스타/유튜브)을 연동합니다{'\n'}
            3. 상품 찾기에서 홍보할 상품을 선택합니다{'\n'}
            4. 링크 발급 버튼으로 전용 수수료 링크를 받습니다{'\n'}
            5. 발급받은 링크를 콘텐츠에 삽입합니다
          </Text>
        </View>
        <TouchableOpacity
          style={styles.guideLinkButton}
          onPress={() => Linking.openURL('https://brandconnect.naver.com/about/creator/').catch(() => {})}
          activeOpacity={0.8}
        >
          <ExternalLink size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.guideLinkText}>네이버 브랜드커넥트 바로가기</Text>
        </TouchableOpacity>
        <View style={styles.noticeCard}>
          <Info size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.noticeText}>
            본 앱은 AI가 상품을 식별하고 네이버 쇼핑 검색 링크를 자동 생성합니다. 정확한 수수료 추적을 위해서는 브랜드커넥트에서 발급받은 개별 링크를 직접 사용하세요.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>콘텐츠 제작 순서 가이드</Text>
        <Text style={styles.sectionDesc}>
          앱에서 만들 수 있는 콘텐츠의 전체 제작 흐름을 한눈에 보여줍니다
        </Text>
        <View style={styles.flowContainer}>
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.primary[500] }]}>
              <Camera size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 1</Text>
              <Text style={styles.flowStepTitle}>촬영 & AI 분석</Text>
              <Text style={styles.flowStepDesc}>
                상품을 촬영하면 AI가 제품명, 카테고리, 가격대를 자동 식별합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.accent[500] }]}>
              <Link2 size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 2</Text>
              <Text style={styles.flowStepTitle}>쇼핑 매칭 & 제휴 링크</Text>
              <Text style={styles.flowStepDesc}>
                네이버/쿠팡에서 동일 상품을 찾고 제휴 수수료 링크를 자동 생성합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.warning[400] }]}>
              <LayoutTemplate size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 3</Text>
              <Text style={styles.flowStepTitle}>숏폼 카드 & 템플릿</Text>
              <Text style={styles.flowStepDesc}>
                사진 위에 가격, 한줄평 스티커를 합성한 카드를 만듭니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.error[400] }]}>
              <Film size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 4</Text>
              <Text style={styles.flowStepTitle}>캐러셀 & 숏폼 영상</Text>
              <Text style={styles.flowStepDesc}>
                여러 장의 카드를 슬라이드 캐러셀이나 숏폼 영상으로 제작합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.success[500] }]}>
              <BookOpen size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 5</Text>
              <Text style={styles.flowStepTitle}>만화 콘텐츠 제작</Text>
              <Text style={styles.flowStepDesc}>
                상품을 활용한 4컷 만화 시나리오를 AI로 생성하고 이미지로 완성합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.primary[400] }]}>
              <Send size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 6</Text>
              <Text style={styles.flowStepTitle}>공유 & 수익 추적</Text>
              <Text style={styles.flowStepDesc}>
                인스타, 틱톡, 카카오톡으로 공유하고 클릭수와 수익을 추적합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.accent[500] }]}>
              <Shirt size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 7</Text>
              <Text style={styles.flowStepTitle}>가상 피팅 & 컷 갤러리</Text>
              <Text style={styles.flowStepDesc}>
                상품 사진으로 가상 착용 컷과 다양한 각도의 컷을 AI로 생성합니다
              </Text>
            </View>
          </View>
          <View style={styles.flowConnector} />
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.success[500] }]}>
              <Target size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 8</Text>
              <Text style={styles.flowStepTitle}>바이럴 예측 & 트렌드 분석</Text>
              <Text style={styles.flowStepDesc}>
                콘텐츠의 바이럴 잠재력을 예측하고 트렌드 매칭으로 최적화합니다
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>콘텐츠 제작 기능 설명서</Text>
        <Text style={styles.sectionDesc}>
          각 제작 기능을 탭하면 상세 사용법이 펼쳐집니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<ImageIcon size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 카드 (템플릿) 만들기"
            steps={[
              '결과 화면에서 "숏폼 카드" 버튼을 탭합니다',
              'AI가 제공한 한줄평과 가격이 사진 위에 스티커로 자동 합성됩니다',
              '스타일(매거진/볼드/미니멀/피드)을 선택해 디자인을 바꿀 수 있습니다',
              '가격, 한줄평, 해시태그 텍스트를 직접 수정할 수 있습니다',
              '배경 제거 버튼으로 깔끔한 상품 이미지를 만들 수 있습니다',
              '색상 테마를 변경해 브랜드에 맞는 디자인을 적용합니다',
              '완성된 카드를 저장하거나 바로 공유할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<LayoutTemplate size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="캐러셀 (여러 장 슬라이드) 만들기"
            steps={[
              '결과 화면에서 "캐러셀" 버튼을 탭합니다',
              '여러 상품이나 여러 각도의 사진을 순서대로 배치합니다',
              '각 슬라이드마다 개별 텍스트와 가격을 입력할 수 있습니다',
              '슬라이드 순서를 드래그하여 변경할 수 있습니다',
              '전체 슬라이드에 통일된 스타일을 적용합니다',
              '인스타그램 게시물용으로 세로 크기에 맞춰 자동 조정됩니다',
              '완성된 캐러셀을 이미지로 저장하거나 공유합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Film size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="숏폼 영상 (클립) 만들기"
            steps={[
              '결과 화면에서 "숏폼 영상" 버튼을 탭합니다',
              '상품 사진과 텍스트를 이어붙여 짧은 영상을 만듭니다',
              '화면 전환 효과와 텍스트 애니메이션이 자동 적용됩니다',
              '배경 음악(업비트/차분/에너지/없음)과 모션 효과(켄번스/줌/팬)를 선택할 수 있습니다',
              '고급 설정에서 화면 비율(세로/가로/정사각형)과 템플릿 스타일을 바꿀 수 있습니다',
              '하이브리드 모드(사진→만화 전환)를 켜면 영상 중반에 만화 효과가 적용됩니다',
              '영상 길이(10초/15초/20초/30초)를 선택합니다 - 기본 15초',
              '세로(9:16) 비율로 틱톡/인스타 릴스/유튜브 쇼츠에 최적화됩니다',
              '완성된 영상을 갤러리에 저장하거나 클라우드에 저장 후 각 플랫폼에 업로드합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<BookOpen size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="만화 숏폼 (만화 영상) 만들기"
            steps={[
              '결과 화면에서 "만화 숏폼" 버튼을 탭합니다',
              'AI가 상품을 활용한 만화 시나리오를 자동 생성합니다 (싱글/2컷/3컷 분할)',
              '각 컷의 대사와 상황을 직접 수정할 수 있습니다',
              '웹툰 화풍(인스타툰/B급 병맛/미식 요리툰/아메리칸 코믹스/감성 지브리풍)을 선택합니다',
              'AI 성우 목소리(밝은 20대/차분한 나레이션/B급 억양)를 선택해 더빙할 수 있습니다',
              '고급 설정에서 영상 길이(10초/15초/20초/30초)를 선택합니다 - 컷 수에 따라 자동 추천',
              'AI 내레이션 더빙, 감정 표정 오버레이, MBTI 맞춤형 해설을 추가할 수 있습니다',
              '연작 에피소드 모드를 켜면 "1일차-3일차-7일차" 시간 흐름 스토리로 만들어집니다',
              '사운드 펀치 효과로 만화 효과음을 시간대별로 추가할 수 있습니다',
              '효과음은 감정에 따라 자동 매칭됩니다 (놀람: 헐 대박!, 행복: 샤방~, 확신: 따봉! 등)',
              '완성된 만화 숏폼을 저장하거나 틱톡/인스타/쇼츠로 바로 공유합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Film size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="타임라인 숏폼 (연작 에피소드) 만들기"
            steps={[
              '결과 화면에서 "만화 숏폼" 버튼을 탭합니다',
              '고급 설정에서 "연작 에피소드 모드"를 켭니다',
              '1일차-3일차-7일차 등 시간 흐름 스토리로 만화 숏폼이 자동 제작됩니다',
              '각 일차별 시나리오와 대사를 직접 수정할 수 있습니다',
              '웹툰 화풍과 내레이션 더빙을 함께 적용할 수 있습니다',
              '완성된 타임라인 숏폼을 저장하거나 틱톡/인스타/쇼츠로 공유합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<PenLine size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="카피라이팅 (글 자동 생성)"
            steps={[
              '결과 화면에서 "카피 작성" 버튼을 탭합니다',
              'AI가 상품 분석 결과를 바탕으로 마케팅 문구를 생성합니다',
              '톤앤매너(캐주얼/전문/감성/유머)를 선택할 수 있습니다',
              '생성된 카피를 그대로 복사하거나 수정 후 사용합니다',
              '해시태그 추천도 함께 제공됩니다',
              '여러 버전의 카피를 비교하고 가장 좋은 것을 선택합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Type size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="리뷰 & 한줄평 작성"
            steps={[
              '결과 화면에서 "리뷰 입력" 버튼을 탭합니다',
              '직접 상품에 대한 한줄평을 작성하거나 AI 추천을 받습니다',
              '작성한 리뷰는 숏폼 카드와 캐러셀에 자동 반영됩니다',
              '리뷰를 수정하면 연결된 모든 콘텐츠가 업데이트됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Scissors size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="배경 제거 & 이미지 편집"
            steps={[
              '결과 화면에서 "배경 제거" 버튼을 탭합니다',
              'AI가 상품의 배경을 자동으로 감지하고 제거합니다',
              '투명 배경 이미지로 저장되어 다양한 디자인에 활용 가능합니다',
              '제거된 이미지는 숏폼 카드, 캐러셀, 만화에 자동 적용됩니다',
              '필요시 배경 색상을 직접 변경할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 갤러리"
            steps={[
              '결과 화면에서 "가상 피팅" 섹션을 확인합니다',
              'AI가 상품 사진을 바탕으로 다양한 착용 장면을 자동 생성합니다',
              '의류, 액세서리 등 착용 가능한 상품에 최적화되어 있습니다',
              '생성된 피팅 이미지를 탭하면 확대해서 볼 수 있습니다',
              '"이 이미지 사용" 버튼으로 피팅 이미지를 메인으로 설정할 수 있습니다',
              '생성된 이미지를 저장하거나 숏폼 카드에 활용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Layers size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="가상 컷 갤러리"
            steps={[
              '결과 화면에서 "가상 컷" 섹션을 확인합니다',
              'AI가 상품을 다양한 각도와 배경에서 촬영한 것 같은 컷을 생성합니다',
              '스튜디오, 자연, 매장, 그라데이션 등 다양한 배경으로 자동 합성합니다',
              '생성된 컷을 탭하면 확대해서 확인할 수 있습니다',
              '"이 이미지 사용" 버튼으로 원하는 컷을 메인 이미지로 설정합니다',
              '여러 컷을 캐러셀이나 숏폼 영상에 활용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천"
            steps={[
              '결과 화면에서 "AI 스타일" 섹션을 확인합니다',
              'AI가 상품 카테고리와 분위기에 맞는 디자인 스타일을 추천합니다',
              '추천된 스타일을 탭하면 숏폼 카드에 즉시 적용됩니다',
              '스타일을 변경하면 텍스트 배치, 색상, 폰트가 자동으로 조정됩니다',
              '마음에 드는 스타일을 선택하면 모든 콘텐츠에 일관되게 적용됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측"
            steps={[
              '결과 화면에서 "바이럴 예측" 섹션을 확인합니다',
              'AI가 콘텐츠의 바이럴 잠재력을 점수로 예측합니다',
              '예측 점수는 후킹력, 트렌드 적합도, 공유 가능성을 종합 평가합니다',
              '개선 제안을 탭하면 점수를 높일 수 있는 팁을 확인할 수 있습니다',
              '제안에 따라 카피나 스타일을 수정하면 예측 점수가 다시 계산됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Users size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="페르소나 시뮬레이터"
            steps={[
              '결과 화면에서 "페르소나 시뮬레이터" 섹션을 확인합니다',
              '타겟 고객의 페르소나(연령, 성별, 관심사)를 선택합니다',
              'AI가 해당 페르소나 관점에서 상품을 어떻게 평가할지 시뮬레이션합니다',
              '예상 반응, 구매 확률, 주요 어필 포인트를 확인할 수 있습니다',
              '시뮬레이션 결과를 바탕으로 마케팅 카피를 최적화할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화"
            steps={[
              '결과 화면에서 "글로벌 현지화" 섹션을 확인합니다',
              '마케팅 카피를 영어, 일본어, 중국어 등 다국어로 번역합니다',
              '단순 번역이 아닌 각국 문화와 SNS 트렌드에 맞게 현지화합니다',
              '국가별 인기 해시태그와 마케팅 톤을 자동 반영합니다',
              '번역된 카피를 탭하면 클립보드에 복사됩니다',
              '해외 진출 시 각국 플랫폼에 맞춘 콘텐츠를 빠르게 제작할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shuffle size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="멀티 플랫폼 익스포트"
            steps={[
              '결과 화면에서 "멀티 플랫폼 익스포트" 섹션을 확인합니다',
              '인스타그램, 틱톡, 유튜브 쇼츠 세 플랫폼에 맞춘 이미지를 한 번에 생성합니다',
              '각 플랫폼별 최적 화면 비율과 텍스트 위치가 자동 조정됩니다',
              '플랫폼별 권장 해시태그와 캡션 스타일이 자동 적용됩니다',
              '생성된 이미지를 각 플랫폼에 맞춰 개별 저장할 수 있습니다',
              '세 플랫폼 동시 업로드로 노출을 극대화할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭"
            steps={[
              '결과 화면에서 "트렌드 매칭" 섹션을 확인합니다',
              'AI가 현재 SNS에서 유행하는 키워드와 상품을 자동 매칭합니다',
              '실시간 트렌드 키워드를 탭하면 관련 마케팅 카피가 자동 생성됩니다',
              '트렌드에 맞춘 해시태그 추천도 함께 제공됩니다',
              '시의성 있는 콘텐츠로 알고리즘 노출을 높일 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보"
            steps={[
              '결과 화면에서 "내 가게 정보" 섹션을 확인합니다',
              '오프라인 매장 정보(주소, 영업시간, 전화번호)를 등록할 수 있습니다',
              '등록한 가게 정보가 숏폼 카드와 공유 콘텐츠에 자동 포함됩니다',
              '고객이 콘텐츠를 보고 매장 위치를 바로 확인할 수 있습니다',
              '온·오프라인 연계 마케팅에 활용하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Video size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="비디오 임포트"
            steps={[
              '결과 화면에서 "비디오 임포트" 기능을 사용합니다',
              '기존에 촬영한 영상을 불러와 숏폼 콘텐츠로 변환합니다',
              '영상에서 핵심 구간을 자동 추출하여 숏폼으로 만듭니다',
              '추출된 구간에 텍스트와 스티커를 추가할 수 있습니다',
              '기존 영상 자산을 재활용하여 콘텐츠 제작 시간을 단축하세요',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기능 소개</Text>
        <View style={styles.card}>
          <FeatureRow
            icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="실물 촬영 & 쇼핑 매칭"
            desc="신발, 조명, 옷 등을 촬영하면 AI가 제품을 식별하고 네이버 쇼핑 상품을 매칭합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="제휴 링크 자동 생성"
            desc="설정한 파트너스 ID로 수수료 링크를 즉시 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 템플릿 자동 완성"
            desc="사진 위에 가격과 추천 한줄평 스티커가 합성된 카드를 자동 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Send size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="SNS 원터치 공유 (아코디언)"
            desc="공유 버튼을 탭하면 네이버클립·네이버TV·인스타·카카오톡·블로그 버튼이 펼쳐집니다"
          />
          <Divider />
          <FeatureRow
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 & 컷 갤러리"
            desc="상품 사진으로 AI가 다양한 착용 장면과 각도의 컷을 자동 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천"
            desc="상품에 맞는 디자인 스타일을 AI가 추천하고 원탭으로 적용합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측 & 페르소나 시뮬레이터"
            desc="콘텐츠의 바이럴 잠재력을 예측하고 타겟 고객 관점의 반응을 시뮬레이션합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화 & 멀티 플랫폼 익스포트"
            desc="마케팅 카피를 다국어로 현지화하고, 인스타·틱톡·쇼츠 맞춤 이미지를 한 번에 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭 & 트렌드 카피"
            desc="실시간 SNS 트렌드 키워드와 상품을 자동 매칭하여 시의성 있는 카피를 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보 & 오프라인 연계"
            desc="매장 정보를 등록하면 숏폼 카드와 공유 콘텐츠에 자동으로 포함됩니다"
          />
          <Divider />
          <FeatureRow
            icon={<Clapperboard size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="AR 촬영 모드"
            desc="실시간 AR 효과를 적용하며 상품을 촬영할 수 있습니다"
          />
          <Divider />
          <FeatureRow
            icon={<Music2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="소리 펀치 (사운드 효과)"
            desc="인기 밈 효과음을 직접 녹음해서 만화 숏폼에 타이밍별로 추가합니다"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기능별 앱 사용법</Text>
        <Text style={styles.sectionDesc}>
          각 기능을 탭하면 단계별 사용 방법이 펼쳐집니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="실물 촬영 & 제품 분석"
            steps={[
              '카메라 탭에서 제품을 촬영하거나 갤러리에서 사진을 선택합니다',
              '단품 모드(사진 1장) 또는 다각도 모드(최대 4장)를 선택할 수 있습니다',
              '다각도 모드에서는 정면·측면·후면·디테일을 순서대로 촬영하면 AI 정밀도가 극대화됩니다',
              'AI가 자동으로 제품명, 카테고리, 가격대를 식별합니다',
              '네이버 쇼핑에서 동일 상품을 검색하고 매칭 결과를 보여줍니다',
              '원하는 상품을 선택하면 제휴 링크가 자동 생성됩니다',
              '템플릿 스타일을 수동 선택하거나 AI 자동 추천으로 받을 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Clapperboard size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="AR 촬영 모드"
            steps={[
              '카메라 탭에서 "AR 촬영 시작" 버튼을 탭합니다',
              '실시간 AR 효과가 적용된 상태로 상품을 촬영할 수 있습니다',
              '촬영한 이미지는 AI 분석을 거쳐 결과 화면으로 이동합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<ShoppingBag size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="제휴쇼핑 콘텐츠 제작 워크플로우"
            steps={[
              '제휴 마케팅 탭 → 제휴 하위 탭에서 5단계 워크플로우를 따라갑니다',
              '1단계: 사진 또는 영상을 불러옵니다',
              '2단계: 제휴 플랫폼을 선택하고 링크 URL을 입력합니다 (쿠팡, 토스, 네이버 브랜드커넥트, 올리브영 등)',
              '3단계: AI 분석 시작 버튼으로 상품을 분석하고 스타일을 추천받습니다',
              '4단계: 템플릿 스타일(숏폼 영상, 웹툰형 만화, 카드뉴스)을 선택하고 마케팅 문구를 편집합니다',
              '5단계: 공정위 문구 자동 추가 토글을 켜고 플랫폼에 업로드합니다',
              '상단 수익 요약 카드에서 총 수익과 건수를 확인할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 카드 & 캐러셀 만들기"
            steps={[
              '결과 화면에서 "숏폼 카드" 또는 "캐러셀" 버튼을 탭합니다',
              'AI가 제공한 한줄평과 가격이 사진 위에 스티커로 합성됩니다',
              '스타일(매거진/볼드/미니멀/피드)을 선택해 디자인을 바꿀 수 있습니다',
              '배경 제거 버튼으로 깔끔한 상품 이미지를 만들 수 있습니다',
              '완성된 카드를 저장하거나 바로 공유할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="제휴 링크 적용 & 공유"
            steps={[
              '결과 화면에서 "내 수수료 링크 붙여넣기" 버튼을 탭합니다',
              '브랜드커넥트에서 발급받은 개별 링크를 붙여넣습니다',
              '적용하면 숏폼 카드, 공유 링크, 단축 URL에 자동 반영됩니다',
              '하단 "SNS 원터치 공유" 헤더를 탭하면 공유 버튼들이 아코디언으로 펼쳐집니다',
              '네이버클립, 네이버TV, 인스타, 카카오톡, 블로그 중 원하는 플랫폼을 탭합니다',
              '홍보 문구와 이미지가 클립보드에 복사되고 해당 SNS가 새 창에서 열립니다',
              '다시 헤더를 탭하면 버튼이 접혀서 화면을 깔끔하게 유지합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Link2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="단축 URL"
            steps={[
              '결과 화면에서 단축 URL이 자동 생성되어 제휴 링크가 인코딩됩니다',
              '단축 URL은 공유하기 편리하고 링크 클릭수를 추적할 수 있습니다',
              '링크 클릭수는 분석 탭에 자동으로 집계됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Clapperboard size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="만화 숏폼 & 멀티 업로드 꿀팁"
            steps={[
              '결과 화면에서 "만화 숏폼" 버튼을 탭합니다',
              '웹툰 화풍(인스타툰/B급 병맛/미식 요리툰/아메리칸 코믹스/감성 지브리풍)을 선택합니다',
              '컷 분할(싱글/2컷/3컷)을 선택하면 컷 수에 따라 영상 길이가 자동 추천됩니다 (1컷 10초, 2컷 15초, 3컷 20초)',
              '영상 길이(10초/15초/20초/30초)를 직접 선택할 수도 있습니다',
              'AI 성우 목소리(밝은 20대/차분한 나레이션/B급 억양)를 선택해 더빙할 수 있습니다',
              '감정에 따라 효과음이 자동 매칭됩니다 (놀람: 헐 대박!, 행복: 샤방~, 확신: 따봉! 등)',
              '생성 버튼을 탭하면 AI가 만화 숏폼을 자동으로 완성합니다',
              '완성 화면에서 틱톡·인스타·쇼츠 버튼으로 각 플랫폼에 바로 공유할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Share2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="SNS 공유 아코디언 사용법"
            steps={[
              '결과 화면 하단의 "SNS 원터치 공유" 헤더를 탭합니다',
              '버튼들이 부드러운 애니메이션과 함께 펼쳐집니다 (기본은 접혀 있음)',
              '네이버클립, 네이버TV, 인스타, 카카오톡, 블로그 버튼 중 하나를 탭합니다',
              '홍보 문구와 캡처 이미지가 클립보드에 복사되고 해당 SNS가 열립니다',
              'SNS에서 붙여넣기(Ctrl+V)만 하면 글과 이미지가 한 번에 업로드됩니다',
              '제휴 링크 복사, 갤러리 저장, 클라우드 저장 버튼은 항상 보이는 상태로 유지됩니다',
              '헤더를 다시 탭하면 공유 버튼이 접혀서 화면을 깔끔하게 만듭니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Lightbulb size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="멀티 업로드 꿀팁"
            steps={[
              '화면 비율 9:16: 1080x1920 세로 비율로 스마트폰 전체 화면에 딱 맞습니다',
              '핵심 텍스트 위치: 릴스·틱톡·쇼츠는 좋아요 버튼과 댓글창이 하단에 겹쳐 표시되므로, 중요한 상품명이나 후킹 문구는 상단·정중앙에 배치하는 것이 좋습니다',
              '영상 길이 60초 이하: 세 플랫폼에 동시 업로드할 때 60초 이하로 유지하면 알고리즘 노출에 유리합니다',
              '만화 숏폼 완성 화면에서 이 꿀팁이 자동으로 표시됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Flame size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="인기 상품 & 소재 아이디어 봇"
            steps={[
              '제휴 마케팅 탭 → 인기 하위 탭에서 실시간 인기 상품을 확인합니다',
              '쿠팡, 네이버, 토스 등 플랫폼을 선택하고 카테고리별 인기 상품을 봅니다',
              '상품 카드의 "콘텐츠" 버튼을 탭하면 해당 상품으로 바로 분석을 시작합니다',
              '"보기" 버튼으로 상품 페이지를 직접 열어볼 수 있습니다',
              '상단 토글을 "소재 아이디어 봇"으로 전환하면 트렌드 키워드를 확인합니다',
              '키워드를 탭하면 5개의 콘텐츠 소재 아이디어가 자동 생성됩니다',
              '각 아이디어의 복사 버튼으로 제목, 후킹, 형식, 각도를 클립보드에 복사합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<FolderOpen size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="내 제작물 관리"
            steps={[
              '하단 탭에서 "제작물" 탭을 선택합니다',
              '클라우드에 저장한 모든 카드와 숏폼 영상이 그리드로 표시됩니다',
              '제작물을 탭하면 전체 화면 미리보기가 열립니다',
              '다운로드 버튼으로 기기 갤러리에 저장하거나, 삭제 버튼으로 제거할 수 있습니다',
              '영상 제작물은 "영상" 배지로 구분되어 표시됩니다',
              '당겨서 새로고침으로 최신 목록을 불러올 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<BarChart3 size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="통합 분석 대시보드"
            steps={[
              '하단 탭에서 "분석" 탭을 선택합니다',
              '상단 요약 카드에서 분석 수, 콘텐츠 수, 클릭 수, 수익을 한눈에 확인합니다',
              '성과 퍼널에서 제품 분석 → 콘텐츠 제작 → 링크 클릭 → 수익 발생 단계별 전환율을 봅니다',
              '일별 클릭 추이 차트(14일)로 트래픽 패턴을 파악합니다',
              '플랫폼별 수익과 클릭수를 비교합니다',
              '성과가 높은 콘텐츠를 탭하면 해당 결과 페이지로 이동합니다',
              '오프라인 상태에서는 캐시 데이터로 대체 표시됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<History size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="스캔 히스토리"
            steps={[
              '제휴 마케팅 탭 → 기록 하위 탭에서 과거 분석 기록을 확인합니다',
              '각 카드에 상품 이미지, 이름, 한줄평, 가격, 태그, 날짜가 표시됩니다',
              '카드를 탭하면 원본 결과 페이지로 이동합니다',
              '삭제 버튼으로 불필요한 기록을 제거할 수 있습니다',
              '당겨서 새로고침으로 최신 기록을 불러옵니다',
              '오프라인에서는 저장된 캐시 데이터로 목록이 표시됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Link2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="링크 관리 (단축 URL & QR코드)"
            steps={[
              '제휴 마케팅 탭 → 링크 하위 탭을 엽니다',
              '"새 링크 추가" 버튼으로 제휴 링크를 등록합니다 (라벨, URL, 플랫폼 선택)',
              '저장된 링크는 단축 URL로 자동 변환되고 클릭수가 추적됩니다',
              '"복사" 버튼으로 단축 URL을 클립보드에 복사합니다',
              '"QR" 버튼으로 QR코드를 생성하고 저장할 수 있습니다',
              '"열기" 버튼으로 링크를 브라우저에서 직접 엽니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<LayoutTemplate size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="마케팅 소재 보관함"
            steps={[
              '제휴 마케팅 탭 → 소재 하위 탭을 엽니다',
              '상단 소재 템플릿에서 카드뉴스, 상세페이지, 숏폼 스크립트 템플릿을 확인합니다',
              '"추가" 버튼으로 마케팅 문구, 해시태그, 후킹 문장을 저장합니다',
              '저장한 문구는 타입별 배지로 구분되어 표시됩니다',
              '복사 버튼으로 원하는 문구를 클립보드에 복사해서 재사용합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<BarChart3 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="제휴 성과 분석"
            steps={[
              '제휴 마케팅 탭 → 분석 하위 탭을 엽니다',
              '총 수익, 총 클릭, 단축 링크 수, 북마크 수를 상단 카드에서 확인합니다',
              '월별 수익 추이 바 차트로 월간 성과를 비교합니다',
              '플랫폼별 수익 바 차트로 어느 플랫폼이 가장 수익이 좋은지 파악합니다',
              '클릭수 TOP 링크 순위로 가장 성과가 좋은 링크를 확인합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<CalendarDays size={20} color={theme.colors.success[400]} strokeWidth={2} />}
            title="계정 육성 (웜업)"
            steps={[
              '제휴 마케팅 탭 → 육성 하위 탭에서 "웜업 스케줄 만들기" 버튼을 탭합니다',
              '플랫폼(인스타/틱톡/트위터·스레드/블로그/핀터레스트)과 계정 이름, 웜업 기간(7~30일)을 선택합니다',
              '스케줄을 생성하면 일자별 체크리스트가 자동으로 만들어집니다',
              '좌우 스와이프로 각 일차별 활동을 확인하고 완료 체크합니다',
              '1~3일차는 게시물 없이 좋아요와 댓글로 활동을 알립니다 (안정화 단계)',
              '4~7일차는 게시물 업로드를 시작하고 관련 계정과 소통합니다 (기초 체력 단계)',
              '8일차 이후부터 본격적으로 게시물에 제휴 링크를 포함합니다 (본격 활동 단계)',
              '매일 완료한 활동을 체크하면 진행률이 자동으로 업데이트됩니다',
              '일시정지/재개 버튼으로 스케줄을 잠시 멈추거나 다시 시작할 수 있습니다',
              '하단 웜업 가이드라인에서 계정 성장 팁을 확인하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 & 컷 갤러리 활용"
            steps={[
              '결과 화면 상단에서 "가상 피팅"과 "가상 컷" 섹션을 확인합니다',
              '가상 피팅: 의류나 액세서리 상품을 AI가 다양한 착용 장면으로 생성합니다',
              '가상 컷: 상품을 스튜디오, 자연, 매장 등 다양한 배경에서 촬영한 컷을 생성합니다',
              '생성된 이미지를 탭하면 확대해서 확인할 수 있습니다',
              '"이 이미지 사용" 버튼으로 원하는 이미지를 메인으로 설정합니다',
              '선택한 이미지가 숏폼 카드, 캐러셀, 숏폼 영상에 자동 반영됩니다',
              '여러 컷을 조합하여 캐러셀이나 영상으로 제작하면 풍부한 콘텐츠가 됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천 활용"
            steps={[
              '결과 화면에서 "AI 스타일" 섹션을 확인합니다',
              'AI가 상품 카테고리와 분위기에 맞는 디자인 스타일을 자동 추천합니다',
              '추천 스타일을 탭하면 숏폼 카드에 즉시 적용됩니다',
              '스타일 적용 시 텍스트 배치, 색상 테마, 폰트가 자동으로 조정됩니다',
              '여러 스타일을 비교해보고 가장 마음에 드는 것을 선택하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측 & 페르소나 시뮬레이터"
            steps={[
              '결과 화면에서 "바이럴 예측" 섹션에서 콘텐츠의 바이럴 점수를 확인합니다',
              '후킹력, 트렌드 적합도, 공유 가능성을 종합한 점수가 표시됩니다',
              '개선 제안을 확인하고 카피나 스타일을 수정하면 점수가 재계산됩니다',
              '"페르소나 시뮬레이터"에서 타겟 고객의 연령, 성별, 관심사를 선택합니다',
              'AI가 해당 페르소나 관점에서 예상 반응과 구매 확률을 시뮬레이션합니다',
              '주요 어필 포인트를 확인하고 마케팅 카피에 반영하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화"
            steps={[
              '결과 화면에서 "글로벌 현지화" 섹션을 확인합니다',
              '번역할 국가(영어, 일본어, 중국어 등)를 선택합니다',
              'AI가 마케팅 카피를 단순 번역이 아닌 현지화하여 생성합니다',
              '각국 SNS 트렌드와 문화에 맞는 톤앤매너가 자동 반영됩니다',
              '국가별 인기 해시태그도 함께 추천됩니다',
              '번역된 카피를 탭하면 클립보드에 복사되어 바로 사용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shuffle size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="멀티 플랫폼 익스포트"
            steps={[
              '결과 화면에서 "멀티 플랫폼 익스포트" 섹션을 확인합니다',
              '인스타그램, 틱톡, 유튜브 쇼츠 세 플랫폼 맞춤 이미지를 한 번에 생성합니다',
              '각 플랫폼별 최적 화면 비율과 텍스트 위치가 자동 조정됩니다',
              '플랫폼별 권장 해시태그와 캡션 스타일이 자동 적용됩니다',
              '생성된 이미지를 각 플랫폼에 맞춰 개별 저장할 수 있습니다',
              '세 플랫폼에 동시 업로드하여 노출을 극대화하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭 & 트렌드 카피"
            steps={[
              '결과 화면에서 "트렌드 매칭" 섹션을 확인합니다',
              'AI가 현재 SNS에서 유행하는 키워드와 상품을 자동 매칭합니다',
              '실시간 트렌드 키워드를 탭하면 관련 마케팅 카피가 자동 생성됩니다',
              '"트렌드 카피" 바에서 상품명과 카테고리를 바탕으로 유행 문구를 추천받습니다',
              '추천된 문구를 탭하면 마케팅 카피에 즉시 적용됩니다',
              '시의성 있는 콘텐츠로 알고리즘 노출을 높이세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보 등록"
            steps={[
              '결과 화면에서 "내 가게 정보" 섹션을 확인합니다',
              '매장 이름, 주소, 영업시간, 전화번호를 입력합니다',
              '등록한 정보가 숏폼 카드와 공유 콘텐츠에 자동으로 포함됩니다',
              '고객이 콘텐츠를 보고 매장 위치를 바로 확인할 수 있습니다',
              '온라인 제휴 링크와 오프라인 매장 정보를 함께 홍보하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Video size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="비디오 임포트"
            steps={[
              '결과 화면에서 "비디오 임포트" 기능을 사용합니다',
              '기존에 촬영한 영상을 불러와 숏폼 콘텐츠로 변환합니다',
              '영상에서 핵심 구간을 자동 추출하여 숏폼으로 만듭니다',
              '추출된 구간에 텍스트와 스티커를 추가할 수 있습니다',
              '기존 영상 자산을 재활용하여 콘텐츠 제작 시간을 단축하세요',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>플랫폼별 영상 게시 방법</Text>
        <Text style={styles.sectionDesc}>
          완성된 숏폼 영상을 각 플랫폼에 업로드하는 방법을 단계별로 설명합니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Music2 size={20} color="#000000" strokeWidth={2} />}
            title="틱톡 (TikTok) 업로드"
            steps={[
              '완성 화면에서 "틱톡" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '틱톡 앱을 실행하고 하단 중앙의 "+" 버튼을 탭합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '편집 화면에서 텍스트, 스티커, 효과를 추가할 수 있습니다 (선택사항)',
              '다음 버튼을 탭하고 영상 제목(캡션)을 입력합니다',
              '관련 해시태그를 추가합니다 (앱에서 추천받은 해시태그 활용)',
              '제휴 링크는 틱톡 프로필 바이오에 넣거나, 댓글에 고정하는 것이 효과적입니다',
              '공개 범위를 "공개"로 설정하고 게시 버튼을 탭합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Instagram size={20} color="#E1306C" strokeWidth={2} />}
            title="인스타그램 릴스 (Instagram Reels) 업로드"
            steps={[
              '완성 화면에서 "인스타" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '인스타그램 앱을 실행하고 하단의 "+" 버튼을 탭한 후 "릴스"를 선택합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '음악 추가: 인스타그램 내장 음악이나 원본 영상의 오디오를 선택합니다',
              '필요시 텍스트 스티커를 추가합니다 (상품명이나 후킹 문구를 화면에 표시)',
              '다음 버튼을 탭하고 캡션을 입력합니다',
              '제휴 링크는 캡션에 직접 넣거나, 프로필 바이오 링크를 통해 유도합니다',
              '관련 해시태그를 추가하고 "공개"로 설정한 후 공유 버튼을 탭합니다',
              '릴스 업로드 후 프로필의 "링크" 버튼에 제휴 링크를 등록해 두면 클릭률이 높아집니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Youtube size={20} color="#FF0000" strokeWidth={2} />}
            title="유튜브 쇼츠 (YouTube Shorts) 업로드"
            steps={[
              '완성 화면에서 "쇼츠" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '유튜브 앱을 실행하고 하단 중앙의 "+" 버튼을 탭한 후 "쇼츠 만들기"를 선택합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '편집 화면에서 텍스트, 필터, 음악을 추가할 수 있습니다 (선택사항)',
              '다음 버튼을 탭하고 영상 제목을 입력합니다',
              '제목에 #Shorts 해시태그를 포함하면 쇼츠 피드에 더 잘 노출됩니다',
              '제휴 링크는 영상 설명란에 넣거나, 채널 프로필 링크에 등록합니다',
              '공개 설정을 "공개"로 하고 업로드 버튼을 탭합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Share2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="네이버클립 & 카카오톡 공유"
            steps={[
              '네이버클립: 완성 화면에서 "공유" 버튼을 탭하면 홍보 문구와 이미지가 클립보드에 복사됩니다',
              '네이버클립 앱 또는 네이버TV에서 새 클립 만들기를 선택합니다',
              '저장한 영상을 업로드하고 복사된 홍보 문구를 붙여넣습니다',
              '카카오톡: 공유 버튼으로 메시지에 이미지와 링크를 함께 보낼 수 있습니다',
              '카카오톡 채널이나 오픈채팅방에 영상과 제휴 링크를 공유하면 직접 클릭 유도가 가능합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Lightbulb size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="멀티 플랫폼 동시 업로드 전략"
            steps={[
              '하나의 숏폼 영상을 틱톡, 인스타 릴스, 유튜브 쇼츠 세 곳에 모두 업로드하면 노출이 3배 늘어납니다',
              '각 플랫폼마다 캡션과 해시태그를 조금씩 다르게 작성하는 것이 알고리즘에 유리합니다',
              '틱톡은 트렌드 해시태그, 인스타는 상품 관련 해시태그, 쇼츠는 #Shorts를 함께 사용하세요',
              '제휴 링크는 각 플랫폼의 프로필 바이오에 동일하게 등록해 두면 관리가 편합니다',
              '업로드 시간대는 저녁 6시~10시(한국 시간)가 가장 시청률이 높습니다',
              '영상 길이는 15~30초로 설정하면 시청 지속 시간이 충분하면서도 알고리즘 노출에 유리합니다',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>소리 펀치 (사운드 효과) 사용법</Text>
        <Text style={styles.sectionDesc}>
          인기 밈 효과음을 직접 녹음해서 만화 숏폼에 타이밍별로 추가하는 기능입니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Music2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="소리 펀치 편집기 사용법"
            steps={[
              '만화 숏폼 생성기에서 "고급 옵션"을 펼칩니다',
              '"소리 펀치 컷 편집" 토글을 켭니다 (웹 브라우저에서만 사용 가능)',
              '녹음 버튼을 누르고 마이크에 소리를 내면 실시간으로 음파가 표시됩니다',
              '큰 소리가 감지되면 자동으로 효과 마커가 추가됩니다 (빵, 줌, 코믹 등)',
              '음성 명령으로 효과를 지정할 수도 있습니다 ("빵", "줌 인", "코믹" 등)',
              '녹음을 중지하면 타임라인에 마커가 표시되고 재생할 수 있습니다',
              '마커를 탭하면 효과 종류를 변경하거나 삭제할 수 있습니다',
              '만화 숏폼 생성 시 녹음된 효과가 영상에 자동으로 합성됩니다',
              '모바일에서는 "웹 브라우저에서만 사용할 수 있어요" 메시지가 표시됩니다',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>도움말</Text>
        <View style={styles.card}>
          <FeatureRow
            icon={<Info size={20} color={theme.colors.dark.textDim} strokeWidth={2} />}
            title="사용 방법"
            desc="사진을 찍거나 업로드하면 AI가 제품을 분석합니다. 결과 화면에서 쇼핑 매칭, 숏폼 카드, 공유를 한 번에 이용하세요."
          />
          <Divider />
          <FeatureRow
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="수수료 링크 적용"
            desc="결과 화면에서 '내 수수료 링크 붙여넣기' 버튼으로 브랜드커넥트 링크를 적용하세요. 공유와 카드에 자동 반영됩니다."
          />
          <Divider />
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => setShowOnboarding(true)}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <Sparkles size={20} color={theme.colors.primary[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>앱 둘러보기 다시 보기</Text>
              <Text style={styles.featureDesc}>처음 안내를 다시 확인하고 싶다면 눌러주세요</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>피드백 & 오류 신고</Text>
        <Text style={styles.sectionDesc}>
          사용 중 불편한 점이나 오류를 발견하면 알려주세요. 여러분의 의견이 앱을 더 좋게 만듭니다.
        </Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => Linking.openURL('https://forms.gle/shortconnect-feedback').catch(() => {})}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <MessageSquare size={20} color={theme.colors.accent[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>의견 보내기</Text>
              <Text style={styles.featureDesc}>구글 설문지로 피드백을 남겨주세요</Text>
            </View>
            <ExternalLink size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => Linking.openURL('https://open.kakao.com/o/shortconnect').catch(() => {})}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <Bug size={20} color={theme.colors.error[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>오류 신고 & 오픈채팅</Text>
              <Text style={styles.featureDesc}>카카오톡 오픈채팅방에서 빠르게 도움받기</Text>
            </View>
            <ExternalLink size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>ShortConnect (숏커넥트) — 온·오프라인 셀러를 위한 올인원 AI 커머스</Text>

      <OnboardingModal
        visible={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </ScrollView>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconWrap}>{icon}</View>
      <View style={styles.featureBody}>
        <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function UsageGuide({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={styles.usageHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.featureIconWrap}>{icon}</View>
        <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
        <ChevronDown
          size={18}
          color={theme.colors.dark.textDim}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.usageSteps}>
          {steps.map((step, i) => (
            <View key={i} style={styles.usageStepRow}>
              <View style={styles.usageStepBadge}>
                <Text style={styles.usageStepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.usageStepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBody: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: 4,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  usageSteps: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  usageStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  usageStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  usageStepNum: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[400],
  },
  usageStepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
  },
  guideCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.md,
  },
  guideStepTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 8,
  },
  guideStepText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  guideLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500] + '15',
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
  },
  guideLinkText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  noticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.warning[400] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  flowContainer: {
    gap: 0,
  },
  flowStep: {
    flexDirection: 'row',
    gap: 12,
  },
  flowStepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowStepBody: {
    flex: 1,
    paddingBottom: 16,
  },
  flowStepNum: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textFaint,
  },
  flowStepTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: 2,
    marginBottom: 4,
  },
  flowStepDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  flowConnector: {
    width: 2,
    height: 16,
    backgroundColor: theme.colors.dark.border,
    marginLeft: 21,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
});
