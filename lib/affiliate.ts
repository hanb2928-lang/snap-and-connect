import type { AnalysisResult, AffiliateLink, UserSettings } from '@/types/database';

export function isCoupangUrl(url: string): boolean {
  return /coupang\.com/i.test(url);
}

export function isTossUrl(url: string): boolean {
  return /toss\.(to|im)/i.test(url);
}

function detectCustomPlatform(url: string): 'Coupang' | 'Toss' | 'BrandConnect' | 'Custom' {
  if (isCoupangUrl(url)) return 'Coupang';
  if (isTossUrl(url)) return 'Toss';
  if (/smartstore\.naver\.com|brand\.naver\.com|search\.shopping\.naver\.com/i.test(url)) return 'BrandConnect';
  return 'Custom';
}

export function generateAffiliateLinks(
  analysis: AnalysisResult,
  settings: UserSettings | null,
): AffiliateLink[] {
  const links: AffiliateLink[] = [];
  const query = analysis.productName || analysis.title || '';
  if (!query) return links;

  const encoded = encodeURIComponent(query);

  if (settings?.coupang_partners_id) {
    links.push({
      platform: 'Coupang',
      label: '쿠팡 파트너스',
      url: `https://www.coupang.com/np/search?component=&q=${encoded}&partner=${settings.coupang_partners_id}`,
    });
  } else {
    links.push({
      platform: 'Coupang',
      label: '쿠팡 파트너스 (ID 미설정)',
      url: 'https://partners.coupang.com/',
    });
  }

  if (settings?.toss_share_id) {
    links.push({
      platform: 'Toss',
      label: '토스 쉐어링크',
      url: `https://sharelink.toss.im/${settings.toss_share_id}`,
    });
  } else {
    links.push({
      platform: 'Toss',
      label: '토스 쉐어링크 (ID 미설정)',
      url: 'https://sharelink.toss.im/',
    });
  }

  if (settings?.naver_shopping_id) {
    links.push({
      platform: 'BrandConnect',
      label: '네이버 쇼핑',
      url: `https://search.shopping.naver.com/search/all?query=${encoded}&nsh=${settings.naver_shopping_id}`,
    });
  } else {
    links.push({
      platform: 'BrandConnect',
      label: '네이버 브랜드커넥트',
      url: 'https://brandconnect.naver.com/about/creator',
    });
  }

  return links;
}

export function generateAffiliateLinkForMatch(
  matchUrl: string,
  _platform: string,
  settings: UserSettings | null,
): string {
  if (settings?.coupang_partners_id && isCoupangUrl(matchUrl)) {
    const sep = matchUrl.includes('?') ? '&' : '?';
    return `${matchUrl}${sep}partner=${settings.coupang_partners_id}`;
  }
  return matchUrl;
}
