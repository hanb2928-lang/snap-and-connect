/**
 * Vision AI 기반 사물 분석 + 마케팅 카피 자동 생성
 * 5장 입체컷 이미지를 분석하여 사물 카테고리, 소재/질감, 색상, 디자인 포인트를 추출하고
 * 15초 광고에 맞는 후킹성 카피(타이틀, 특징 카피, CTA)를 자동 생성한다.
 */

import type { ProductVisionResult } from './productVision';

export interface MarketingCopySet {
  title: string;
  hookCopy: string;
  featureCopy: string;
  ctaCopy: string;
  subtitleCopy: string;
}

export interface AnalyzedProductInfo {
  category: string;
  material: string;
  texture: string;
  colors: string[];
  designPoints: string[];
  shape: string;
  marketingPoints: string[];
  copySet: MarketingCopySet;
}

const CATEGORY_COPY_TEMPLATES: Record<string, { title: string; hook: string; feature: string; cta: string; subtitle: string }> = {
  bag: {
    title: '이 가방이 당신의 일상을 바꿉니다',
    hook: '왜 모두가 이 가방을 찾을까?',
    feature: '프리미엄 소재 · 완벽한 수납 · 타임리스 디자인',
    cta: '지금 확인하고 1시간 먼저 만나보세요',
    subtitle: '프리미엄의 기준을 다시 쓰다',
  },
  shoes: {
    title: '발이 먼저 아는 차이',
    hook: '신어보면 알 수밖에 없는 편안함',
    feature: '초경량 쿠셔닝 · 통기성 메쉬 · 그립 솔',
    cta: '오늘 신고 내일부터 달라진 하루',
    subtitle: '움직임의 자유를 경험하세요',
  },
  electronics: {
    title: '작은 사이즈, 압도적인 성능',
    hook: '이 성능에 이 가격이 진짜?',
    feature: '최신 칩셋 · 초고속 충전 · 올데이 배터리',
    cta: '지금 주문하면 내일 도착',
    subtitle: '일상의 효율을 200% 끌어올리다',
  },
  fashion: {
    title: '입는 순간 태도가 달라집니다',
    hook: '이 옷을 입고 거울을 보세요',
    feature: '프리미엄 원단 · 테일러드 핏 · 계절감 색상',
    cta: '나만의 핏을 찾아보세요',
    subtitle: '당신의 무드를 완성하다',
  },
  beauty: {
    title: '피부가 먼저 반응합니다',
    hook: '바르고 3일, 모두가 물어봤어요',
    feature: '처방 성분 · 무자극 텍스처 · 글로우 연출',
    cta: '지금 시작하고 변화를 확인하세요',
    subtitle: '피부의 가능성을 깨우다',
  },
  food: {
    title: '한 입에 기분이 좋아지는 맛',
    hook: '이 맛을 모르면 손해',
    feature: '신선 원재료 · 직접 생산 · 풍미 밸런스',
    cta: '오늘 저녁에 바로 즐겨보세요',
    subtitle: '일상의 미식을 한 단계 높이다',
  },
  home: {
    title: '공간이 달라지는 단 하나의 선택',
    hook: '이거 하나로 집이 호텔이 됐어요',
    feature: '내추럴 소재 · 공간 활용 · 감각 디자인',
    cta: '지금 구매하고 공간을 업그레이드하세요',
    subtitle: '살고 싶은 공간을 만들다',
  },
  default: {
    title: '이 제품을 만나면 돌아갈 수 없습니다',
    hook: '왜 이제야 알았을까?',
    feature: '프리미엄 퀄리티 · 실용적 디자인 · 합리적 가격',
    cta: '지금 확인하고 차이를 경험하세요',
    subtitle: '일상의 기준을 높이다',
  },
};

function categorizeProduct(vision: ProductVisionResult): string {
  const text = `${vision.productName} ${vision.productCategory} ${vision.materialGuess} ${vision.shapeDescription}`.toLowerCase();
  if (/bag|가방|백|핸드백|숄더|토트|크로스|backpack/.test(text)) return 'bag';
  if (/shoe|신발|운동화|스니커|부츠|sneaker|boot/.test(text)) return 'shoes';
  if (/electronic|전자|폰|노트북|이어폰|충전|스피커|phone|laptop|earphone|speaker|gadget/.test(text)) return 'electronics';
  if (/fashion|의류|옷|셔츠|드레스|자켓|팬츠|shirt|dress|jacket|pants|clothing/.test(text)) return 'fashion';
  if (/beauty|화장|스킨|크림|샴푸|코스메틱|cosmetic|skincare|makeup/.test(text)) return 'beauty';
  if (/food|식품|간식|커피|차|snack|coffee|tea|gourmet/.test(text)) return 'food';
  if (/home|가전|홈|인테리어|가구|조명|furniture|lighting|decor|kitchen/.test(text)) return 'home';
  return 'default';
}

export function buildMarketingCopy(vision: ProductVisionResult): MarketingCopySet {
  const cat = categorizeProduct(vision);
  const template = CATEGORY_COPY_TEMPLATES[cat] ?? CATEGORY_COPY_TEMPLATES.default;

  const topFeature = vision.visualFeatures[0] ?? template.feature;
  const topMarketing = vision.marketingPoints[0] ?? '';
  const colorStr = vision.colorPalette.length > 0 ? vision.colorPalette.slice(0, 2).join(' · ') : '';

  const title = topMarketing || template.title;
  const hookCopy = template.hook;
  const featureCopy = [topFeature, colorStr, vision.materialGuess].filter(Boolean).join(' · ') || template.feature;
  const ctaCopy = template.cta;
  const subtitleCopy = template.subtitle;

  return { title, hookCopy, featureCopy, ctaCopy, subtitleCopy };
}

export function buildAnalyzedProductInfo(vision: ProductVisionResult): AnalyzedProductInfo {
  const cat = categorizeProduct(vision);
  return {
    category: cat,
    material: vision.materialGuess,
    texture: vision.textureDescription,
    colors: vision.colorPalette,
    designPoints: vision.visualFeatures.slice(0, 5),
    shape: vision.shapeDescription,
    marketingPoints: vision.marketingPoints.slice(0, 3),
    copySet: buildMarketingCopy(vision),
  };
}

export interface CopyOverlayTimeline {
  startSec: number;
  endSec: number;
  text: string;
  position: 'top' | 'bottom' | 'center';
  style: 'title' | 'feature' | 'cta';
}

export function buildCopyOverlayTimeline(copySet: MarketingCopySet): CopyOverlayTimeline[] {
  return [
    { startSec: 0, endSec: 3.5, text: copySet.hookCopy, position: 'top', style: 'title' },
    { startSec: 3.5, endSec: 7.5, text: copySet.title, position: 'center', style: 'title' },
    { startSec: 7.5, endSec: 11.5, text: copySet.featureCopy, position: 'bottom', style: 'feature' },
    { startSec: 11.5, endSec: 15, text: copySet.ctaCopy, position: 'bottom', style: 'cta' },
  ];
}

export function getActiveCopyOverlay(timeline: CopyOverlayTimeline[], currentSec: number): CopyOverlayTimeline | null {
  return timeline.find((t) => currentSec >= t.startSec && currentSec < t.endSec) ?? null;
}
