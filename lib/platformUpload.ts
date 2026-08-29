import { getDisclosureForPlatforms } from '@/lib/disclosure';

export type UploadPlatformKey = 'instagram' | 'blog' | 'tiktok' | 'youtube' | 'twitter';

export type DisclosurePlacement = 'body' | 'comment';

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
  youtube: {
    appUrl: 'youtube://',
    webUrl: 'https://www.youtube.com/upload',
    label: '유튜브 숏츠 앱 열기',
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
  hashtagSet: string[];
  captionStyle: string;
  titleMaxLen: number;
  bodyHint: string;
  titleHint: string;
}

const CAPTION_TEMPLATES: Record<UploadPlatformKey, PlatformCaptionTemplate> = {
  instagram: {
    hashtagSet: ['#협찬', '#제휴마케팅', '#쿠팡파트너스', '#광고', '#제품협찬', '#리뷰'],
    captionStyle: '본문 감성 문구 + 하단 최적화 해시태그 + 프로필 링크 안내',
    titleMaxLen: 125,
    titleHint: '첫 줄 후킹 문장 (125자 이내)',
    bodyHint: '감성 캡션 본문',
  },
  blog: {
    hashtagSet: ['#제휴마케팅', '#광고', '#블로그리뷰'],
    captionStyle: '제목 중심의 간결한 문구 + 댓글용 단축 링크 별도 제공',
    titleMaxLen: 100,
    titleHint: '블로그 제목 (100자 이내)',
    bodyHint: '본문 내용',
  },
  tiktok: {
    hashtagSet: ['#제휴', '#광고', '#tiktokmademebuyit', '#오늘의장바구니', '#추천', '#광고포함'],
    captionStyle: '트렌드 맞춤 원라이너 캡션 + 추천 알고리즘 타겟팅 태그',
    titleMaxLen: 100,
    titleHint: '원라이너 캡션 (100자 이내)',
    bodyHint: '추가 설명 (선택)',
  },
  youtube: {
    hashtagSet: ['#쇼츠', '#제휴마케팅', '#광고', '#Shorts', '#숏츠'],
    captionStyle: '제목(100자 이내) + 본문 단축링크 + 댓글용 공정위 문구 양식',
    titleMaxLen: 100,
    titleHint: '숏츠 제목 (100자 이내)',
    bodyHint: '본문 설명 (단축 링크 포함)',
  },
  twitter: {
    hashtagSet: ['#광고', '#제휴', '#제휴마케팅'],
    captionStyle: '간결한 한 줄 요약 + 단축 링크 + 공정위 문구',
    titleMaxLen: 280,
    titleHint: '트윗 본문 (280자 이내)',
    bodyHint: '추가 내용 (선택)',
  },
};

export function getCaptionTemplate(key: UploadPlatformKey): PlatformCaptionTemplate {
  return CAPTION_TEMPLATES[key];
}

export interface BuiltCaption {
  title: string;
  body: string;
  hashtags: string;
  fullText: string;
  commentDisclosure: string;
  commentText: string;
}

export function buildPlatformCaption(
  key: UploadPlatformKey,
  contentText: string,
  affiliateUrl: string,
  disclosurePlatforms: string[],
  autoDisclosure: boolean,
  disclosurePlacement: DisclosurePlacement = 'body',
): BuiltCaption {
  const tmpl = getCaptionTemplate(key);
  const disclosure = getDisclosureForPlatforms(disclosurePlatforms, autoDisclosure);
  const baseCaption = contentText.trim() || '마케팅 문구를 입력하면 여기에 표시됩니다.';
  const hashtags = tmpl.hashtagSet.join(' ');
  const trimmedUrl = affiliateUrl.trim();
  const disclosureInBody = disclosurePlacement === 'body';

  let title: string;
  let body: string;
  let fullText: string;

  switch (key) {
    case 'instagram':
      title = baseCaption.slice(0, tmpl.titleMaxLen);
      body = `${disclosureInBody && disclosure ? disclosure + '\n\n' : ''}${baseCaption}${trimmedUrl ? '\n\n' + trimmedUrl : ''}`;
      fullText = `${body}\n\n.\n.\n.\n${hashtags}`;
      break;
    case 'blog':
      title = baseCaption.slice(0, tmpl.titleMaxLen);
      body = `${disclosureInBody && disclosure ? disclosure + '\n\n' : ''}${baseCaption}${trimmedUrl ? '\n\n단축 링크: ' + trimmedUrl : ''}`;
      fullText = `${title}\n\n${body}${hashtags ? '\n\n' + hashtags : ''}`;
      break;
    case 'tiktok':
      title = baseCaption.slice(0, tmpl.titleMaxLen);
      body = `${baseCaption}${trimmedUrl ? '\n' + trimmedUrl : ''}`;
      fullText = `${disclosureInBody && disclosure ? disclosure + '\n' : ''}${body}\n${hashtags}`;
      break;
    case 'youtube':
      title = baseCaption.slice(0, tmpl.titleMaxLen);
      body = `${baseCaption}${trimmedUrl ? '\n\n단축 링크: ' + trimmedUrl : ''}`;
      fullText = `${disclosureInBody && disclosure ? disclosure + '\n\n' : ''}${body}${hashtags ? '\n\n' + hashtags : ''}`;
      break;
    case 'twitter':
      title = baseCaption.slice(0, tmpl.titleMaxLen);
      body = `${baseCaption}${trimmedUrl ? ' ' + trimmedUrl : ''}`;
      fullText = `${disclosureInBody && disclosure ? disclosure + '\n' : ''}${body} ${hashtags}`;
      break;
    default:
      title = baseCaption;
      body = baseCaption;
      fullText = `${disclosureInBody && disclosure ? disclosure + '\n\n' : ''}${baseCaption}`;
  }

  const commentDisclosure = !disclosureInBody ? disclosure : '';
  const commentText = commentDisclosure
    ? `${commentDisclosure}${trimmedUrl ? '\n\n단축 링크: ' + trimmedUrl : ''}`
    : '';

  return { title, body, hashtags, fullText, commentDisclosure, commentText };
}

export function getCaptionStyleDescription(key: UploadPlatformKey): string {
  return getCaptionTemplate(key).captionStyle;
}
