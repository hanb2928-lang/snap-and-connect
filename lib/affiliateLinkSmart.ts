import type { AffiliatePlatformKey } from '@/components/AffiliatePlatformSwitch';

export interface DetectedAffiliate {
  platform: AffiliatePlatformKey;
  platformLabel: string;
  isAffiliate: boolean;
  marketingCopy: string;
  shortHint: string;
}

const COUPANG_SEARCH = /coupang\.com\/(np\/search|v\/p)/i;
const COUPANG_PRODUCT = /coupang\.com\/vp\/products/i;
const SMARTSTORE = /smartstore\.naver\.com|brand\.naver\.com|search\.shopping\.naver\.com/i;
const TOSS = /toss\.(to|im)/i;
const TOSS_SEND = /toss\.to\/send\//i;
const OLIVEYOUNG = /oliveyoung\.co\.kr/i;
const ZIGZAG = /zigzag\.be/i;
const TODAYHOUSE = /ohou\.se|todayhouse\.com/i;
const KURLY = /kurly\.com/i;
const ALIEXPRESS = /aliexpress\.com|aliexpress\.kr/i;
const MYREALTRIP = /myrealtrip\.com/i;
const KLOOK = /klook\.com/i;

const PLATFORM_PATTERNS: { pattern: RegExp; key: AffiliatePlatformKey }[] = [
  { pattern: /coupang\.com/i, key: 'Coupang' },
  { pattern: TOSS, key: 'Toss' },
  { pattern: SMARTSTORE, key: 'BrandConnect' },
  { pattern: OLIVEYOUNG, key: 'OliveYoung' },
  { pattern: ZIGZAG, key: 'Zigzag' },
  { pattern: TODAYHOUSE, key: 'TodayHouse' },
  { pattern: KURLY, key: 'Kurly' },
  { pattern: ALIEXPRESS, key: 'AliExpress' },
  { pattern: MYREALTRIP, key: 'MyRealTrip' },
  { pattern: KLOOK, key: 'Klook' },
];

export function detectAffiliatePlatform(url: string): AffiliatePlatformKey {
  for (const { pattern, key } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return key;
  }
  return 'Custom';
}

export function isKnownAffiliateUrl(url: string): boolean {
  return PLATFORM_PATTERNS.some((p) => p.pattern.test(url));
}

function extractProductNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    const q = params.get('q') || params.get('query') || params.get('keyword');
    if (q) return q.replace(/\+/g, ' ').trim();

    const pathParts = u.pathname.split('/').filter(Boolean);
    const lastSegment = pathParts[pathParts.length - 1] || '';
    if (lastSegment && lastSegment !== 'products' && lastSegment !== 'search') {
      const cleaned = lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '')
        .trim();
      if (cleaned && cleaned.length > 1 && !/^\d+$/.test(cleaned)) return cleaned;
    }
  } catch {
    // not a valid URL yet
  }
  return '';
}

