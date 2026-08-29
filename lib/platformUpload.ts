import { getDisclosureForPlatforms } from '@/lib/disclosure';

export type UploadPlatformKey = 'instagram' | 'blog' | 'tiktok' | 'twitter';

export interface PlatformDeepLink {
  appUrl: string;
  webUrl: string;
  label: string;
}

const DEEP_LINKS: Record<UploadPlatformKey, PlatformDeepLink> = {
  instagram: {
    appUrl: 'instagram://app/camera',
    webUrl: 'https://www.instagram.com/',
    label: '인스타그램 앱 열기',
  },
  blog: {
    appUrl: 'com.naver.blog://open',
    webUrl: 'https://blog.naver.com/',
    label: '네이버 블로그 열기',
  },
  tiktok: {
    appUrl: 'tiktok://',
    webUrl: 'https://www.tiktok.com/upload',
    label: '틱톡 앱 열기',
  },
  twitter: {
    appUrl: 'twitter://post',
    webUrl: 'https://x.com/compose/post',
    label: 'X(트위터) 열기',
  },
};

export function getDeepLink(key: UploadPlatformKey): PlatformDeepLink {
  return DEEP_LINKS[key];
}

export interface PlatformCaptionTemplate {
  prefix: string;
  suffix: string;
  hashtagSet: string[];
  captionStyle: string;
}

const CAPTION_TEMPLATES: Record<UploadPlatformKey, PlatformCaptionTemplate> = {
  instagram: {
    prefix: '',
    suffix: '',
    hashtagSet: ['#협찬', '#제휴마케팅', '#광고', '#제품협찬', '#리뷰'],
    captionStyle: '감성 캡션 상단 + 제휴 해시태그 최상단 배치',
  },
  blog: {
    prefix: '',
    suffix: '',
    hashtagSet: ['#제휴마케팅', '#광고'],
    captionStyle: '제목 중심의 간결한 문구 + 댓글용 단축 링크 별도 제공',
  },
  tiktok: {
    prefix: '',
    suffix: '',
    hashtagSet: ['#제휴', '#광고', '#tiktokmademebuyit', '#오늘의장바구니'],
    captionStyle: 'Z세대 맞춤 짧은 원라이너 대사 + 트렌드 해시태그 조합',
  },
  twitter: {
    prefix: '',
    suffix: '',
    hashtagSet: ['#광고', '#제휴'],
    captionStyle: '간결한 한 줄 요약 + 단축 링크 + 공정위 문구',
  },
};

export function getCaptionTemplate(key: UploadPlatformKey): PlatformCaptionTemplate {
  return CAPTION_TEMPLATES[key];
}

export function buildPlatformCaption(
  key: UploadPlatformKey,
  contentText: string,
  affiliateUrl: string,
  disclosurePlatforms: string[],
  autoDisclosure: boolean,
): { caption: string; hashtags: string; fullText: string } {
  const tmpl = getCaptionTemplate(key);
  const disclosure = getDisclosureForPlatforms(disclosurePlatforms, autoDisclosure);

  const baseCaption = contentText.trim() || '마케팅 문구를 입력하면 여기에 표시됩니다.';
  const hashtags = tmpl.hashtagSet.join(' ');

  let caption: string;
  let fullText: string;

  switch (key) {
    case 'instagram':
      caption = `${disclosure ? disclosure + '\n\n' : ''}${baseCaption}\n\n${affiliateUrl.trim() ? affiliateUrl.trim() : ''}`;
      fullText = `${caption}\n\n${hashtags}`;
      break;
    case 'blog':
      caption = `${baseCaption}`;
      fullText = `${disclosure ? disclosure + '\n\n' : ''}${caption}${affiliateUrl.trim() ? '\n\n단축 링크: ' + affiliateUrl.trim() : ''}${hashtags ? '\n\n' + hashtags : ''}`;
      break;
    case 'tiktok':
      caption = `${baseCaption}${affiliateUrl.trim() ? '\n' + affiliateUrl.trim() : ''}`;
      fullText = `${disclosure ? disclosure + '\n' : ''}${caption}\n${hashtags}`;
      break;
    case 'twitter':
      caption = `${baseCaption}${affiliateUrl.trim() ? ' ' + affiliateUrl.trim() : ''}`;
      fullText = `${disclosure ? disclosure + '\n' : ''}${caption} ${hashtags}`;
      break;
    default:
      caption = baseCaption;
      fullText = `${disclosure ? disclosure + '\n\n' : ''}${caption}`;
  }

  return { caption, hashtags, fullText };
}

export function getCaptionStyleDescription(key: UploadPlatformKey): string {
  return getCaptionTemplate(key).captionStyle;
}
