export interface PlatformDisclosure {
  platform: string;
  short: string;
  full: string;
}

export const COUPANG_DISCLOSURE =
  '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

export const COUPANG_DISCLOSURE_SHORT = '쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다.';

export const NAVER_DISCLOSURE =
  '이 포스팅은 네이버 커넥트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.';

export const NAVER_DISCLOSURE_SHORT = '네이버 커넥트 활동의 일환으로 수수료를 제공받을 수 있습니다.';

export const TOSS_DISCLOSURE =
  '이 포스팅은 토스 쉐어링크를 포함하고 있으며, 링크를 통해 송금 시 일정액의 보상을 제공받을 수 있습니다.';

export const TOSS_DISCLOSURE_SHORT = '토스 쉐어링크를 통해 보상을 제공받을 수 있습니다.';

export const SMARTSTORE_DISCLOSURE =
  '이 포스팅은 네이버 커넥트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.';

export const SMARTSTORE_DISCLOSURE_SHORT =
  '네이버 커넥트 활동의 일환으로 수수료를 제공받을 수 있습니다.';

export const GENERIC_DISCLOSURE =
  '이 포스팅은 네이버 커넥트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.';

export const GENERIC_DISCLOSURE_SHORT = '네이버 커넥트 활동의 일환으로 수수료를 제공받을 수 있습니다.';

const PLATFORM_DISCLOSURES: Record<string, PlatformDisclosure> = {
  Coupang: {
    platform: 'Coupang',
    short: COUPANG_DISCLOSURE_SHORT,
    full: COUPANG_DISCLOSURE,
  },
  NaverShopping: {
    platform: 'NaverShopping',
    short: NAVER_DISCLOSURE_SHORT,
    full: NAVER_DISCLOSURE,
  },
  BrandConnect: {
    platform: 'BrandConnect',
    short: NAVER_DISCLOSURE_SHORT,
    full: NAVER_DISCLOSURE,
  },
  Toss: {
    platform: 'Toss',
    short: TOSS_DISCLOSURE_SHORT,
    full: TOSS_DISCLOSURE,
  },
  OliveYoung: {
    platform: 'OliveYoung',
    short: '올리브영 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 올리브영 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  Zigzag: {
    platform: 'Zigzag',
    short: '지그재그 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 지그재그 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  TodayHouse: {
    platform: 'TodayHouse',
    short: '오늘의집 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 오늘의집 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  Kurly: {
    platform: 'Kurly',
    short: '컬리 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 컬리 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  AliExpress: {
    platform: 'AliExpress',
    short: '알리익스프레스 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 알리익스프레스 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  MyRealTrip: {
    platform: 'MyRealTrip',
    short: '마이리얼트립 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 마이리얼트립 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
  Klook: {
    platform: 'Klook',
    short: '클룩 제휴 활동의 일환으로 수수료를 제공받을 수 있습니다.',
    full: '이 포스팅은 클룩 제휴 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.',
  },
};

export function getPlatformDisclosure(platform: string): PlatformDisclosure {
  return PLATFORM_DISCLOSURES[platform] || {
    platform,
    short: GENERIC_DISCLOSURE_SHORT,
    full: GENERIC_DISCLOSURE,
  };
}

export function getDisclosureForPlatforms(platforms: string[], enabled = true): string {
  if (!enabled) return '';
  if (platforms.length === 0) return GENERIC_DISCLOSURE;
  if (platforms.length === 1) return getPlatformDisclosure(platforms[0]).full;
  return platforms
    .map((p) => getPlatformDisclosure(p).full)
    .join('\n');
}

export function getDisclosureShortForPlatforms(platforms: string[], enabled = true): string {
  if (!enabled) return '';
  if (platforms.length === 0) return GENERIC_DISCLOSURE_SHORT;
  if (platforms.length === 1) return getPlatformDisclosure(platforms[0]).short;
  return platforms
    .map((p) => getPlatformDisclosure(p).short)
    .join(' / ');
}

export function getShareDisclosureForPlatforms(platforms: string[], enabled = true): string {
  if (!enabled) return '';
  if (platforms.length === 0) return GENERIC_DISCLOSURE;
  return platforms
    .map((p) => `(${getPlatformDisclosure(p).platform}) ${getPlatformDisclosure(p).full}`)
    .join('\n');
}