export function generateMarketingCopy(url: string, productName: string, priceLabel: string): DetectedAffiliate {
  const platform = detectAffiliatePlatform(url);
  const name = extractProductNameFromUrl(url) || productName || '이 제품';
  const price = priceLabel ? ` ${priceLabel}에` : '';

  if (platform === 'Coupang') {
    const isSearch = COUPANG_SEARCH.test(url);
    return {
      platform,
      platformLabel: '쿠팡 파트너스',
      isAffiliate: true,
      shortHint: isSearch ? '쿠팡 검색 링크' : '쿠팡 상품 링크',
      marketingCopy: `${name}${price} 확인하기\n지금 바로 쿠팡에서 최저가 비교하고 구매하세요!\n#쿠팡 #파트너스 #${name.replace(/\s+/g, '')}`,
    };
  }

  if (platform === 'Toss') {
    const isSend = TOSS_SEND.test(url);
    return {
      platform,
      platformLabel: '토스 쉐어링크',
      isAffiliate: true,
      shortHint: isSend ? '토스 송금 링크' : '토스 쉐어 링크',
      marketingCopy: `${name} 함께해요\n토스로 간편하게 참여하세요. 링크 클릭 한 번이면 끝!\n#토스 #쉐어링크`,
    };
  }

  if (SMARTSTORE_TEST(url)) {
    return {
      platform,
      platformLabel: '네이버 브랜드커넥트',
      isAffiliate: true,
      shortHint: '네이버 스마트스토어 링크',
      marketingCopy: `${name}${price} 만나보기\n네이버 쇼핑에서 안심하고 구매하세요.\n#네이버쇼핑 #스마트스토어 #${name.replace(/\s+/g, '')}`,
    };
  }

  const PLATFORM_COPY: Record<AffiliatePlatformKey, { label: string; hint: string; copy: string; tag: string }> = {
    Coupang: { label: '', hint: '', copy: '', tag: '' },
    Toss: { label: '', hint: '', copy: '', tag: '' },
    BrandConnect: { label: '', hint: '', copy: '', tag: '' },
    OliveYoung: { label: '올리브영', hint: '올리브영 링크', tag: '올리브영', copy: `${name}${price} 확인하기\n올리브영에서 만나보세요!\n#올리브영 #뷰티 #${name.replace(/\s+/g, '')}` },
    Zigzag: { label: '지그재그', hint: '지그재그 링크', tag: '지그재그', copy: `${name}${price} 확인하기\n지그재그에서 최저가로 만나보세요!\n#지그재그 #패션 #${name.replace(/\s+/g, '')}` },
    TodayHouse: { label: '오늘의집', hint: '오늘의집 링크', tag: '오늘의집', copy: `${name}${price} 확인하기\n오늘의집에서 홈스타일링하세요!\n#오늘의집 #홈데코 #${name.replace(/\s+/g, '')}` },
    Kurly: { label: '컬리', hint: '컬리 링크', tag: '컬리', copy: `${name}${price} 확인하기\n컬리에서 신선하게 만나보세요!\n#컬리 #신선식품 #${name.replace(/\s+/g, '')}` },
    AliExpress: { label: '알리익스프레스', hint: '알리 링크', tag: '알리익스프레스', copy: `${name}${price} 확인하기\n알리익스프레스에서 최저가로!\n#알리익스프레스 #해외직구 #${name.replace(/\s+/g, '')}` },
    MyRealTrip: { label: '마이리얼트립', hint: '마이리얼트립 링크', tag: '마이리얼트립', copy: `${name} 예약하기\n마이리얼트립에서 특가를 만나보세요!\n#마이리얼트립 #여행 #${name.replace(/\s+/g, '')}` },
    Klook: { label: '클룩', hint: '클룩 링크', tag: '클룩', copy: `${name} 예약하기\n클룩에서 할인가로 만나보세요!\n#클룩 #여행 #${name.replace(/\s+/g, '')}` },
    Custom: { label: '직접 추가', hint: '커스텀 링크', tag: '제휴', copy: `${name}${price} 확인하기\n링크를 통해 더 자세한 정보를 확인하세요.\n#${name.replace(/\s+/g, '')}` },
  };

  const copyInfo = PLATFORM_COPY[platform];
  if (copyInfo.label) {
    return {
      platform,
      platformLabel: copyInfo.label,
      isAffiliate: true,
      shortHint: copyInfo.hint,
      marketingCopy: copyInfo.copy,
    };
  }

  return {
    platform,
    platformLabel: '직접 추가 링크',
    isAffiliate: isKnownAffiliateUrl(url),
    shortHint: '커스텀 제휴 링크',
    marketingCopy: `${name}${price} 확인하기\n링크를 통해 더 자세한 정보를 확인하세요.\n#${name.replace(/\s+/g, '')}`,
  };
}

function SMARTSTORE_TEST(url: string): boolean {
  return SMARTSTORE.test(url);
}
