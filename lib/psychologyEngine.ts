export type EmotionPhase = 'curiosity' | 'shock' | 'empathy' | 'desire' | 'action';

export interface PsychScene {
  time: string;
  hook: string;
  desc: string;
  emotion: EmotionPhase;
  textOverlay: string;
  subtext: string;
  colorTheme: { primary: string; accent: string; overlay: string };
  motionType: 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left' | 'tilt-up' | 'shake' | 'pulse';
  textPosition: 'top' | 'center' | 'bottom';
  fontSize: number;
  subFontSize: number;
  transitionMs: number;
}

export interface PsychAnalysis {
  scenes: PsychScene[];
  specs: { ratio: string; resolution: string; maxDuration: string; format: string };
  topReference: { title: string; views: string; revenue: string };
  mediaMode: 'video' | 'image';
  colorGrading: { warm: number; contrast: number; saturation: number; vignette: number };
  pacingBpm: number;
  emotionCurve: EmotionPhase[];
  psychologicalTriggers: { name: string; description: string; appliedAt: number }[];
  platformPsychology: {
    attentionPattern: string;
    primaryDrive: string;
    avgWatchTime: string;
    optimalHookSec: number;
    textStyle: string;
  };
}

function detectMediaMode(format: string): 'video' | 'image' {
  const upper = format.toUpperCase();
  if (upper.includes('JPG') || upper.includes('PNG') || upper.includes('GIF') || upper.includes('정지형')) {
    return 'image';
  }
  return 'video';
}

const EMOTION_COLORS: Record<EmotionPhase, { primary: string; accent: string; overlay: string }> = {
  curiosity: { primary: '#FFD700', accent: '#FFA500', overlay: 'rgba(20,15,5,0.35)' },
  shock: { primary: '#FF4444', accent: '#FF1744', overlay: 'rgba(30,0,0,0.5)' },
  empathy: { primary: '#4FC3F7', accent: '#29B6F6', overlay: 'rgba(0,10,30,0.4)' },
  desire: { primary: '#FF6B35', accent: '#FF8E53', overlay: 'rgba(25,10,0,0.45)' },
  action: { primary: '#00E676', accent: '#00C853', overlay: 'rgba(0,20,10,0.5)' },
};

interface PlatformPsychProfile {
  attentionPattern: string;
  primaryDrive: string;
  avgWatchTime: string;
  optimalHookSec: number;
  textStyle: string;
  pacingBpm: number;
  colorGrading: { warm: number; contrast: number; saturation: number; vignette: number };
  motionStyle: PsychScene['motionType'][];
  triggers: { name: string; description: string }[];
  boardTriggers?: Record<string, { name: string; description: string }[]>;
}

const PLATFORM_PROFILES: Record<string, PlatformPsychProfile> = {
  tiktok: {
    attentionPattern: 'F-pattern (상단 좌측 → 우측 → 하단 스캔 0.8초 내)',
    primaryDrive: 'FOMO + 즉각적 도파민',
    avgWatchTime: '1.5~3쳔',
    optimalHookSec: 1,
    textStyle: '대담한 산세리프, 화면 중앙 대형 텍스트, 2줄 이내',
    pacingBpm: 140,
    colorGrading: { warm: 15, contrast: 30, saturation: 25, vignette: 40 },
    motionStyle: ['zoom-in', 'shake', 'pulse', 'pan-right', 'zoom-in', 'tilt-up'],
    triggers: [
      { name: '미러 뉴런 활성화', description: '사용자가 제품 사용 장면을 보면 자신도 사용하는 상상을 무의식적으로 함' },
      { name: '도파민 루프', description: '3초마다 새로운 시각 자극으로 도파민 분석 유발, 무한 스크롤과 같은 원리' },
      { name: '손실 회피 역전', description: '"이 가격이 마지막"이라는 메시지가 손실 회피 심리를 구매 행동으로 전환' },
      { name: '사회적 증거 폭발', description: '댓글 수 좋아요 수가 시청자의 판단을 대체함, "다들 사니까 나도"' },
      { name: '무한 루프 구조', description: '영상 끝이 시작과 연결되어 재생 수를 기하급수적으로 늘림' },
      { name: '비교 심리 자극', description: 'before/after 구조로 자신의 현 상태와 개선 후를 비교하게 만듦' },
    ],
    boardTriggers: {
      carousel: [
        { name: '비교 분석 심리', description: '캐러셀에서 여러 제품을 나란히 배치하면 뇌가 자동 비교 분석을 수행함' },
      ],
      story: [
        { name: '24시간 희소성', description: '스토리의 소멸 특성이 긴박감을 극대화, "지금 보지 않으면 사라짐"' },
      ],
    },
  },
  instagram: {
    attentionPattern: 'Z-pattern (좌상단 → 우상단 → 좌하단 스캔, 미학적 평가 1.2초)',
    primaryDrive: '동경심 + 사회적 승인',
    avgWatchTime: '3~7초',
    optimalHookSec: 2,
    textStyle: '우아한 산세리프, 하단 배치, 그라데이션 오버레이와 함께',
    pacingBpm: 100,
    colorGrading: { warm: 10, contrast: 20, saturation: 15, vignette: 25 },
    motionStyle: ['zoom-in', 'pan-right', 'tilt-up', 'pulse', 'zoom-out', 'pan-left'],
    triggers: [
      { name: '동경심 자극', description: '완벽한 라이프스타일 이미지가 "나도 저렇게 살고 싶다"는 동경심을 자극' },
      { name: '색상 심리학 적용', description: '난색(주황/빨강)은 긴박감, 한색(파랑)은 신뢰감, 인플루언서는 난색을 선호' },
      { name: '스토리 몰입 효과', description: '개인적 경험담으로 시작하면 광고 거부감이 70% 감소, 뇌가 스토리를 현실로 착각' },
      { name: '번들링 효과', description: '제품을 라이프스타일과 번들링하면 제품 자체가 아닌 "그 라이프스타일"을 구매하게 됨' },
      { name: '사회적 승인 욕구', description: '"이렇게 하면 좋아요를 받을 수 있다"는 무의식적 계산이 참여를 유도' },
    ],
    boardTriggers: {
      reels: [
        { name: '릴스 알고리즘 최적화', description: '첫 2초 시청률이 전체 노출량을 결정, 시각적 충격이 필수' },
      ],
      feed: [
        { name: '카드뉴스 정보 밀집', description: '피드에서는 정보 밀도가 높을수록 저장률이 증가, 저장 = 알고리즘 가시성 상승' },
      ],
      story: [
        { name: '24시간 희소성', description: '스토리의 소멸 특성이 긴박감을 극대화' },
      ],
    },
  },
  youtube: {
    attentionPattern: 'F-pattern + 썸네일 평가 (썸네일 0.5초, 영상 후크 3초)',
    primaryDrive: '정보 탐욕 + 권위 신뢰',
    avgWatchTime: '5~15초',
    optimalHookSec: 3,
    textStyle: '굵은 산세리프, 상단 배치, 높은 대비',
    pacingBpm: 90,
    colorGrading: { warm: 5, contrast: 25, saturation: 10, vignette: 20 },
    motionStyle: ['zoom-in', 'pan-right', 'zoom-in', 'tilt-up', 'pulse', 'zoom-out'],
    triggers: [
      { name: '정보 갭 자극', description: '"이것만 알면" 구조가 인간의 정보 갭에 대한 불편함을 자극, 해소하려고 시청 지속' },
      { name: '권위 신뢰 효과', description: '전문가 포즈, 데이터 인용, 비교 표가 신뢰도를 급격히 상승시킴' },
      { name: '시청 시간 보상', description: '알고리즘이 시청 시간에 비례해 노출을 늘림, 후크가 길수록 더 많은 노출' },
      { name: '무한 루프 구조', description: '쇼츠에서 끝이 시작과 연결되면 재생 수가 3배 이상 증가' },
      { name: '호기심 루프', description: '질문으로 시작해서 답을 마지막에 배치하면 끝까지 시청하게 됨' },
    ],
    boardTriggers: {
      shorts: [
        { name: '쇼츠 폭발적 확산', description: '쇼츠는 구독자 수와 무관하게 노출, 품질이 전부' },
      ],
      video: [
        { name: '긴 호흡 정보 전달', description: '일반 영상은 구조적 정보 전달이 핵심, 3막 구조(문제-해결-결과)' },
      ],
    },
  },
  pinterest: {
    attentionPattern: '전체 시각 스캔 (0.3초 내 미학 판단, 핀 저장 여부 결정)',
    primaryDrive: '영감 + 미래 자아 투사',
    avgWatchTime: '2~5초',
    optimalHookSec: 1,
    textStyle: '세리프 또는 얇은 산세리프, 중앙 배치, 여백이 많은 우아한 디자인',
    pacingBpm: 70,
    colorGrading: { warm: 5, contrast: 15, saturation: 20, vignette: 10 },
    motionStyle: ['zoom-out', 'pan-right', 'tilt-up', 'zoom-in', 'pan-left', 'pulse'],
    triggers: [
      { name: '미래 자아 투사', description: '핀터레스트 사용자는 "미래의 나"를 위해 저장, 제품이 그 미래의 일부가 되어야 함' },
      { name: '시각적 임팩트 우선', description: '텍스트보다 이미지가 10배 더 강력, 첫 0.3초에 시각적 판단 완료' },
      { name: '보드 큐레이션 심리', description: '사용자가 보드에 저장하는 행위 자체가 일종의 "소유" 심리를 충족' },
      { name: '영감-실행 갭', description: '영감을 주되 실행의 갭을 좁혀주면 구매 전환율이 3배 상승' },
    ],
    boardTriggers: {
      pin: [
        { name: '정지형 임팩트', description: '핀은 정지 이미지가 핵심, 텍스트 오버레이로 핵심 가치를 한 줄로' },
      ],
      idea_pin: [
        { name: '아이디어 핀 스토리보드', description: '여러 장면이 슬라이드처럼 전환, 각 장면마다 하나의 핵심 메시지' },
      ],
    },
  },
  blog: {
    attentionPattern: 'F-pattern 텍스트 스캔 (제목 → 소제목 → 본문)',
    primaryDrive: '신뢰 + 상세 정보',
    avgWatchTime: '30초~2분',
    optimalHookSec: 3,
    textStyle: '명확한 산세리프, 상단 배치, 정보 전달 중심',
    pacingBpm: 60,
    colorGrading: { warm: 0, contrast: 20, saturation: 5, vignette: 15 },
    motionStyle: ['zoom-in', 'pan-right', 'tilt-up', 'zoom-in', 'pan-left', 'zoom-out'],
    triggers: [
      { name: '신뢰 구축 단계', description: '블로그는 상세 정보로 신뢰를 구축, 구매 결정까지의 시간이 가장 김' },
      { name: 'SEO + 정보 갭', description: '검색으로 들어온 사용자는 정보 갭이 큼, 품질 좋은 정보가 전환율 결정' },
      { name: '비교 분석 심리', description: '블로그 리뷰는 비교 분석을 제공, 뇌가 합리적 결정을 내린다고 착각하게 함' },
    ],
  },
  twitter: {
    attentionPattern: '빠른 스캔 (0.5초 내 관심사 판단)',
    primaryDrive: '트렌드 + 즉각적 반응',
    avgWatchTime: '3~8초',
    optimalHookSec: 1,
    textStyle: '굵은 산세리프, 중앙 배치, 짧고 강렬한 한 줄',
    pacingBpm: 120,
    colorGrading: { warm: 10, contrast: 25, saturation: 15, vignette: 30 },
    motionStyle: ['zoom-in', 'shake', 'pan-right', 'pulse', 'zoom-in', 'tilt-up'],
    triggers: [
      { name: '트렌드 편승', description: '유행하는 트렌드에 편승하면 노출이 5배 이상 증가, 타이밍이 전부' },
      { name: '스레드 몰입', description: '스레드 구조가 다음 트윗을 보고 싶게 만듦, 정보 갭의 연속' },
      { name: '즉각적 반응 심리', description: '좋아요/리트윗이 즉각적이라 도파민 루프가 더 짧고 강렬' },
    ],
  },
  naver_clip: {
    attentionPattern: 'F-pattern + 검색 연동 (검색 키워드 → 클립 시청 1.5초)',
    primaryDrive: '검색 신뢰 + 국내 로컬 밀착',
    avgWatchTime: '3~10초',
    optimalHookSec: 2,
    textStyle: '굵은 산세리프, 하단 배치, 한국어 가독성 우선',
    pacingBpm: 110,
    colorGrading: { warm: 8, contrast: 22, saturation: 18, vignette: 25 },
    motionStyle: ['zoom-in', 'pan-right', 'tilt-up', 'pulse', 'zoom-out', 'pan-left'],
    triggers: [
      { name: '검색 생태계 연동', description: '네이버 블로그·검색·NOW와 연동되어 검색 유입이 자연스럽게 클립으로 이어짐' },
      { name: '국내 로컬 밀착', description: '한국 사용자의 검색 습관에 최적화, 지역 기반 제품 추천에 효과적' },
      { name: '신뢰 기반 전환', description: '네이버 브랜드 신뢰도가 구매 결정으로 직결, 블로그 리뷰와 시너지' },
      { name: '정보 갭 + 검색 연결', description: '검색에서 들어온 사용자는 정보 갭이 큼, 품질 좋은 숏폼이 전환율 결정' },
    ],
  },
};

const REFERENCE_MAP: Record<string, { title: string; views: string; revenue: string }> = {
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
  nc_clip: { title: '네이버 클립 제품 영상', views: '1.3M', revenue: '월 220만원' },
};

const PLATFORM_PREFIX: Record<string, string> = {
  instagram: 'ig', youtube: 'yt', blog: 'blog', tiktok: 'tt', pinterest: 'pin', twitter: 'tw', naver_clip: 'nc',
};

export function generatePsychAnalysis(
  platform: string,
  board: string,
  _productUrl: string,
  specsIn?: { ratio: string; resolution: string; maxDuration: string; format: string },
  productMeta?: { productName?: string; price?: string; brand?: string; description?: string },
): PsychAnalysis {
  const specs = specsIn ?? { ratio: '16:9', resolution: '1920×1080', maxDuration: '60초', format: 'MP4' };
  const profile = PLATFORM_PROFILES[platform] ?? PLATFORM_PROFILES.tiktok;

  const maxDurStr = specs.maxDuration;
  const totalSec = parseInt(maxDurStr, 10) || 60;

  const emotionCurve: EmotionPhase[] = ['curiosity', 'shock', 'empathy', 'desire', 'action'];

  const triggers = [...profile.triggers];
  if (profile.boardTriggers?.[board]) {
    triggers.push(...profile.boardTriggers[board]);
  }

  const sceneCount = Math.min(triggers.length, Math.max(5, Math.floor(totalSec / 8)));

  const pName = productMeta?.productName?.trim() || '이 제품';
  const pPrice = productMeta?.price?.trim() || '';
  const pBrand = productMeta?.brand?.trim() || '';
  const pDesc = productMeta?.description?.trim() || '';
  const nameShort = pName.length > 12 ? pName.slice(0, 12) + '...' : pName;
  const brandPrefix = pBrand ? `${pBrand} ` : '';

  const hookTexts: Record<EmotionPhase, string[]> = {
    curiosity: [
      `${nameShort} 알아?`,
      `잠깐, ${nameShort} 봤어?`,
      `이게 왜 1등인지 알아?`,
      `${nameShort} 진짜야?`,
      `${pBrand ? pBrand + ' ' : ''}${nameShort}이 그냥 넘기지 마`,
    ],
    shock: [
      pPrice ? `${nameShort} ${pPrice} 실화?` : `${nameShort} 이 가격 실화?`,
      `${nameShort} 진짜 미쳤는데`,
      `${nameShort} 보고 충격받음`,
      pPrice ? `${pPrice}이라고? 진짜임?` : '이거 실화임?',
      `${nameShort} 진짜 충격이야`,
    ],
    empathy: [
      `${nameShort} 쓰면 진짜 편해요`,
      `${nameShort} 쓰는 분들 공감 100%`,
      `${nameShort} 쓰면 왜 몰랐지 싶음`,
      `${nameShort} 쓰면 삶이 바뀜`,
      `${nameShort} 진짜 추천`,
    ],
    desire: [
      `${nameShort} 무조건 사야 됨`,
      `${nameShort} 지금 안 사면 손해`,
      `${nameShort} 재고 떨어지면 끝`,
      `${nameShort} 지금이 기회`,
      pPrice ? `${nameShort} ${pPrice} 진짜 사고 싶음` : `${nameShort} 진짜 사고 싶음`,
    ],
    action: [
      `${nameShort} 지금 바로 확인`,
      `${nameShort} 링크 바로가기`,
      `${nameShort} 지금 구매`,
      `${nameShort} 댓글로 문의`,
      `${nameShort} 지금 안 사면 후회`,
    ],
  };

  const subTexts: Record<EmotionPhase, string[]> = {
    curiosity: [
      `${brandPrefix}${nameShort}으로 시선이 멈추는 첫 1초`,
      `${nameShort} 정보 갭을 열어 끝까지 보게 만드는 후크`,
      `시각적 반전으로 스와이프를 차단하는 ${nameShort} 기법`,
    ],
    shock: [
      pPrice ? `${nameShort} ${pPrice} 예상을 깨는 시각 충격` : `${nameShort} 예상을 깨는 시각 충격`,
      `${nameShort} 도파민 분비를 촉진하는 강렬한 전환`,
      `${nameShort} 손실 회피 심리를 자극하는 긴박감 연출`,
    ],
    empathy: [
      `${nameShort} 개인적 경험으로 광고 거부감 제거`,
      `${nameShort} 사용 전후 비교로 공감과 욕구를 동시 자극`,
      `${nameShort} 실사용 스토리로 뇌가 이야기로 인식`,
    ],
    desire: [
      `${nameShort} 사회적 증거와 희소성으로 구매 욕구 극대화`,
      pPrice ? `${nameShort} ${pPrice} 한정 판매로 손실 회피를 행동으로` : `${nameShort} 한정 판매로 손실 회피를 행동으로`,
      `${nameShort} 번들링 효과로 라이프스타일을 판매`,
    ],
    action: [
      `${nameShort} 명확한 CTA로 전환율 극대화`,
      `${nameShort} 댓글 유도로 참여율 상승`,
      `${nameShort} 제휴 링크로 클릭률 3배 향상`,
    ],
  };

  const textPositions: PsychScene['textPosition'][] = ['top', 'center', 'bottom'];

  const scenes: PsychScene[] = [];
  for (let i = 0; i < sceneCount; i++) {
    const emotion = emotionCurve[Math.min(i, emotionCurve.length - 1)];
    const colors = EMOTION_COLORS[emotion];
    const motionType = profile.motionStyle[i % profile.motionStyle.length];
    const timeSec = Math.floor((totalSec / sceneCount) * i);
    const hookIdx = i % hookTexts[emotion].length;
    const subIdx = i % subTexts[emotion].length;

    scenes.push({
      time: `${timeSec}s`,
      hook: triggers[i].name,
      desc: triggers[i].description,
      emotion,
      textOverlay: hookTexts[emotion][hookIdx],
      subtext: subTexts[emotion][subIdx],
      colorTheme: colors,
      motionType,
      textPosition: textPositions[i % textPositions.length],
      fontSize: platform === 'tiktok' ? 52 : platform === 'pinterest' ? 38 : 44,
      subFontSize: platform === 'tiktok' ? 28 : platform === 'pinterest' ? 22 : 26,
      transitionMs: Math.round(60000 / profile.pacingBpm),
    });
  }

  const refKey = `${PLATFORM_PREFIX[platform] ?? platform}_${board}`;
  const topReference = REFERENCE_MAP[refKey] ?? { title: '상위 1% 제휴 영상', views: '1M+', revenue: '월 300만원+' };

  return {
    scenes,
    specs,
    topReference,
    mediaMode: detectMediaMode(specs.format),
    colorGrading: profile.colorGrading,
    pacingBpm: profile.pacingBpm,
    emotionCurve,
    psychologicalTriggers: triggers.map((t, i) => ({
      name: t.name,
      description: t.description,
      appliedAt: Math.floor((totalSec / sceneCount) * i),
    })),
    platformPsychology: {
      attentionPattern: profile.attentionPattern,
      primaryDrive: profile.primaryDrive,
      avgWatchTime: profile.avgWatchTime,
      optimalHookSec: profile.optimalHookSec,
      textStyle: profile.textStyle,
    },
  };
}
