import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  TextInput,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Zap, Download, RefreshCw, CircleAlert as AlertCircle, CloudUpload, Loader as Loader2, BookOpen, Sparkles, Mic, Volume2, Share2, Music2, Youtube, Instagram, Lightbulb, Smartphone, AlignVerticalJustifyCenter, Clock, ChevronDown, Shirt, X, Check, Play, Pause, Pencil, Globe } from 'lucide-react-native';
import { VideoPreview } from '@/components/VideoPreview';
import { VirtualFittingGallery } from '@/components/VirtualFittingGallery';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { getWebViewOverlayScript } from '@/lib/canvasOverlay';
import { uploadAssetFromFileUri, uploadAssetBlob, saveAssetRecord } from '@/lib/savedAssets';
import { urlToDataUrl } from '@/lib/base64';
import { COMIC_SCENARIO_FUNCTION_URL, TTS_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import { getOpenAiVoiceParams, getVoicesByCategory, VOICE_CATEGORIES, type VoiceCategory, type TtsVoice, MULTILINGUAL_VOICES, getMultilingualVoice, type MultilingualVoice } from '@/lib/ttsVoices';
import { getUserSettings } from '@/lib/settings';
import { fetchMatchedTrendingHashtags } from '@/lib/trendingHashtags';
import { SoundPunchEditor } from '@/components/SoundPunchEditor';
import { VideoProgressIndicator } from '@/components/VideoProgressIndicator';
import { TemplateBadge } from '@/components/TemplateBadge';
import { useHybridTemplate } from '@/hooks/useHybridTemplate';
import type { PunchMarker } from '@/hooks/useSoundPunch';
import { safeFetch } from '@/lib/apiClient';
import type { PlatformKey, LocalStoreInfo } from '@/types/database';
import type { StickerStyle } from '@/components/StickerLink';
import type { StickerPosition } from '@/components/TemplateCard';
import type { Variant } from '@/components/VariantGenerator';

export interface ComicPanel {
  speech: string;
  sfx: string;
  emotion: string;
  episodeLabel?: string;
}

interface MbtiCommentary {
  type: string;
  label: string;
  comment: string;
}

interface ComicShortGeneratorProps {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  fileName: string;
  affiliatePlatforms?: string[];
  platform?: PlatformKey;
  shortUrl?: string;
  stickerPosition?: StickerPosition;
  stickerStyle?: StickerStyle;
  stickerSize?: number;
  productName?: string;
  productCategory?: string;
  priceEstimate?: string;
  oneLiner?: string;
  productAdvantages?: string[];
  localStoreInfo?: LocalStoreInfo | null;
  brandPersona?: string | null;
  preloadedVariant?: Variant | null;
}

type GenState = 'idle' | 'generating' | 'done' | 'error';
type PanelLayout = 'single' | 'split-2' | 'split-3';

type MoodTemplate = 'cute-webtoon' | 'noir' | 'sale-popup' | 'retro' | 'premium-minimal' | 'energetic-popart';
type ArtStyle = 'insta-toon' | 'b-grade' | 'food-toon' | 'american-comic' | 'ghibli';

interface ArtStyleConfig {
  label: string;
  desc: string;
  mood: MoodTemplate;
  voiceCategory: VoiceCategory;
  recommendedFor: string;
}

const ART_STYLES: Record<ArtStyle, ArtStyleConfig> = {
  'insta-toon': {
    label: '인스타툰 / 일상툰',
    desc: '깔끔한 라인과 파스텔톤 컬러',
    mood: 'cute-webtoon',
    voiceCategory: 'bright',
    recommendedFor: '리빙, 자취용품, 뷰티 제품에 최적화',
  },
  'b-grade': {
    label: 'B급 병맛 / 짤방',
    desc: '와일드한 필선과 과장된 표정',
    mood: 'energetic-popart',
    voiceCategory: 'viral',
    recommendedFor: '가성비 아이템, 웃음 유발 마케팅에 최적화',
  },
  'food-toon': {
    label: '미식 / 요리 툰',
    desc: '음식 질감을 살린 고화질 애니메이션 컷',
    mood: 'retro',
    voiceCategory: 'bright',
    recommendedFor: '식품, 주방용품, 레시피 콘텐츠에 최적화',
  },
  'american-comic': {
    label: '아메리칸 코믹스',
    desc: '강렬한 대비와 팝아트 느낌의 질감',
    mood: 'energetic-popart',
    voiceCategory: 'bright',
    recommendedFor: 'IT 기기, 전자기기, 스포츠용품에 최적화',
  },
  'ghibli': {
    label: '감성 지브리풍',
    desc: '따뜻하고 몽환적인 배경 및 파스텔 느낌',
    mood: 'premium-minimal',
    voiceCategory: 'narration',
    recommendedFor: '패션, 인테리어, 프래그런스 제품에 최적화',
  },
};

const ART_STYLE_KEYS: ArtStyle[] = ['insta-toon', 'b-grade', 'food-toon', 'american-comic', 'ghibli'];

const EMOTION_SFX_MAP: Record<string, string[]> = {
  '고민': ['헐…', '으음…', '띠용?'],
  '놀람': ['?!', '헐 대박!', '촤악!'],
  '행복': ['샤방~', '하세요♪', '반짝반짝!'],
  '확신': ['따봉!', '역시!', 'KWAANG!'],
  '설렘': ['두근두근~', '샤방~', '쿵쿵!'],
  '슬픔': ['뚝뚝…', '으앙!', '부들부들…'],
  '분노': ['콰앙!!', '아진짜!', '불끈!'],
  '도전': ['가보자고!', '후후후', '번쩍!'],
  '행동': ['출발!', '슝~', 'KWAANG!'],
  '지각': ['앗 늦었다!', '후다닥!', '찰칵!'],
  '수다': ['주절주절~', '티키타카!', '재밌어!'],
  '감동': ['눈물 앞둥', '감동쓰…', '오예~'],
};

function autoMatchSfx(emotion: string, fallback: string): string {
  const sfxList = EMOTION_SFX_MAP[emotion];
  if (!sfxList || sfxList.length === 0) return fallback;
  return sfxList[Math.floor(Math.random() * sfxList.length)];
}

interface MoodConfig {
  filter: string;
  overlayColor: string;
  bgColor: string;
  bubbleFill: string;
  bubbleBorder: string;
  bubbleText: string;
  sfxColor: string;
  halftone: boolean;
  halftoneColor: string;
  halftoneAlpha: number;
  panelBorder: string;
  panelBorderWidth: number;
  titleStrokeColor: string;
  titleFillColor: string;
  accentOverride: string;
}

const MOOD_TEMPLATES: Record<MoodTemplate, { label: string; desc: string; config: MoodConfig }> = {
  'cute-webtoon': {
    label: '귀여운 웹툰풍',
    desc: '부드러운 파스텔톤, 둥근 말풍선, 통통한 효과음',
    config: {
      filter: 'saturate(1.3) contrast(1.2) brightness(1.15)',
      overlayColor: 'rgba(255,182,193,0.10)',
      bgColor: '#1a1428',
      bubbleFill: 'rgba(255,250,240,0.97)',
      bubbleBorder: '#FF6B9D',
      bubbleText: '#3d2b4f',
      sfxColor: '#FF6B9D',
      halftone: false,
      halftoneColor: '#FF6B9D',
      halftoneAlpha: 0,
      panelBorder: '#FFB6C1',
      panelBorderWidth: 8,
      titleStrokeColor: '#2d1b3d',
      titleFillColor: '#FFB6C1',
      accentOverride: '#FF6B9D',
    },
  },
  'noir': {
    label: '시크한 느와르풍',
    desc: '깊은 블랙톤, 날카로운 화이트 말풍선, 강렬한 대비',
    config: {
      filter: 'grayscale(0.8) contrast(2.0) brightness(0.9)',
      overlayColor: 'rgba(0,0,0,0.35)',
      bgColor: '#050505',
      bubbleFill: 'rgba(245,245,245,0.97)',
      bubbleBorder: '#e0e0e0',
      bubbleText: '#0a0a0a',
      sfxColor: '#ffffff',
      halftone: true,
      halftoneColor: '#666666',
      halftoneAlpha: 0.06,
      panelBorder: '#2a2a2a',
      panelBorderWidth: 12,
      titleStrokeColor: '#000000',
      titleFillColor: '#e8e8e8',
      accentOverride: '#c0c0c0',
    },
  },
  'sale-popup': {
    label: '신상 특가 팝업풍',
    desc: '빨간 배지, 노란 효과음, 반짝이는 할인 느낌',
    config: {
      filter: 'saturate(2.0) contrast(1.6) brightness(1.1)',
      overlayColor: 'rgba(255,215,0,0.12)',
      bgColor: '#1e0a0a',
      bubbleFill: 'rgba(255,255,255,0.97)',
      bubbleBorder: '#FF1744',
      bubbleText: '#1a1a2e',
      sfxColor: '#FFD600',
      halftone: true,
      halftoneColor: '#FF1744',
      halftoneAlpha: 0.10,
      panelBorder: '#FFD600',
      panelBorderWidth: 10,
      titleStrokeColor: '#1a1a2e',
      titleFillColor: '#FFD600',
      accentOverride: '#FF1744',
    },
  },
  'retro': {
    label: '빈티지 레트로풍',
    desc: '세피아 톤, 하프톤 패턴, 중후한 카툰 느낌',
    config: {
      filter: 'sepia(0.5) saturate(1.3) contrast(1.3) brightness(1.05)',
      overlayColor: 'rgba(139,90,43,0.12)',
      bgColor: '#1e1410',
      bubbleFill: 'rgba(255,245,225,0.97)',
      bubbleBorder: '#D4A574',
      bubbleText: '#3d2817',
      sfxColor: '#D4A574',
      halftone: true,
      halftoneColor: '#8B5A2B',
      halftoneAlpha: 0.08,
      panelBorder: '#D4A574',
      panelBorderWidth: 9,
      titleStrokeColor: '#2d1810',
      titleFillColor: '#F0D9A8',
      accentOverride: '#D4A574',
    },
  },
  'premium-minimal': {
    label: '프리미엄 미니멀풍',
    desc: '깔끔한 화이트, 얇은 라인, 우아한 글씨',
    config: {
      filter: 'saturate(0.9) contrast(1.15) brightness(1.2)',
      overlayColor: 'rgba(245,245,245,0.08)',
      bgColor: '#0f0f12',
      bubbleFill: 'rgba(255,255,255,0.98)',
      bubbleBorder: '#c9a84c',
      bubbleText: '#1a1a2e',
      sfxColor: '#c9a84c',
      halftone: false,
      halftoneColor: '#c9a84c',
      halftoneAlpha: 0,
      panelBorder: '#c9a84c',
      panelBorderWidth: 4,
      titleStrokeColor: '#0a0a0a',
      titleFillColor: '#f5f5f5',
      accentOverride: '#c9a84c',
    },
  },
  'energetic-popart': {
    label: '에너제틱 팝아트풍',
    desc: '강렬한 색상, 하프톤 텍스처, 튀는 효과음',
    config: {
      filter: 'saturate(2.4) contrast(1.5) brightness(1.05)',
      overlayColor: 'rgba(255,200,0,0.12)',
      bgColor: '#0a0f1e',
      bubbleFill: 'rgba(255,255,255,0.96)',
      bubbleBorder: '#2f9dff',
      bubbleText: '#1a1a2e',
      sfxColor: '#FFD600',
      halftone: true,
      halftoneColor: '#2f9dff',
      halftoneAlpha: 0.08,
      panelBorder: '#ffffff',
      panelBorderWidth: 10,
      titleStrokeColor: '#1a1a2e',
      titleFillColor: '#ffffff',
      accentOverride: '#2f9dff',
    },
  },
};

const MOOD_KEYS: MoodTemplate[] = ['cute-webtoon', 'noir', 'sale-popup', 'retro', 'premium-minimal', 'energetic-popart'];

interface AutoConfig {
  mood: MoodTemplate;
  duration: ComicDuration;
  panelCount: number;
  artStyle?: ArtStyle;
}

const CATEGORY_STYLE_MAP: Record<string, ArtStyle> = {
  '뷰티': 'insta-toon',
  '패션': 'ghibli',
  '디지털': 'american-comic',
  '가전': 'american-comic',
  '생활': 'insta-toon',
  '주방': 'food-toon',
  '스포츠': 'american-comic',
  '식품': 'food-toon',
  '유아': 'insta-toon',
  '반려': 'insta-toon',
};

function autoDecideConfig(category: string, advantages: string[], artStyleOverride?: ArtStyle): AutoConfig {
  const style = artStyleOverride || CATEGORY_STYLE_MAP[category] || 'insta-toon';
  const artConfig = ART_STYLES[style];
  const mood = artConfig?.mood || 'energetic-popart';
  const hasRichStory = advantages.length >= 3;
  const panelCount = hasRichStory ? 3 : category === '뷰티' || category === '패션' ? 2 : 1;
  const duration: ComicDuration = panelCount >= 3 ? 20000 : panelCount === 2 ? 15000 : 10000;
  return { mood, duration, panelCount, artStyle: style };
}

function fallbackSplitHook(hook: string, title: string, count: number): string[] {
  if (count <= 1) return [hook];
  const parts: string[] = [hook];
  if (count >= 2) {
    parts.push(title ? `${title} 최고야!` : '이거 진짜 추천!');
  }
  if (count >= 3) {
    parts.push('지금 바로 확인해보자!');
  }
  return parts.slice(0, count);
}

const FPS = 30;
const W = 1080;
const H = 1920;

type ComicDuration = 10000 | 15000 | 20000 | 30000;


type ComicBuildParams = {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  shortUrl: string;
  moodTemplate: MoodTemplate;
  panelLayout: PanelLayout;
  disclosureText: string;
  stickerPosition: StickerPosition;
  stickerStyle: StickerStyle;
  stickerSize: number;
  panels: ComicPanel[];
  duration: number;
  episodeMode: boolean;
  narrationAudioDataUrl: string | null;
  punchMarkers: { time: number; effect: string; intensity?: number }[];
  punchAudioDataUrl: string | null;
  mbtiCommentary: MbtiCommentary[];
  emotionOverlay?: boolean;
  localStoreInfo?: LocalStoreInfo | null;
};

function buildComicScriptBody(params: ComicBuildParams): string {
  const { imageUrl, hook, title, hashtags, accentColor, shortUrl, moodTemplate, panelLayout, disclosureText, stickerPosition, stickerStyle, stickerSize, panels, episodeMode, narrationAudioDataUrl, punchMarkers, punchAudioDataUrl, mbtiCommentary, emotionOverlay = false, localStoreInfo = null } = params;
  const hashtagStr = hashtags.slice(0, 6).map((h) => `#${h}`).join(' ');

  const mood = MOOD_TEMPLATES[moodTemplate] || MOOD_TEMPLATES['energetic-popart'];
  const mc = mood.config;
  const effectiveAccent = mc.accentOverride || accentColor;

  const filterCode = mc.filter;
  const overlayColor = mc.overlayColor;

  return `(function(){
  window.onerror=function(message){postMsg('error',{msg:'render script error: '+String(message)});};
  var W=${W}, H=${H};
  var canvas=document.getElementById('cv');
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var hook=${JSON.stringify(hook)};
  var title=${JSON.stringify(title)};
  var hashtagStr=${JSON.stringify(hashtagStr)};
  var accentColor=${JSON.stringify(accentColor)};
  var shortUrl=${JSON.stringify(shortUrl)};
  var disclosureText=${JSON.stringify(disclosureText)};
  var filterCode=${JSON.stringify(filterCode)};
  var overlayColor=${JSON.stringify(overlayColor)};
  var duration=${params.duration};
  var FPS=${FPS};
  var moodTemplate=${JSON.stringify(moodTemplate)};
  var moodConfig=${JSON.stringify(mc)};
  var effectiveAccent=${JSON.stringify(effectiveAccent)};
  var panelLayout=${JSON.stringify(panelLayout)};
  var stickerPosition=${JSON.stringify(stickerPosition)};
  var stickerStyle=${JSON.stringify(stickerStyle)};
  var stickerSize=${stickerSize};
  var episodeMode=${episodeMode};
  var narrationAudioDataUrl=${JSON.stringify(narrationAudioDataUrl)};
  var punchMarkers=${JSON.stringify(punchMarkers)};
  var punchAudioDataUrl=${JSON.stringify(punchAudioDataUrl)};
  var mbtiCommentary=${JSON.stringify(mbtiCommentary)};
  var emotionOverlay=${emotionOverlay};
  var localStoreInfo=${JSON.stringify(localStoreInfo)};
  var imageUrl=${JSON.stringify(imageUrl)};
  var panelEmotions=${JSON.stringify(panels.map(p => p.emotion || ''))};
  var emotionEmojis={'\uACE0\uBBFC':'\uD83D\uDE15','\uB188\uB78C':'\uD83D\uDE31','\uD589\uBCF5':'\uD83D\uDE0D','\uD655\uC2E0':'\uD83D\uDE0E','\uC124\uB808':'\uD83D\uDE0D','\uC2AC\uD544':'\uD83D\uDE22','\uBD84\uB178':'\uD83D\uDE24','\uB3C4\uC804':'\uD83D\uDE01','\uD589\uB3D9':'\uD83D\uDE80','\uC9C0\uB8CC':'\uD83D\uDE34','\uC218\uB2E4':'\uD83D\uDE4B','\uAC10\uB3D9':'\uD83D\uDE2D'};
  var emotionColors={'\uACE0\uBBFC':'#FFD600','\uB188\uB78C':'#FF6B6B','\uD589\uBCF5':'#10B981','\uD655\uC2E0':'#3B82F6','\uC124\uB808':'#EC4899','\uC2AC\uD544':'#6366F1','\uBD84\uB178':'#F59E0B','\uB3C4\uC804':'#EF4444','\uD589\uB3D9':'#8B5CF6','\uC9C0\uB8CC':'#64748B','\uC218\uB2E4':'#06B6D4','\uAC10\uB3D9':'#F43F5E'};
  var mbtiColors={'INTJ':'#8b5cf6','ENFP':'#f59e0b','ISTP':'#06b3d4','ENFJ':'#10b981'};

  function drawEmotionOverlay(ctx,emotion,x,y,emoji,scale,color,fontSize){
    if(!emoji)return;
    fontSize=fontSize||120;
    var badgeW=Math.round(fontSize*0.5),badgeH=Math.round(fontSize*0.23);
    var badgeY=fontSize*0.35+badgeH/2;
    var badgeFS=Math.max(11,Math.round(fontSize*0.15));
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    ctx.shadowColor='rgba(0,0,0,0.5)';
    ctx.shadowBlur=15;
    ctx.shadowOffsetY=4;
    ctx.font=fontSize+'px sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(emoji,0,0);
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.fillStyle=color;
    roundRect(ctx,-badgeW/2,badgeY-badgeH/2,badgeW,badgeH,Math.round(badgeH/2));
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font='700 '+badgeFS+'px sans-serif';
    ctx.fillText(emotion,0,badgeY);
    ctx.textAlign='left';
    ctx.restore();
  }

  function drawMbtiBubble(ctx,index,total,alpha){
    if(!mbtiCommentary||mbtiCommentary.length===0)return;
    var m=mbtiCommentary[index%mbtiCommentary.length];
    var bubbleW=W-120;
    var bubbleH=52;
    var gap=6;
    var totalH=total*(bubbleH+gap)-gap;
    var startY=H-totalH-40;
    var bx=60;
    var by=startY+index*(bubbleH+gap);
    ctx.save();
    ctx.globalAlpha=alpha;
    var color=mbtiColors[m.type]||accentColor;
    ctx.shadowColor='rgba(0,0,0,0.5)';
    ctx.shadowBlur=10;
    ctx.shadowOffsetY=3;
    ctx.fillStyle='rgba(255,255,255,0.95)';
    roundRect(ctx,bx,by,bubbleW,bubbleH,12);
    ctx.fill();
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=color;
    ctx.lineWidth=3;
    ctx.stroke();
    ctx.fillStyle=color;
    roundRect(ctx,bx+10,by+8,42,bubbleH-16,8);
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font='700 15px sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(m.type,bx+10+21,by+bubbleH/2);
    ctx.textAlign='left';
    ctx.fillStyle='#1a1a2e';
    ctx.font='700 17px sans-serif';
    ctx.textBaseline='middle';
    ctx.fillText(m.label,bx+64,by+bubbleH*0.32);
    ctx.fillStyle='#444';
    ctx.font='500 16px sans-serif';
    var commentText=m.comment;
    if(commentText.length>30)commentText=commentText.slice(0,30)+'...';
    ctx.fillText(commentText,bx+64,by+bubbleH*0.7);
    ctx.restore();
  }

  function getStickerPos(pos){
    var m=48;var sw=Math.round(stickerSize*2.2);var sh=Math.round(stickerSize*0.9);
    var panelBottom=H*0.62;
    var belowPanelY=panelBottom+16;
    switch(pos){
      case 'top-left':return{x:m,y:m};
      case 'top-right':return{x:W-m-sw,y:m};
      case 'bottom-left':return{x:m,y:belowPanelY};
      case 'bottom-right':return{x:W-m-sw,y:belowPanelY};
      default:return{x:m,y:m};
    }
  }

  function drawStickerLink(ctx,pos,style,size,url,alpha){
    if(!url)return;
    var sp=getStickerPos(pos);
    var padH=Math.round(size*0.14);var padV=Math.round(size*0.1);
    var labelFS=Math.max(9,Math.round(size*0.15));
    var iconSize=Math.round(size*0.16);
    var arrowSize=Math.round(size*0.13);
    ctx.save();
    ctx.globalAlpha=alpha;
    var bg='rgba(255,255,255,0.95)';
    var borderColor=null;
    var labelColor='#1e3a5f';
    var arrowColor='#3b82f6';
    var radius=999;
    if(style==='rounded'){radius=Math.round(size*0.16);}
    else if(style==='neon'){bg='rgba(10,15,30,0.88)';borderColor=accentColor;labelColor=accentColor;arrowColor=accentColor;radius=Math.round(size*0.16);}
    else if(style==='minimal'){bg='rgba(255,255,255,0.82)';labelColor='#6b7280';arrowColor='#9ca3af';radius=Math.round(size*0.1);padH=Math.round(size*0.11);padV=Math.round(size*0.08);}
    ctx.shadowColor='rgba(0,0,0,0.18)';ctx.shadowBlur=8;ctx.shadowOffsetY=2;
    var label='\\uAD6C\\uB9E4\\uD558\\uAE30';
    ctx.font='600 '+labelFS+'px sans-serif';
    var textW=ctx.measureText(label).width;
    var sw=padH+iconSize+4+textW+6+arrowSize+padH;
    var sh=padV*2+Math.max(iconSize,labelFS,arrowSize);
    ctx.fillStyle=bg;
    roundRect(ctx,sp.x,sp.y,sw,sh,radius);
    ctx.fill();
    ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    if(borderColor){ctx.strokeStyle=borderColor;ctx.lineWidth=1.5;ctx.stroke();}
    var iconX=sp.x+padH;
    var iconY=sp.y+sh/2-iconSize/2;
    ctx.strokeStyle=labelColor;
    ctx.fillStyle=labelColor;
    ctx.lineWidth=Math.max(1.2,iconSize*0.08);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    var cx=iconX+iconSize/2;
    var headR=iconSize*0.28;
    var headCy=iconY+iconSize*0.28;
    ctx.beginPath();
    ctx.arc(cx,headCy,headR,0,Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx-headR*0.35,headCy-headR*0.1,iconSize*0.03,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx+headR*0.35,headCy-headR*0.1,iconSize*0.03,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx,headCy+headR*0.25,headR*0.4,0.15*Math.PI,0.85*Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx,iconY+iconSize*0.62,iconSize*0.42,iconSize*0.18,0,0,Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-iconSize*0.35,iconY+iconSize*0.55);
    ctx.quadraticCurveTo(cx-iconSize*0.48,iconY+iconSize*0.3,cx-iconSize*0.4,iconY+iconSize*0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx+iconSize*0.35,iconY+iconSize*0.55);
    ctx.quadraticCurveTo(cx+iconSize*0.48,iconY+iconSize*0.3,cx+iconSize*0.4,iconY+iconSize*0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-iconSize*0.22,iconY+iconSize*0.78);
    ctx.quadraticCurveTo(cx-iconSize*0.35,iconY+iconSize*0.95,cx-iconSize*0.42,iconY+iconSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx+iconSize*0.22,iconY+iconSize*0.78);
    ctx.quadraticCurveTo(cx+iconSize*0.35,iconY+iconSize*0.95,cx+iconSize*0.42,iconY+iconSize);
    ctx.stroke();
    ctx.lineCap='butt';
    ctx.lineJoin='miter';
    var textX=iconX+iconSize+4;
    ctx.textAlign='left';
    ctx.fillStyle=labelColor;
    ctx.font='600 '+labelFS+'px sans-serif';
    ctx.textBaseline='middle';
    ctx.fillText(label,textX,sp.y+sh/2);
    ctx.fillStyle=arrowColor;
    ctx.font='700 '+arrowSize+'px sans-serif';
    ctx.fillText('\\u2192',textX+textW+6,sp.y+sh/2);
    ctx.textAlign='left';
    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function easeOutCubic(t){return 1-Math.pow(1-t,3);}
  function easeOutBack(t){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}
  function drawTextLines(ctx,text,x,y,maxWidth,lineHeight){
    var chars=Array.from(text);var line='';var cy=y;
    for(var i=0;i<chars.length;i++){
      var ch=chars[i];
      if(ch==='\\n'){ctx.fillText(line,x,cy);line='';cy+=lineHeight;continue;}
      var tl=line+ch;
      if(ctx.measureText(tl).width>maxWidth&&line!==''){ctx.fillText(line,x,cy);line=ch;cy+=lineHeight;}
      else{line=tl;}
    }
    if(line)ctx.fillText(line,x,cy);
    return cy;
  }
  function strokeTextLines(ctx,text,x,y,maxWidth,lineHeight){
    var chars=Array.from(text);var line='';var cy=y;
    for(var i=0;i<chars.length;i++){
      var ch=chars[i];
      if(ch==='\\n'){ctx.strokeText(line,x,cy);line='';cy+=lineHeight;continue;}
      var tl=line+ch;
      if(ctx.measureText(tl).width>maxWidth&&line!==''){ctx.strokeText(line,x,cy);line=ch;cy+=lineHeight;}
      else{line=tl;}
    }
    if(line)ctx.strokeText(line,x,cy);
    return cy;
  }

  function drawSpeechBubble(ctx,x,y,w,h,r,text,font,color,fillColor,textColor){
    ctx.fillStyle=fillColor||'rgba(255,255,255,0.96)';
    ctx.strokeStyle=color;
    ctx.lineWidth=5;
    roundRect(ctx,x,y,w,h,r);
    ctx.fill();ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x+w*0.3,y+h);
    ctx.lineTo(x+w*0.45,y+h+30);
    ctx.lineTo(x+w*0.5,y+h);
    ctx.closePath();
    ctx.fillStyle=fillColor||'rgba(255,255,255,0.96)';
    ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle=textColor||'#1a1a2e';
    ctx.font=font;ctx.textBaseline='top';
    drawTextLines(ctx,text,x+24,y+20,w-48,h-40,38);
  }

  function drawSfxSticker(ctx,text,x,y,fontSize,color,rotation){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation*Math.PI/180);
    ctx.font='900 '+fontSize+'px sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.strokeStyle='#1a1a2e';
    ctx.lineWidth=8;
    ctx.lineJoin='round';
    ctx.strokeText(text,0,0);
    ctx.fillStyle=color;
    ctx.fillText(text,0,0);
    ctx.restore();
    ctx.textAlign='left';
  }

  function drawHalftonePattern(ctx,x,y,w,h,dotSize,spacing,color,alpha){
    ctx.save();
    ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.fillStyle=color;
    ctx.globalAlpha=alpha;
    for(var dy=y;dy<y+h;dy+=spacing){
      for(var dx=x;dx<x+w;dx+=spacing){
        var off=(Math.floor((dy-y)/spacing)%2)*spacing/2;
        ctx.beginPath();
        ctx.arc(dx+off,dy,dotSize,0,Math.PI*2);
        ctx.fill();
      }
    }
    ctx.globalAlpha=1;
    ctx.restore();
  }

  function drawEpisodeLabel(ctx,label,x,y,color){
    if(!label)return;
    ctx.save();
    ctx.fillStyle=color;
    roundRect(ctx,x,y,120,36,8);
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.font='700 22px sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(label,x+60,y+18);
    ctx.textAlign='left';
    ctx.restore();
  }

  ${getWebViewOverlayScript()}

  function postMsg(type,data){
    var msg=JSON.stringify({type:type,data:data||{}});
    if(window.__comicPostMsg){window.__comicPostMsg(msg);}
    else if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}
    else if(window.parent&&window.parent!==window){window.parent.postMessage(msg,'*');}
  }

  var img=new Image();
  var imgLoadTimeout=setTimeout(function(){postMsg('error',{msg:'image load timeout'});},45000);
  img.onload=function(){
    clearTimeout(imgLoadTimeout);
    postMsg('ready',{});
    try{startGeneration();}catch(e){
      postMsg('error',{msg:'generation failed: '+(e&&e.message||'unknown')});
    }
  };
  img.onerror=function(){
    clearTimeout(imgLoadTimeout);
    postMsg('error',{msg:'image load failed (CORS or network)'});
  };
  if(imageUrl.indexOf('data:')===0){
    img.src=imageUrl;
  } else {
    fetch(imageUrl,{mode:'cors'}).then(function(r){
      if(!r.ok)throw new Error('fetch '+r.status);
      return r.blob();
    }).then(function(blob){
      var reader=new FileReader();
      reader.onload=function(){img.src=reader.result;};
      reader.onerror=function(){clearTimeout(imgLoadTimeout);postMsg('error',{msg:'image blob read failed'});};
      reader.readAsDataURL(blob);
    }).catch(function(){
      img.crossOrigin='anonymous';
      img.src=imageUrl;
    });
  }

  var panelCount=panelLayout==='single'?1:panelLayout==='split-2'?2:3;
  var panelSpeeches=${JSON.stringify(panels.map(p => p.speech))};
  var panelSfx=${JSON.stringify(panels.map(p => p.sfx || 'KWAANG!'))};
  var panelLabels=${JSON.stringify(panels.map(p => p.episodeLabel || ''))};
  var sfxColors=[accentColor,'#FFD600','#FF6B6B'];

  function drawImageInPanel(ctx,img,px,py,pw,ph,filter,panScale){
    ctx.save();
    ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip();
    ctx.filter=filter;
    var imgRatio=img.width/img.height;
    var panelRatio=pw/ph;
    var drawW,drawH;
    if(imgRatio>panelRatio){drawH=ph*panScale;drawW=drawH*imgRatio;}
    else{drawW=pw*panScale;drawH=drawW/imgRatio;}
    ctx.drawImage(img,px+(pw-drawW)/2,py+(ph-drawH)/2,drawW,drawH);
    ctx.restore();
    ctx.filter='none';
  }

  function getPanelRects(){
    var margin=0,gap=20;
    var topY=0;
    var totalH=H*0.62-topY;
    if(panelCount===1){return[{x:margin,y:topY,w:W-margin*2,h:totalH}];}
    var panelH=(totalH-gap*(panelCount-1))/panelCount;
    var rects=[];
    for(var i=0;i<panelCount;i++){rects.push({x:margin,y:topY+i*(panelH+gap),w:W-margin*2,h:panelH});}
    return rects;
  }

  var narrationAudio=null;
  var punchAudioEl=null;
  function startGeneration(){
    var primaryAudioUrl=narrationAudioDataUrl||punchAudioDataUrl;
    var audioConnected=false;
    if(primaryAudioUrl){
      try{
        narrationAudio=new Audio(primaryAudioUrl);
        narrationAudio.play().catch(function(){});
      }catch(e){}
    }

    var hasRecorder=typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function';
    var canvasStream=null,recorder=null,mimeType='',donePromise=null;
    if(hasRecorder){
      canvasStream=canvas.captureStream(FPS);
      var mimeCandidates=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
      for(var mci=0;mci<mimeCandidates.length;mci++){
        if(MediaRecorder.isTypeSupported(mimeCandidates[mci])){mimeType=mimeCandidates[mci];break;}
      }
      if(!mimeType){hasRecorder=false;}
      if(hasRecorder){
      var tracks=canvasStream.getVideoTracks();
      var audioStream=null;

      if(primaryAudioUrl&&narrationAudio){
        try{
          var audioCtx=new (window.AudioContext||window.webkitAudioContext)();
          if(audioCtx.state==='suspended'){audioCtx.resume().catch(function(){});}
          var audioDest=audioCtx.createMediaStreamDestination();
          var sourceNode=audioCtx.createMediaElementSource(narrationAudio);
          sourceNode.connect(audioDest);
          sourceNode.connect(audioCtx.destination);
          audioStream=audioDest.stream;
          audioConnected=true;
        }catch(e){audioConnected=false;}
      }
      if(narrationAudio){try{narrationAudio.play().catch(function(){});}catch(e){}}

      var combinedStream=canvasStream;
      if(audioConnected&&audioStream&&audioStream.getAudioTracks().length>0){
        var allTracks=canvasStream.getVideoTracks().concat(audioStream.getAudioTracks());
        combinedStream=new MediaStream(allTracks);
      }

      recorder=new MediaRecorder(combinedStream,{mimeType:mimeType,videoBitsPerSecond:6000000});
      var chunks=[];
      recorder.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data);};
      donePromise=new Promise(function(resolve){
        recorder.onstop=function(){resolve(new Blob(chunks,{type:mimeType}));};
      });
      recorder.start();
      }
    }
    var startTime=performance.now();
    var lastPct=-1;

    function drawFrame(){
      try{
      var elapsed=performance.now()-startTime;
      var t=Math.min(elapsed/duration,1);
      var pct=Math.round(t*100);
      if(pct!==lastPct){lastPct=pct;postMsg('progress',{progress:pct});}

      var punchShakeX=0,punchShakeY=0;
      var punchZoomScale=1;
      var punchFlashAlpha=0;
      var activeEffect=null;
      for(var mi=0;mi<punchMarkers.length;mi++){
        var mk=punchMarkers[mi];
        var mkElapsed=elapsed-mk.time;
        if(mkElapsed>=0&&mkElapsed<600){
          var mkT=mkElapsed/600;
          var mkIntensity=mk.intensity||1;
          if(mk.effect==='shake'){
            var shakeDecay=Math.max(0,1-mkT);
            punchShakeX=(Math.random()-0.5)*30*shakeDecay*mkIntensity;
            punchShakeY=(Math.random()-0.5)*30*shakeDecay*mkIntensity;
          } else if(mk.effect==='zoom'){
            var zoomT=Math.sin(mkT*Math.PI);
            punchZoomScale=1+zoomT*0.18*mkIntensity;
          } else if(mk.effect==='explosion'){
            var expDecay=Math.max(0,1-mkT*1.5);
            punchFlashAlpha=expDecay*0.5*mkIntensity;
            activeEffect='explosion';
          } else if(mk.effect==='cut'){
            var cutFlash=Math.max(0,1-mkT*3);
            punchFlashAlpha=Math.max(punchFlashAlpha,cutFlash*0.3*mkIntensity);
            activeEffect='cut';
          }
        }
      }

      ctx.save();
      if(punchShakeX||punchShakeY){ctx.translate(punchShakeX,punchShakeY);}
      if(punchZoomScale!==1){
        ctx.translate(W/2,H/2);
        ctx.scale(punchZoomScale,punchZoomScale);
        ctx.translate(-W/2,-H/2);
      }

      ctx.fillStyle=moodConfig.bgColor;ctx.fillRect(-50,-50,W+100,H+100);

      var rects=getPanelRects();

      for(var pi=0;pi<rects.length;pi++){
        var r=rects[pi];
        var panelStart=pi/panelCount;
        var panelEnd=(pi+1)/panelCount;
        if(t<panelStart)continue;

        var pt=Math.min(Math.max((t-panelStart)/(panelEnd-panelStart),0),1);

        var panScale=1+easeOutCubic(pt)*0.12;
        drawImageInPanel(ctx,img,r.x,r.y,r.w,r.h,filterCode,panScale);

        if(moodConfig.halftone){
          drawHalftonePattern(ctx,r.x,r.y,r.w,r.h,3,12,moodConfig.halftoneColor,moodConfig.halftoneAlpha);
        }

        ctx.fillStyle=overlayColor;
        ctx.fillRect(r.x,r.y,r.w,r.h);

        ctx.strokeStyle=moodConfig.panelBorder;
        ctx.lineWidth=moodConfig.panelBorderWidth;
        roundRect(ctx,r.x,r.y,r.w,r.h,0);
        ctx.stroke();

        ctx.strokeStyle=effectiveAccent;
        ctx.lineWidth=3;
        roundRect(ctx,r.x+4,r.y+4,r.w-8,r.h-8,0);
        ctx.stroke();

        if(episodeMode&&panelLabels[pi]){
          drawEpisodeLabel(ctx,panelLabels[pi],r.x+16,r.y+16,accentColor);
        }

        if(emotionOverlay&&panelEmotions[pi]){
          var emoT=Math.max(0,(pt-0.05)/0.15);
          if(emoT>0){
            var emoEmoji=emotionEmojis[panelEmotions[pi]]||'\uD83D\uDE00';
            var emoColor=emotionColors[panelEmotions[pi]]||accentColor;
            var emoMaxScale=panelCount===1?1.2:panelCount===2?0.85:0.65;
            var emoFontSize=panelCount===1?120:panelCount===2?90:70;
            var emoScale=easeOutBack(Math.min(emoT,1))*emoMaxScale;
            var emoBounce=Math.sin(emoT*Math.PI)*8;
            var emoX=r.x+r.w*0.5;
            var emoY=r.y+r.h*0.35-emoBounce;
            ctx.save();
            ctx.globalAlpha=Math.min(emoT*4,1);
            drawEmotionOverlay(ctx,panelEmotions[pi],emoX,emoY,emoEmoji,emoScale,emoColor,emoFontSize);
            ctx.globalAlpha=1;
            ctx.restore();
          }
        }

        var sfxT=Math.max(0,(pt-0.1)/0.2);
        if(sfxT>0){
          var sfxScale=easeOutBack(Math.min(sfxT,1));
          var sfxText=panelSfx[pi%panelSfx.length];
          var sfxColor=moodConfig.sfxColor;
          ctx.save();
          ctx.translate(r.x+r.w*0.82,r.y+r.h*0.22);
          ctx.scale(sfxScale,sfxScale);
          ctx.translate(-r.x-r.w*0.82,-r.y-r.h*0.22);
          var sfxFS=panelCount===1?72:52;
          drawSfxSticker(ctx,sfxText,r.x+r.w*0.82,r.y+r.h*0.22,sfxFS,sfxColor,-15);
          ctx.restore();
        }

        var bubbleT=Math.max(0,(pt-0.2)/0.25);
        if(bubbleT>0){
          var bubbleAlpha=Math.min(bubbleT*4,1);
          var bubbleOffset=(1-easeOutBack(Math.min(bubbleT,1)))*40;
          ctx.globalAlpha=bubbleAlpha;
          var bw=panelCount===1?(W-120):Math.min(r.w-40,520);
          var bh=panelCount===1?160:90;
          var bx=panelCount===1?60:r.x+20;
          var by=r.y+r.h-bh-20+bubbleOffset;
          if(by+bh>H*0.68)by=H*0.66-bh;
          var bubbleFont=panelCount===1?'700 40px sans-serif':'700 26px sans-serif';
          var bubbleText=panelSpeeches[pi]||hook;
          drawSpeechBubble(ctx,bx,by,bw,bh,16,bubbleText,bubbleFont,moodConfig.bubbleBorder,moodConfig.bubbleFill,moodConfig.bubbleText);
          ctx.globalAlpha=1;
        }
      }

      var stickerT=0;

      var titleT=0;

      if(t>0.6&&hashtagStr){
      }

      var ctaT=0;

      if(mbtiCommentary.length>0){
        var mbtiStart=0.55;
        var mbtiCount=Math.min(mbtiCommentary.length,4);
        if(t>mbtiStart){
          for(var mi2=0;mi2<mbtiCount;mi2++){
            var mbtiT2=Math.max(0,(t-mbtiStart-mi2*0.06)/0.15);
            if(mbtiT2>0){
              var mbtiAlpha=Math.min(mbtiT2*4,1);
              var mbtiSlideY=(1-Math.min(mbtiT2,1))*20;
              ctx.save();
              ctx.translate(0,-mbtiSlideY);
              drawMbtiBubble(ctx,mi2,mbtiCount,mbtiAlpha);
              ctx.restore();
            }
          }
        }
      }

      if(punchFlashAlpha>0){
        ctx.globalAlpha=punchFlashAlpha;
        ctx.fillStyle=activeEffect==='explosion'?'#FFD600':'#ffffff';
        ctx.fillRect(-50,-50,W+100,H+100);
        ctx.globalAlpha=1;
      }

      if(activeEffect==='explosion'&&punchFlashAlpha>0.1){
        var burstR=(1-punchFlashAlpha*2)*W*0.4;
        if(burstR>0){
          ctx.save();
          ctx.globalAlpha=punchFlashAlpha*0.8;
          ctx.strokeStyle='#FFD600';
          ctx.lineWidth=8;
          for(var ri=0;ri<12;ri++){
            var angle=(ri/12)*Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(W/2,H/2);
            ctx.lineTo(W/2+Math.cos(angle)*burstR,H/2+Math.sin(angle)*burstR);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      ctx.restore();

      // Baby + link sticker composited into the video frame
      if(shortUrl&&t<0.667){
        __drawRoamingBabyWithLink(ctx,elapsed,W,H,shortUrl,effectiveAccent);
      }

      // Ending credits: store info + disclosure (last ~2 seconds)
      if(t>=0.667){
        var dT2=Math.min((t-0.667)/0.1,1);
        ctx.save();
        ctx.globalAlpha=dT2;ctx.fillStyle='#0a0f1e';ctx.fillRect(0,0,W,H);
        var endY=H/2-20;
        if(localStoreInfo&&localStoreInfo.enabled&&localStoreInfo.storeName){
          ctx.fillStyle=effectiveAccent;ctx.font='700 28px sans-serif';
          ctx.textAlign='center';ctx.textBaseline='middle';
          drawTextLines(ctx,localStoreInfo.storeName,W/2,endY-80,W-80,36);
          ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font='500 20px sans-serif';
          var addrLine=localStoreInfo.address||'';
          if(localStoreInfo.phone)addrLine+='  ·  '+localStoreInfo.phone;
          drawTextLines(ctx,addrLine,W/2,endY-30,W-80,28);
          if(localStoreInfo.todayOffer){
            ctx.fillStyle='rgba(255,214,0,0.95)';ctx.font='700 22px sans-serif';
            drawTextLines(ctx,localStoreInfo.todayOffer,W/2,endY+20,W-80,30);
          }
          endY+=70;
        }
        ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='400 18px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        drawTextLines(ctx,disclosureText,W/2,endY,W-80,26);
        ctx.textAlign='left';ctx.globalAlpha=1;
        ctx.restore();
      }

      if(t<1){setTimeout(drawFrame,16);}
      else{
        clearTimeout(watchdog);
        setTimeout(function(){
          if(narrationAudio){try{narrationAudio.pause();}catch(e){}}
          if(punchAudioEl){try{punchAudioEl.pause();}catch(e){}}
          if(recorder&&recorder.state!=='inactive')recorder.stop();
        },300);
      }
      }catch(e){
        clearTimeout(watchdog);
        if(recorder&&recorder.state!=='inactive')recorder.stop();
        postMsg('error',{msg:'frame render failed: '+(e&&e.message||'unknown')});
      }
    }
    setTimeout(drawFrame,0);

    var watchdog=setTimeout(function(){
      if(lastPct<0||lastPct===0){
        postMsg('error',{msg:'generation watchdog: no progress within '+(Math.round(duration/1000)+15)+'s'});
      }
    },duration+15000);

    if(donePromise){
      donePromise.then(function(blob){
        clearTimeout(watchdog);
        var reader=new FileReader();
        reader.onloadend=function(){
          var base64=reader.result.split(',')[1];
          postMsg('done',{base64:base64,size:blob.size,mimeType:mimeType});
        };
        reader.readAsDataURL(blob);
      });
    } else {
      setTimeout(function(){
        clearTimeout(watchdog);
        try{
          var dataUrl=canvas.toDataURL('image/png');
          var base64=dataUrl.split(',')[1];
          postMsg('done',{base64:base64,size:0,mimeType:'image/png',isImage:true});
        }catch(e){
          postMsg('error',{msg:'canvas toDataURL failed: '+(e&&e.message||'unknown')});
        }
      },duration+500);
    }
  }
})();
`;
}

export function buildComicHTML(params: ComicBuildParams): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
</head><body>
<canvas id="cv"></canvas>
<script>
${buildComicScriptBody(params)}
</script>
</body></html>`;
}

export function ComicShortGenerator({
  imageUrl,
  hook,
  title,
  hashtags,
  accentColor,
  fileName,
  affiliatePlatforms = [],
  platform = 'shortform',
  shortUrl = '',
  stickerPosition = 'top-left',
  stickerStyle = 'pill',
  stickerSize = 48,
  productName = '',
  productCategory = '',
  priceEstimate = '',
  oneLiner = '',
  productAdvantages = [],
  localStoreInfo = null,
  brandPersona = null,
  preloadedVariant = null,
}: ComicShortGeneratorProps) {
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [fittingModalOpen, setFittingModalOpen] = useState(false);
  const [fittingResultUrl, setFittingResultUrl] = useState<string | null>(null);
  const [moodTemplate, setMoodTemplate] = useState<MoodTemplate>('energetic-popart');
  const [panelLayout, setPanelLayout] = useState<PanelLayout>('single');
  const [comicDuration, setComicDuration] = useState<ComicDuration>(15000);
  useEffect(() => {
    let mounted = true;
    getUserSettings().then((s) => {
      if (mounted && s?.default_video_duration) setComicDuration(Number(s.default_video_duration) as ComicDuration);
      if (mounted && s) setAutoDisclosure(s.auto_disclosure ?? true);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState<string>('video/webm');
  const [resultSize, setResultSize] = useState<number>(0);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [scenarioPanels, setScenarioPanels] = useState<ComicPanel[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioFallback, setScenarioFallback] = useState(false);
  const [episodeMode, setEpisodeMode] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [narrationAudioDataUrl, setNarrationAudioDataUrl] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState<string | null>(null);
  const [ttsSpeed, setTtsSpeed] = useState<number | null>(null);
  const [ttsPitch, setTtsPitch] = useState<number | null>(null);
  const [mbtiMode, setMbtiMode] = useState(true);
  const [emotionOverlay, setEmotionOverlay] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoDisclosure, setAutoDisclosure] = useState(true);
  const [selectedArtStyle, setSelectedArtStyle] = useState<ArtStyle | null>(null);
  const [voiceCategory, setVoiceCategory] = useState<VoiceCategory>('bright');
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<string | null>(null);
  const [multilingualDubLang, setMultilingualDubLang] = useState<string | null>(null);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [editingPanels, setEditingPanels] = useState(false);
  const [editablePanels, setEditablePanels] = useState<ComicPanel[]>([]);
  const tpl = useHybridTemplate(
    { category: productCategory, platform: 'shorts', productName, fallbackHook: hook, fallbackHashtags: hashtags, fallbackAccentColor: theme.colors.accent[400], fallbackCardStyle: 'bold' },
    theme.colors.accent[400],
    'bold',
    'upbeat',
  );
  const [mbtiCommentary, setMbtiCommentary] = useState<MbtiCommentary[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [soundPunchEnabled, setSoundPunchEnabled] = useState(false);
  const [punchMarkers, setPunchMarkers] = useState<PunchMarker[]>([]);
  const [punchAudioDataUrl, setPunchAudioDataUrl] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webGenCleanupRef = useRef<(() => void) | null>(null);
  const [safeImageUrl, setSafeImageUrl] = useState(imageUrl);
  const [webviewKey, setWebviewKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const converted = await urlToDataUrl(imageUrl);
        if (!cancelled) setSafeImageUrl(converted);
      } catch {
        // keep original URL as fallback
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    if (productName && productCategory) {
      let cancelled = false;
      setTrendingLoading(true);
      (async () => {
        try {
          const result = await fetchMatchedTrendingHashtags(
            productCategory,
            hashtags,
            productName,
          );
          if (!cancelled && result.hashtags.length > 0) {
            setTrendingKeywords(result.hashtags.slice(0, 5));
          }
        } catch {
          // trending fetch failed, continue without
        }
        if (!cancelled) setTrendingLoading(false);
      })();
      return () => { cancelled = true; };
    }
  }, [productName, productCategory, hashtags]);

  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
      if (webGenCleanupRef.current) {
        webGenCleanupRef.current();
        webGenCleanupRef.current = null;
      }
      if (resultUri && Platform.OS === 'web' && resultUri.startsWith('blob:')) {
        URL.revokeObjectURL(resultUri);
      }
      if (resultUri && Platform.OS !== 'web') {
        FileSystem.deleteAsync(resultUri, { idempotent: true }).catch(() => {});
      }
    };
  }, [resultUri]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'progress') {
        if (stateRef.current !== 'generating') return;
        setProgress(msg.data.progress);
      } else if (msg.type === 'done') {
        if (stateRef.current !== 'generating') return;
        const { base64, size, mimeType } = msg.data;
        const isImage = msg.data.isImage === true;
        const mime = mimeType || 'video/webm';
        const ext = isImage ? 'png' : (mime.includes('webm') ? 'webm' : 'mp4');
        setResultMime(mime);
        setResultSize(size || 0);
        try {
          if (Platform.OS === 'web') {
            const byteChars = atob(base64);
            const byteArr = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
            const blob = new Blob([byteArr], { type: mime });
            const blobUrl = URL.createObjectURL(blob);
            setResultUri(blobUrl);
            setResultBlob(blob);
          } else {
            const fileUri = `${FileSystem.cacheDirectory}${fileName.replace(/\.png$|\.webm$/, '')}-comic-${Date.now()}.${ext}`;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            setResultUri(fileUri);
          }
          if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
          setState('done');
          setProgress(100);
          const hasAudio = !!narrationAudioDataUrl;
          showToast(isImage ? '만화 숏폼 이미지가 완성됐어요!' : hasAudio ? 'AI 내레이션 만화 숏폼 완성!' : '만화 숏폼 동영상이 완성됐어요!');
        } catch {
          setState('error');
          showToast('파일 저장에 실패했어요');
        }
      } else if (msg.type === 'error') {
        if (stateRef.current !== 'generating') return;
        if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
        setState('error');
        const errMsg = msg.data?.msg || '';
        if (errMsg.includes('timeout')) {
          showToast('이미지 로드 시간이 초과됐어요. 다시 시도해주세요');
        } else if (errMsg.includes('image load')) {
          showToast('이미지를 불러올 수 없어요. 다시 시도해주세요');
        } else {
          showToast('만화 숏폼 생성에 실패했어요. 다시 시도해주세요');
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [fileName, showToast, narrationAudioDataUrl]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      handleWebViewMessage({ nativeEvent: { data: event.data } } as WebViewMessageEvent);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleWebViewMessage]);

  const runWebComicGeneration = useCallback((scriptBody: string) => {
    if (webGenCleanupRef.current) {
      webGenCleanupRef.current();
      webGenCleanupRef.current = null;
    }
    const prevCallback = (window as any).__comicPostMsg;

    const canvas = document.createElement('canvas');
    canvas.id = 'cv';
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;';
    document.body.appendChild(canvas);

    (window as any).__comicPostMsg = (rawMsg: string) => {
      handleWebViewMessage({ nativeEvent: { data: rawMsg } } as WebViewMessageEvent);
    };

    const scriptEl = document.createElement('script');
    scriptEl.textContent = scriptBody;
    document.body.appendChild(scriptEl);

    webGenCleanupRef.current = () => {
      (window as any).__comicPostMsg = prevCallback;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
    };
  }, [handleWebViewMessage]);

  const handleGenerate = useCallback(async () => {
    if (state === 'generating') return;
    setState('generating');
    setProgress(0);
    setResultUri(null);
    setResultBlob(null);
    if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);

    const autoConfig = autoDecideConfig(productCategory, productAdvantages, selectedArtStyle || undefined);
    let panelCount = autoConfig.panelCount;
    let panels: ComicPanel[] = [];
    let narrationText = '';
    let finalMood = autoConfig.mood;
    let finalArtStyle = autoConfig.artStyle || selectedArtStyle || null;
    let finalPanelLayout: PanelLayout = autoConfig.panelCount === 1 ? 'single' : autoConfig.panelCount === 2 ? 'split-2' : 'split-3';
    let finalDuration: ComicDuration = autoConfig.duration;
    let finalMbtiCommentary: MbtiCommentary[] = [];
    let finalScenarioFallback = false;

    if (preloadedVariant && preloadedVariant.panels.length > 0) {
      panels = preloadedVariant.panels.map((p) => ({
        speech: p.speech,
        sfx: p.sfx,
        emotion: p.emotion,
      }));
      narrationText = preloadedVariant.narrationText || preloadedVariant.hook || panels.map((p) => p.speech).join('. ');
      panelCount = Math.min(panels.length, 3);
      finalPanelLayout = panelCount === 1 ? 'single' : panelCount === 2 ? 'split-2' : 'split-3';
      finalScenarioFallback = false;
    } else if (productName) {
      setScenarioLoading(true);
      try {
        const response = await safeFetch(COMIC_SCENARIO_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            productName,
            productCategory,
            priceEstimate,
            oneLiner,
            productAdvantages,
            hook,
            trendingKeywords: trendingKeywords.length > 0 ? trendingKeywords : undefined,
            trendingHashtags: hashtags.slice(0, 5),
            episodeMode,
            mbtiMode,
            brandPersona: brandPersona || undefined,
            artStyle: selectedArtStyle || undefined,
          }),
          timeoutMs: 20000,
        });
        if (response.ok) {
          const data = await response.json();
          if (data.panels && Array.isArray(data.panels) && data.panels.length > 0) {
            panels = data.panels;
            finalScenarioFallback = !!data.isFallback;
          }
          if (data.narrationText) {
            narrationText = data.narrationText;
          }
          if (data.mbtiCommentary && Array.isArray(data.mbtiCommentary)) {
            finalMbtiCommentary = data.mbtiCommentary;
          }
          if (data.autoConfig) {
            const ac = data.autoConfig as AutoConfig;
            finalMood = ac.mood;
            finalArtStyle = ac.artStyle || finalArtStyle;
            finalPanelLayout = ac.panelCount === 1 ? 'single' : ac.panelCount === 2 ? 'split-2' : 'split-3';
            finalDuration = ac.duration;
            panelCount = ac.panelCount;
          }
        }
      } catch {
        // fallback below
      }
      setScenarioLoading(false);
    }

    if (panels.length === 0) {
      const speeches = fallbackSplitHook(hook, title, panelCount);
      const labels = episodeMode ? ['1일차', '3일차', '7일차'] : [];
      panels = speeches.map((speech, i) => ({
        speech,
        sfx: autoMatchSfx(['', '놀람', '확신'][i] || '', ['KWAANG!', 'BOOM!', 'ZAP!'][i % 3]),
        emotion: '',
        episodeLabel: labels[i] || undefined,
      }));
      finalScenarioFallback = true;
    }

    for (const panel of panels) {
      if (panel.sfx && (panel.sfx === 'KWAANG!' || panel.sfx === 'BOOM!' || panel.sfx === 'ZAP!')) {
        panel.sfx = autoMatchSfx(panel.emotion, panel.sfx);
      }
    }

    if (!narrationText) {
      narrationText = panels.map((p) => p.speech).join('. ');
    }

    let finalNarrationAudioDataUrl: string | null = null;
    if (ttsEnabled && narrationText) {
      setTtsLoading(true);
      try {
        let resolvedVoiceKey = ttsVoice;
        let resolvedSpeed: number | null = ttsSpeed;
        let resolvedPitch: number | null = ttsPitch;
        if (!resolvedVoiceKey) {
          try {
            const userSettings = await getUserSettings();
            resolvedVoiceKey = userSettings?.default_tts_voice || null;
            resolvedSpeed = userSettings?.tts_speed ?? null;
            resolvedPitch = userSettings?.tts_pitch ?? null;
            setTtsVoice(resolvedVoiceKey);
            setTtsSpeed(resolvedSpeed);
            setTtsPitch(resolvedPitch);
          } catch {
            // use default
          }
        }
        let dubVoice: string;
        let dubInstructions: string | undefined;
        let dubSpeed: number;
        if (multilingualDubLang) {
          const mv = getMultilingualVoice(multilingualDubLang);
          dubVoice = mv?.openaiVoice || 'alloy';
          dubInstructions = mv?.instructions;
          dubSpeed = 1.0;
        } else {
          const voiceParams = getOpenAiVoiceParams(resolvedVoiceKey || '', resolvedSpeed);
          dubVoice = voiceParams.voice;
          dubInstructions = voiceParams.instructions;
          dubSpeed = voiceParams.speed;
        }
        const ttsResponse = await safeFetch(TTS_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            text: narrationText,
            voice: dubVoice,
            speed: dubSpeed,
            pitch: resolvedPitch ?? 0,
            instructions: dubInstructions,
          }),
          timeoutMs: 15000,
        });
        if (ttsResponse.ok) {
          const ttsData = await ttsResponse.json();
          if (ttsData.audioBase64) {
            finalNarrationAudioDataUrl = `data:audio/mpeg;base64,${ttsData.audioBase64}`;
          }
        }
      } catch {
        showToast('AI 내레이션 생성에 실패했어요. 영상만으로 완성됩니다.');
      }
      setTtsLoading(false);
    }

    let finalImageUrl = imageUrl;
    try {
      const converted = await urlToDataUrl(imageUrl);
      finalImageUrl = converted;
    } catch {
      // keep original URL; WebView fetch will retry
    }
    setSafeImageUrl(finalImageUrl);
    setMoodTemplate(finalMood);
    if (finalArtStyle) {
      const artConfig = ART_STYLES[finalArtStyle];
      if (artConfig) {
        setVoiceCategory(artConfig.voiceCategory);
      }
    }
    setPanelLayout(finalPanelLayout);
    setComicDuration(finalDuration);
    setMbtiCommentary(finalMbtiCommentary);
    setScenarioFallback(finalScenarioFallback);
    setNarrationAudioDataUrl(finalNarrationAudioDataUrl);
    setScenarioPanels(panels);

    if (Platform.OS === 'web') {
      const scriptBody = buildComicScriptBody({
        imageUrl: finalImageUrl,
        hook,
        title,
        hashtags,
        accentColor,
        shortUrl,
        moodTemplate: finalMood,
        panelLayout: finalPanelLayout,
        disclosureText: getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure),
        stickerPosition,
        stickerStyle,
        stickerSize,
        panels,
        duration: finalDuration,
        episodeMode,
        narrationAudioDataUrl: finalNarrationAudioDataUrl,
        punchMarkers: punchAudioDataUrl ? punchMarkers : [],
        punchAudioDataUrl,
        mbtiCommentary: mbtiMode ? finalMbtiCommentary : [],
        emotionOverlay,
        localStoreInfo,
      });
      runWebComicGeneration(scriptBody);
    } else {
      setWebviewKey((k) => k + 1);
    }

    generateTimeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev === 'generating') {
          showToast('생성 시간이 초과됐어요. 다시 시도해주세요');
          return 'error';
        }
        return prev;
      });
    }, finalDuration + 60000);
  }, [state, productName, productCategory, priceEstimate, oneLiner, productAdvantages, hook, title, imageUrl, showToast, trendingKeywords, hashtags, episodeMode, ttsEnabled, ttsVoice, ttsSpeed, ttsPitch, mbtiMode, affiliatePlatforms, stickerPosition, stickerStyle, stickerSize, emotionOverlay, localStoreInfo, brandPersona, runWebComicGeneration, punchMarkers, punchAudioDataUrl, accentColor, shortUrl, autoDisclosure, selectedArtStyle, voiceCategory, selectedVoiceKey, multilingualDubLang, preloadedVariant]);



  const handleDirectShare = useCallback(async () => {
    if (!resultUri) return;
    setSharing(true);
    try {
      if (Platform.OS === 'web' && resultBlob && navigator.share) {
        const isImage = resultMime.includes('png');
        const ext = isImage ? 'png' : 'webm';
        const shareFileName = fileName.replace(/\.png$|\.webm$/, '') + '-comic.' + ext;
        const file = new File([resultBlob], shareFileName, { type: resultMime });
        const shareData: ShareData = {
          files: [file],
          title: title || '만화 숏폼',
          text: hook,
        };
        if (shortUrl) shareData.text = (hook || '') + '\n' + shortUrl;
        await navigator.share(shareData);
      } else if (Platform.OS !== 'web' && resultUri) {
        const Sharing = (await import('expo-sharing')).default;
        await Sharing.shareAsync(resultUri, {
          mimeType: resultMime,
          dialogTitle: '만화 숏폼 공유',
        });
      } else {
        showToast('이 브라우저에서는 공유 시트를 지원하지 않아요. 저장 후 직접 업로드해주세요');
      }
    } catch (e) {
      const err = e as { name?: string };
      if (err?.name !== 'AbortError') {
        showToast('공유 중 오류가 발생했어요');
      }
    }
    setSharing(false);
  }, [resultUri, resultBlob, resultMime, fileName, title, hook, shortUrl, showToast]);

  const handlePlatformShare = useCallback(async (platform: 'tiktok' | 'instagram' | 'youtube') => {
    if (!resultUri) return;
    setSharing(true);

    const disclosureText = getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure);
    const linkLine = shortUrl ? `\n${shortUrl}` : '';
    const fullText = `${hook}${linkLine}\n${disclosureText}`;

    const platformUrls: Record<string, string> = {
      tiktok: 'https://www.tiktok.com/upload',
      instagram: 'https://www.instagram.com',
      youtube: 'https://www.youtube.com/upload',
    };

    if (Platform.OS === 'web') {
      try {
        if (navigator.share && resultBlob) {
          const isImage = resultMime.includes('png');
          const ext = isImage ? 'png' : 'webm';
          const shareFileName = fileName.replace(/\.png$|\.webm$/, '') + '-comic.' + ext;
          const file = new File([resultBlob], shareFileName, { type: resultMime });
          await navigator.share({
            files: [file],
            title: title || '만화 숏폼',
            text: fullText,
          });
          showToast('공유 시트가 열렸어요! 선택한 SNS에서 바로 업로드하세요');
        } else {
          if (navigator.clipboard) await navigator.clipboard.writeText(fullText);
          window.open(platformUrls[platform], '_blank');
          showToast('홍보 문구가 복사됐어요! 열린 페이지에서 업로드하세요');
        }
      } catch (e) {
        const err = e as { name?: string };
        if (err?.name !== 'AbortError') {
          if (navigator.clipboard) await navigator.clipboard.writeText(fullText);
          window.open(platformUrls[platform], '_blank');
          showToast('홍보 문구를 복사하고 페이지를 열었어요');
        }
      }
    } else {
      try {
        const Sharing = (await import('expo-sharing')).default;
        await Sharing.shareAsync(resultUri, {
          mimeType: resultMime,
          dialogTitle: 'SNS 공유',
        });
      } catch {
        const { Linking } = await import('react-native');
        Linking.openURL(platformUrls[platform]).catch(() => {});
      }
    }
    setSharing(false);
  }, [resultUri, resultBlob, resultMime, fileName, title, hook, shortUrl, affiliatePlatforms, showToast, autoDisclosure]);

  const handleSaveToGallery = useCallback(async () => {
    if (!resultUri) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = resultUri;
      a.download = fileName.replace(/\.png$|\.webm$/, '') + '-comic.' + (resultMime.includes('png') ? 'png' : 'webm');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('다운로드를 시작했어요');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('사진 접근 권한이 필요해요. 설정에서 허용해주세요');
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(resultUri);
      try {
        await MediaLibrary.createAlbumAsync('숏커넥트만화', asset, false);
      } catch {
        // Album creation can fail on scoped storage; the asset is already saved to gallery.
      }
      showToast('갤러리에 저장됐어요');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg ? `저장 실패: ${msg}` : '갤러리 저장 중 오류가 발생했어요');
    }
  }, [resultUri, showToast]);

  const handleSaveToCloud = useCallback(async () => {
    if (!resultUri) return;
    setCloudSaving(true);
    try {
      const cloudExt = resultMime.includes('png') ? 'png' : 'webm';
      const cloudFileName = fileName.replace(/\.png$|\.webm$/, '') + '-comic-' + Date.now() + '.' + cloudExt;
      let fileUrl: string | null = null;
      if (Platform.OS === 'web' && resultBlob) {
        fileUrl = await uploadAssetBlob(resultBlob, cloudFileName, resultMime);
      } else {
        fileUrl = await uploadAssetFromFileUri(resultUri, cloudFileName, resultMime);
      }
      if (!fileUrl) {
        showToast('클라우드 업로드에 실패했어요');
        setCloudSaving(false);
        return;
      }
      await saveAssetRecord({
        scan_id: null,
        asset_type: resultMime.includes('png') ? 'image' : 'video',
        title: title + ' (만화 숏폼)',
        file_url: fileUrl,
        file_name: cloudFileName,
        file_size: resultSize || null,
        mime_type: resultMime,
        thumbnail_url: imageUrl,
        platform: platform,
        affiliate_platform: affiliatePlatforms.join(',') || null,
      });
      showToast('클라우드에 저장됐어요. 내 제작물 탭에서 확인하세요');
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setCloudSaving(false);
  }, [resultUri, resultBlob, fileName, title, imageUrl, platform, affiliatePlatforms, resultMime, resultSize, showToast]);

  const handlePreviewVoice = useCallback(async (voiceKey: string) => {
    try {
      if (previewingVoiceKey === voiceKey) {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause();
          previewAudioRef.current = null;
        }
        setPreviewingVoiceKey(null);
        return;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingVoiceKey(voiceKey);
      const voiceParams = getOpenAiVoiceParams(voiceKey, null);
      const sampleText = '안녕하세요! 이 상품 정말 추천드려요. 지금 바로 확인해보세요!';
      const response = await safeFetch(TTS_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          text: sampleText,
          voice: voiceParams.voice,
          speed: voiceParams.speed,
          pitch: 0,
          instructions: voiceParams.instructions,
        }),
        timeoutMs: 10000,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
          audio.onended = () => setPreviewingVoiceKey(null);
          audio.onerror = () => setPreviewingVoiceKey(null);
          previewAudioRef.current = audio;
          audio.play().catch(() => setPreviewingVoiceKey(null));
        } else {
          setPreviewingVoiceKey(null);
        }
      } else {
        setPreviewingVoiceKey(null);
      }
    } catch {
      setPreviewingVoiceKey(null);
    }
  }, [previewingVoiceKey]);

  const handleStartEditPanels = useCallback(() => {
    if (scenarioPanels.length === 0) return;
    setEditablePanels(scenarioPanels.map(p => ({ ...p })));
    setEditingPanels(true);
  }, [scenarioPanels]);

  const handleSaveEditedPanels = useCallback(() => {
    setScenarioPanels(editablePanels.map(p => ({ ...p })));
    setEditingPanels(false);
  }, [editablePanels]);

  const handleCancelEditPanels = useCallback(() => {
    setEditingPanels(false);
  }, []);

  const handleEditPanelField = useCallback((index: number, field: 'speech' | 'sfx' | 'emotion', value: string) => {
    setEditablePanels(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }, []);

  const handleRegenerateWithEdits = useCallback(() => {
    setScenarioPanels(editablePanels.map(p => ({ ...p })));
    setEditingPanels(false);
    setState('idle');
    setProgress(0);
    setResultUri(null);
    setResultBlob(null);
    setTimeout(() => handleGenerate(), 100);
  }, [editablePanels, handleGenerate]);

  const handleReset = useCallback(() => {
    if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    if (webGenCleanupRef.current) {
      webGenCleanupRef.current();
      webGenCleanupRef.current = null;
    }
    if (resultUri && Platform.OS === 'web') URL.revokeObjectURL(resultUri);
    if (resultUri && Platform.OS !== 'web') {
      FileSystem.deleteAsync(resultUri, { idempotent: true }).catch(() => {});
    }
    setResultUri(null);
    setResultBlob(null);
    setState('idle');
    setProgress(0);
    setNarrationAudioDataUrl(null);
    setScenarioPanels([]);
    setFittingResultUrl(null);
    setFittingModalOpen(false);
  }, [resultUri]);

  const html = useMemo(() => buildComicHTML({
    imageUrl: safeImageUrl,
    hook,
    title,
    hashtags,
    accentColor,
    shortUrl,
    moodTemplate,
    panelLayout,
    disclosureText: getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure),
    stickerPosition,
    stickerStyle,
    stickerSize,
    panels: scenarioPanels.length > 0 ? scenarioPanels : fallbackSplitHook(hook, title, panelLayout === 'single' ? 1 : panelLayout === 'split-2' ? 2 : 3).map((speech, i) => ({
      speech,
      sfx: ['KWAANG!', 'BOOM!', 'ZAP!'][i % 3],
      emotion: '',
    })),
    duration: comicDuration,
    episodeMode,
    narrationAudioDataUrl,
    punchMarkers: punchAudioDataUrl ? punchMarkers : [],
    punchAudioDataUrl,
    mbtiCommentary: mbtiMode ? mbtiCommentary : [],
    emotionOverlay,
    localStoreInfo,
  }), [safeImageUrl, hook, title, hashtags, accentColor, shortUrl, moodTemplate, panelLayout, affiliatePlatforms, stickerPosition, stickerStyle, stickerSize, scenarioPanels, comicDuration, episodeMode, narrationAudioDataUrl, punchMarkers, punchAudioDataUrl, mbtiMode, mbtiCommentary, emotionOverlay, localStoreInfo, autoDisclosure]);

  const webViewSource = useMemo(() => ({ html }), [html]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BookOpen size={18} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>만화 숏폼 자동 생성</Text>
        </View>
        {state === 'done' && (
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        {Platform.OS === 'ios'
          ? '사진 한 장으로 9:16 만화 이미지를 원터치로 만들어요. AI가 상품에 맞춰 스타일과 스토리를 자동으로 구성해서 대사 풍선과 효과음 스티커에 담아냅니다. iOS에서는 정지 이미지로 저장돼요.'
          : '사진 한 장으로 9:16 만화 숏폼을 원터치로 만들어요. AI가 상품에 맞춰 스타일과 스토리를 자동으로 구성해서 대사 풍선과 효과음 스티커에 담아냅니다.'}
      </Text>

      {trendingKeywords.length > 0 && state === 'idle' && (
        <View style={styles.trendingBox}>
          <View style={styles.trendingHeader}>
            <Sparkles size={11} color={theme.colors.success[400]} strokeWidth={2} />
            <Text style={styles.trendingLabel}>실시간 트렌드 키워드</Text>
            {trendingLoading && <ActivityIndicator size={10} color={theme.colors.dark.textDim} />}
          </View>
          <View style={styles.trendingTags}>
            {trendingKeywords.map((kw, i) => (
              <View key={i} style={styles.trendingTag}>
                <Text style={styles.trendingTagText}>#{kw}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.trendingHint}>이 키워드가 만화 대사에 자동으로 반영됩니다</Text>
        </View>
      )}

      {scenarioFallback && scenarioPanels.length > 0 && state !== 'idle' && (
        <View style={styles.scenarioBadge}>
          <Sparkles size={11} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.scenarioBadgeText}>스마트 템플릿 시나리오</Text>
        </View>
      )}
      {!scenarioFallback && scenarioPanels.length > 0 && state !== 'idle' && (
        <View style={styles.scenarioBadgeAi}>
          <Sparkles size={11} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.scenarioBadgeTextAi}>AI 스토리 시나리오 적용됨</Text>
        </View>
      )}

      {state === 'idle' && (
        <View>
          <TemplateBadge label={tpl.badgeLabel} />
          <View style={styles.autoInfoBox}>
            <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.autoInfoText}>
              AI가 상품 카테고리에 맞춰 스타일·영상 길이·컷 수를 자동으로 선택해요
            </Text>
          </View>

          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
            activeOpacity={0.7}
          >
            <Text style={styles.advancedToggleText}>고급 옵션</Text>
            <ChevronDown
              size={16}
              color={theme.colors.dark.textDim}
              strokeWidth={2}
              style={{ transform: [{ rotate: showAdvanced ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View>
              <View style={styles.durationInfoBox}>
                <Clock size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.durationInfoText}>
                  영상 길이: {comicDuration / 1000}초 (설정에서 변경)
                </Text>
              </View>

              <Text style={styles.optionLabel}>웹툰 화풍 선택</Text>
              <View style={styles.artStyleScroll}>
                {ART_STYLE_KEYS.map((key) => {
                  const sty = ART_STYLES[key];
                  const isActive = selectedArtStyle === key || (!selectedArtStyle && autoDecideConfig(productCategory, productAdvantages).artStyle === key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.artStylePill, isActive && styles.artStylePillActive]}
                      onPress={() => setSelectedArtStyle(isActive && selectedArtStyle ? null : key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.artStylePillText, isActive && styles.artStylePillTextActive]}>
                        {sty.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(() => {
                const activeStyle = selectedArtStyle
                  ? ART_STYLES[selectedArtStyle]
                  : ART_STYLES[autoDecideConfig(productCategory, productAdvantages).artStyle || 'insta-toon'];
                if (!activeStyle) return null;
                return (
                  <View style={styles.styleDescBox}>
                    <Text style={styles.styleDescText}>{activeStyle.desc}</Text>
                    <Text style={styles.styleDescHint}>추천: {activeStyle.recommendedFor}</Text>
                  </View>
                );
              })()}

              <Text style={styles.optionLabel}>무드 템플릿</Text>
              <View style={styles.moodScroll}>
                {MOOD_KEYS.map((key) => {
                  const tm = MOOD_TEMPLATES[key];
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.moodPill, moodTemplate === key && styles.moodPillActive]}
                      onPress={() => setMoodTemplate(key)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.moodSwatch, { backgroundColor: tm.config.accentOverride }]} />
                      <Text style={[styles.moodPillText, moodTemplate === key && styles.moodPillTextActive]}>
                        {tm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(() => {
                const selected = MOOD_TEMPLATES[moodTemplate];
                if (!selected) return null;
                return (
                  <View style={styles.styleDescBox}>
                    <Text style={styles.styleDescText}>{selected.desc}</Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setEpisodeMode(!episodeMode)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleCheck, episodeMode && styles.toggleCheckActive]}>
                  {episodeMode && <Text style={styles.toggleCheckText}>V</Text>}
                </View>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleTitle}>연작 에피소드 모드</Text>
                  <Text style={styles.toggleDesc}>"1일차 - 3일차 - 7일차" 시간 흐름 스토리로 만들어요</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setTtsEnabled(!ttsEnabled)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleCheck, ttsEnabled && styles.toggleCheckActive]}>
                  {ttsEnabled && <Text style={styles.toggleCheckText}>V</Text>}
                </View>
                <View style={styles.toggleTextWrap}>
                  <View style={styles.toggleTitleRow}>
                    <Mic size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.toggleTitle}>AI 음성 내레이션 더빙</Text>
                  </View>
                  <Text style={styles.toggleDesc}>만화 스토리를 AI 성우 목소리로 자동 더빙해요 (웹에서만 오디오 포함)</Text>
                </View>
              </TouchableOpacity>

              {ttsEnabled && (
                <View style={styles.voiceSelectorWrap}>
                  <Text style={styles.optionLabel}>AI 성우 목소리 선택</Text>
                  <View style={styles.voiceCatScroll}>
                    {(Object.keys(VOICE_CATEGORIES) as VoiceCategory[]).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.voiceCatPill, voiceCategory === cat && styles.voiceCatPillActive]}
                        onPress={() => {
                          setVoiceCategory(cat);
                          const voices = getVoicesByCategory(cat);
                          if (voices.length > 0) setSelectedVoiceKey(voices[0].key);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.voiceCatPillText, voiceCategory === cat && styles.voiceCatPillTextActive]}>
                          {VOICE_CATEGORIES[cat].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.voiceCatDesc}>{VOICE_CATEGORIES[voiceCategory].desc}</Text>
                  <View style={styles.voiceListScroll}>
                    {getVoicesByCategory(voiceCategory).map((v: TtsVoice) => (
                      <View key={v.key} style={styles.voiceItemRow}>
                        <TouchableOpacity
                          style={[styles.voiceItem, (selectedVoiceKey || getVoicesByCategory(voiceCategory)[0]?.key) === v.key && styles.voiceItemActive]}
                          onPress={() => setSelectedVoiceKey(v.key)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.voiceItemLeft}>
                            <Text style={styles.voiceItemLabel}>{v.label}</Text>
                            <Text style={styles.voiceItemDesc}>{v.desc}</Text>
                          </View>
                          {(selectedVoiceKey || getVoicesByCategory(voiceCategory)[0]?.key) === v.key && (
                            <Check size={16} color={theme.colors.accent[400]} strokeWidth={2.5} />
                          )}
                        </TouchableOpacity>
                        {Platform.OS === 'web' && (
                          <TouchableOpacity
                            style={styles.voicePreviewBtn}
                            onPress={() => handlePreviewVoice(v.key)}
                            activeOpacity={0.7}
                          >
                            {previewingVoiceKey === v.key ? (
                              <Pause size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
                            ) : (
                              <Play size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {ttsEnabled && (
                <View style={styles.multilingualDubWrap}>
                  <View style={styles.multilingualDubHeader}>
                    <Globe size={12} color={theme.colors.primary[400]} strokeWidth={2} />
                    <Text style={styles.multilingualDubTitle}>다국어 더빙 (글로벌 TTS)</Text>
                  </View>
                  <Text style={styles.multilingualDubDesc}>해당 국가 억양의 AI 성우로 내레이션을 더빙합니다. 미선택 시 한국어 성우가 적용됩니다.</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.multilingualDubScroll}>
                    <TouchableOpacity
                      style={[styles.multilingualDubPill, !multilingualDubLang && styles.multilingualDubPillActive]}
                      onPress={() => setMultilingualDubLang(null)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.multilingualDubPillText, !multilingualDubLang && styles.multilingualDubPillTextActive]}>한국어 (기본)</Text>
                    </TouchableOpacity>
                    {MULTILINGUAL_VOICES.map((mv: MultilingualVoice) => (
                      <TouchableOpacity
                        key={mv.code}
                        style={[styles.multilingualDubPill, multilingualDubLang === mv.code && styles.multilingualDubPillActive]}
                        onPress={() => setMultilingualDubLang(mv.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.multilingualDubPillText, multilingualDubLang === mv.code && styles.multilingualDubPillTextActive]}>{mv.nativeName}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setEmotionOverlay(!emotionOverlay)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleCheck, emotionOverlay && styles.toggleCheckActive]}>
                  {emotionOverlay && <Text style={styles.toggleCheckText}>V</Text>}
                </View>
                <View style={styles.toggleTextWrap}>
                  <View style={styles.toggleTitleRow}>
                    <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.toggleTitle}>감정 표정 오버레이</Text>
                  </View>
                  <Text style={styles.toggleDesc}>각 컷의 감정(고민/놀람/행복/확신)에 맞춰 이모지가 통통 튀며 나타나요</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setMbtiMode(!mbtiMode)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleCheck, mbtiMode && styles.toggleCheckActive]}>
                  {mbtiMode && <Text style={styles.toggleCheckText}>V</Text>}
                </View>
                <View style={styles.toggleTextWrap}>
                  <View style={styles.toggleTitleRow}>
                    <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.toggleTitle}>MBTI 맞춤형 상품 해설</Text>
                  </View>
                  <Text style={styles.toggleDesc}>"INTJ는 효율템, ENFP는 인싸템!" AI가 유형별 구매 가이드를 만화에 띄워요</Text>
                </View>
              </TouchableOpacity>

              {Platform.OS === 'web' && (
                <SoundPunchEditor
                  enabled={soundPunchEnabled}
                  onToggle={setSoundPunchEnabled}
                  onMarkersChange={setPunchMarkers}
                  onAudioReady={setPunchAudioDataUrl}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          )}

          <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} activeOpacity={0.8} disabled={scenarioLoading || ttsLoading}>
            {scenarioLoading || ttsLoading ? (
              <ActivityIndicator size={20} color="#fff" />
            ) : ttsEnabled ? (
              <Volume2 size={20} color="#fff" strokeWidth={2} />
            ) : (
              <Zap size={20} color="#fff" strokeWidth={2} />
            )}
            <Text style={styles.generateButtonText}>
              {scenarioLoading ? 'AI 시나리오 생성 중...' : ttsLoading ? 'AI 내레이션 생성 중...' : Platform.OS === 'ios' ? 'AI 만화 이미지 생성' : 'AI 만화 숏폼 만들기'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'generating' && (
        <VideoProgressIndicator progress={progress} label={ttsEnabled ? 'AI 내레이션 만화 변환 중...' : '만화 변환 중...'} color={theme.colors.accent[400]} />
      )}

      {state === 'done' && resultUri && !editingPanels && (
        <View style={styles.panelEditorToggleWrap}>
          <TouchableOpacity style={styles.panelEditToggleBtn} onPress={handleStartEditPanels} activeOpacity={0.7}>
            <Pencil size={15} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.panelEditToggleText}>컷별 대사 수정</Text>
          </TouchableOpacity>
        </View>
      )}

      {state !== 'idle' && scenarioPanels.length > 0 && (
        <View style={styles.panelTimelineWrap}>
          <View style={styles.panelTimelineHeader}>
            <AlignVerticalJustifyCenter size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.panelTimelineTitle}>만화 컷 타임라인</Text>
          </View>
          {!editingPanels ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.panelTimelineScroll}>
              {scenarioPanels.map((panel, i) => (
                <View key={i} style={styles.panelTimelineCard}>
                  <View style={styles.panelTimelineNum}>
                    <Text style={styles.panelTimelineNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.panelTimelineSpeech} numberOfLines={3}>{panel.speech}</Text>
                  {panel.sfx ? (
                    <View style={styles.panelTimelineSfxBadge}>
                      <Text style={styles.panelTimelineSfxText}>{panel.sfx}</Text>
                    </View>
                  ) : null}
                  {panel.emotion ? (
                    <Text style={styles.panelTimelineEmotion}>{panel.emotion}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View>
              {editablePanels.map((panel, i) => (
                <View key={i} style={styles.panelEditCard}>
                  <View style={styles.panelEditHeader}>
                    <View style={styles.panelEditNum}>
                      <Text style={styles.panelEditNumText}>컷 {i + 1}</Text>
                    </View>
                    {panel.episodeLabel ? (
                      <Text style={styles.panelEditLabel}>{panel.episodeLabel}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.panelEditFieldLabel}>대사</Text>
                  <TextInput
                    style={styles.panelEditInput}
                    value={panel.speech}
                    onChangeText={(text) => handleEditPanelField(i, 'speech', text)}
                    multiline
                    placeholder="이 컷의 대사를 입력하세요"
                    placeholderTextColor={theme.colors.dark.textFaint}
                  />
                  <View style={styles.panelEditRow}>
                    <View style={styles.panelEditFieldWrap}>
                      <Text style={styles.panelEditFieldLabel}>효과음</Text>
                      <TextInput
                        style={[styles.panelEditInput, styles.panelEditInputSmall]}
                        value={panel.sfx}
                        onChangeText={(text) => handleEditPanelField(i, 'sfx', text)}
                        placeholder="KWAANG!"
                        placeholderTextColor={theme.colors.dark.textFaint}
                      />
                    </View>
                    <View style={styles.panelEditFieldWrap}>
                      <Text style={styles.panelEditFieldLabel}>감정</Text>
                      <TextInput
                        style={[styles.panelEditInput, styles.panelEditInputSmall]}
                        value={panel.emotion}
                        onChangeText={(text) => handleEditPanelField(i, 'emotion', text)}
                        placeholder="놀람"
                        placeholderTextColor={theme.colors.dark.textFaint}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.panelEditActions}>
                <TouchableOpacity style={styles.panelEditCancelBtn} onPress={handleCancelEditPanels} activeOpacity={0.7}>
                  <Text style={styles.panelEditCancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.panelEditSaveBtn} onPress={handleSaveEditedPanels} activeOpacity={0.7}>
                  <Check size={15} color={theme.colors.accent[400]} strokeWidth={2.5} />
                  <Text style={styles.panelEditSaveText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.panelEditRegenBtn} onPress={handleRegenerateWithEdits} activeOpacity={0.7}>
                  <RefreshCw size={15} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.panelEditRegenText}>수정 후 재생성</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {state === 'done' && resultUri && (
        <View style={styles.resultWrap}>
          <Text style={styles.doneNotice}>
            {resultMime.includes('png')
              ? '만화 숏폼 이미지가 완성됐어요. 미리보기 후 저장하세요.'
              : narrationAudioDataUrl
                ? 'AI 내레이션 만화 숏폼이 완성됐어요. 미리보기 후 저장하세요.'
                : '만화 숏폼 동영상이 완성됐어요. 미리보기 후 저장하세요.'}
          </Text>

          <View style={styles.previewWrap}>
            <VideoPreview
              uri={resultUri}
              mimeType={resultMime}
              isVertical
              maxHeight={380}
            />
            <TouchableOpacity
              style={styles.fittingFloatBtn}
              onPress={() => setFittingModalOpen(true)}
              activeOpacity={0.85}
            >
              <Shirt size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.fittingFloatText}>내 몸에 입어보기</Text>
            </TouchableOpacity>
            {fittingResultUrl && (
              <View style={styles.fittingResultBadge}>
                <Check size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
                <Text style={styles.fittingResultText}>피팅 완료 — 결과 이미지가 적용됐어요</Text>
              </View>
            )}
          </View>

          <View style={styles.directShareBox}>
            <Text style={styles.directShareLabel}>SNS 원터치 공유</Text>
            <Text style={styles.directShareHint}>앨범 저장 없이 바로 SNS로 보낼 수 있어요</Text>
            <View style={styles.directShareRow}>
              <TouchableOpacity
                style={styles.directShareButton}
                onPress={handleDirectShare}
                disabled={sharing}
                activeOpacity={0.7}
              >
                <View style={[styles.directShareIcon, { backgroundColor: theme.colors.accent[500] }]}>
                  <Share2 size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.directShareText}>공유</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.directShareButton}
                onPress={() => handlePlatformShare('tiktok')}
                disabled={sharing}
                activeOpacity={0.7}
              >
                <View style={[styles.directShareIcon, { backgroundColor: '#000000' }]}>
                  <Music2 size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.directShareText}>틱톡</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.directShareButton}
                onPress={() => handlePlatformShare('instagram')}
                disabled={sharing}
                activeOpacity={0.7}
              >
                <View style={[styles.directShareIcon, { backgroundColor: '#E1306C' }]}>
                  <Instagram size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.directShareText}>인스타</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.directShareButton}
                onPress={() => handlePlatformShare('youtube')}
                disabled={sharing}
                activeOpacity={0.7}
              >
                <View style={[styles.directShareIcon, { backgroundColor: '#FF0000' }]}>
                  <Youtube size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.directShareText}>쇼츠</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.uploadTipsBox}>
            <View style={styles.uploadTipsHeader}>
              <Lightbulb size={14} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.uploadTipsTitle}>멀티 업로드 꿀팁</Text>
            </View>
            <View style={styles.uploadTipItem}>
              <Smartphone size={15} color={theme.colors.accent[400]} strokeWidth={2} />
              <View style={styles.uploadTipTextWrap}>
                <Text style={styles.uploadTipLabel}>화면 비율 9:16</Text>
                <Text style={styles.uploadTipDesc}>1080x1920 세로 비율로 모든 플랫폼에 딱 맞아요</Text>
              </View>
            </View>
            <View style={styles.uploadTipItem}>
              <AlignVerticalJustifyCenter size={15} color={theme.colors.accent[400]} strokeWidth={2} />
              <View style={styles.uploadTipTextWrap}>
                <Text style={styles.uploadTipLabel}>핵심 텍스트 위치</Text>
                <Text style={styles.uploadTipDesc}>좋아요·댓글창이 하단에 겹쳐요. 중요 문구는 상단·정중앙에</Text>
              </View>
            </View>
            <View style={styles.uploadTipItem}>
              <Clock size={15} color={theme.colors.accent[400]} strokeWidth={2} />
              <View style={styles.uploadTipTextWrap}>
                <Text style={styles.uploadTipLabel}>영상 길이 60초 이하</Text>
                <Text style={styles.uploadTipDesc}>세 플랫폼 동시 업로드 시 알고리즘 노출에 유리해요</Text>
              </View>
            </View>
          </View>

          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleSaveToGallery} activeOpacity={0.8}>
              <Download size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.downloadButtonText}>저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cloudSaveButton}
              onPress={handleSaveToCloud}
              disabled={cloudSaving}
              activeOpacity={0.7}
            >
              {cloudSaving ? (
                <Loader2 size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              ) : (
                <CloudUpload size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              )}
              <Text style={styles.cloudSaveButtonText}>
                {cloudSaving ? '저장 중...' : '클라우드 저장'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.remakeButton} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.remakeButtonText}>다시</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>생성 실패. 다시 시도해주세요.</Text>
        </View>
      )}

      {fittingModalOpen && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setFittingModalOpen(false)}
        >
          <View style={styles.fittingModalBackdrop}>
            <View style={styles.fittingModalCard}>
              <View style={styles.fittingModalHeader}>
                <View style={styles.fittingModalTitleWrap}>
                  <View style={styles.fittingModalIcon}>
                    <Shirt size={18} color={theme.colors.success[400]} strokeWidth={2} />
                  </View>
                  <View>
                    <Text style={styles.fittingModalTitle}>내 몸에 입어보기</Text>
                    <Text style={styles.fittingModalSubtitle}>숏폼 속 상품을 AI 모델에게 입혀보세요</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setFittingModalOpen(false)}
                  style={styles.fittingCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.fittingModalScroll}
                contentContainerStyle={styles.fittingModalContent}
                showsVerticalScrollIndicator={false}
              >
                <VirtualFittingGallery
                  imageDataUrl={safeImageUrl}
                  productName={productName}
                  productCategory={productCategory}
                  onUseImage={(url) => {
                    setFittingResultUrl(url);
                    setFittingModalOpen(false);
                    showToast('가상 피팅 결과가 완성됐어요');
                  }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {toast && (
        <View style={styles.toastBox}>
          <Zap size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {Platform.OS !== 'web' && (
        <View style={styles.webViewHidden}>
          <WebView
            key={webviewKey}
            ref={webViewRef}
            source={webViewSource}
            onMessage={handleWebViewMessage}
            onError={() => {
              if (stateRef.current === 'generating') {
                setState('error');
                showToast('웹뷰 로드에 실패했어요. 다시 시도해주세요');
              }
            }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            style={styles.webView as ViewStyle}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  durationInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  durationInfoText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  styleScroll: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    marginBottom: theme.spacing.sm,
  },
  stylePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  stylePillActive: {
    backgroundColor: theme.colors.accent[500],
  },
  stylePillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  stylePillTextActive: {
    color: '#fff',
  },
  styleDescBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  styleDescText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  autoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  moodScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  moodPillActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '20',
  },
  moodSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  moodPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  moodPillTextActive: {
    color: '#fff',
  },
  autoInfoText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[300],
    lineHeight: 16,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  advancedToggleText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
    ...theme.shadows.card,
  },
  generateButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    gap: 10,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.accent[400],
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  resultWrap: {
    gap: theme.spacing.md,
  },
  previewWrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: theme.spacing.sm,
  },
  fittingFloatBtn: {
    position: 'absolute',
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    ...theme.shadows.card,
  },
  fittingFloatText: {
    color: '#fff',
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
  },
  fittingResultBadge: {
    position: 'absolute',
    left: theme.spacing.sm,
    top: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  fittingResultText: {
    color: theme.colors.success[400],
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
  },
  fittingModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  fittingModalCard: {
    maxHeight: '88%',
    backgroundColor: theme.colors.dark.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  fittingModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.surfaceLight,
  },
  fittingModalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  fittingModalIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fittingModalTitle: {
    color: theme.colors.dark.text,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
  },
  fittingModalSubtitle: {
    color: theme.colors.dark.textDim,
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: 2,
  },
  fittingCloseBtn: {
    padding: theme.spacing.xs,
  },
  fittingModalScroll: {
    flexGrow: 0,
  },
  fittingModalContent: {
    padding: theme.spacing.md,
  },
  doneNotice: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  downloadButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  remakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  remakeButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  cloudSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  cloudSaveButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
  },
  errorText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400],
  },
  toastText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  scenarioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  scenarioBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  scenarioBadgeAi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.accent[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  scenarioBadgeTextAi: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  trendingBox: {
    backgroundColor: theme.colors.success[500] + '0D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '20',
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  trendingLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  trendingTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trendingTag: {
    backgroundColor: theme.colors.success[500] + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  trendingTagText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
  trendingHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  artStyleScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  artStylePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  artStylePillActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '20',
  },
  artStylePillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  artStylePillTextActive: {
    color: '#fff',
  },
  styleDescHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 4,
  },
  voiceSelectorWrap: {
    marginBottom: theme.spacing.md,
  },
  voiceCatScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  voiceCatPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  voiceCatPillActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '20',
  },
  voiceCatPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  voiceCatPillTextActive: {
    color: '#fff',
  },
  voiceCatDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginBottom: 8,
  },
  voiceListScroll: {
    gap: 6,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  voiceItemActive: {
    borderColor: theme.colors.accent[400],
    backgroundColor: theme.colors.accent[500] + '15',
  },
  voiceItemLeft: {
    flex: 1,
  },
  voiceItemLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  voiceItemDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  voiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voicePreviewBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  multilingualDubWrap: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary[500] + '20',
  },
  multilingualDubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  multilingualDubTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  multilingualDubDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginBottom: 8,
    lineHeight: 14,
  },
  multilingualDubScroll: {
    flexDirection: 'row',
  },
  multilingualDubPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginRight: 6,
  },
  multilingualDubPillActive: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500] + '20',
  },
  multilingualDubPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  multilingualDubPillTextActive: {
    color: '#fff',
  },
  panelEditorToggleWrap: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  panelEditToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.accent[500] + '30',
  },
  panelEditToggleText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  panelTimelineWrap: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  panelTimelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  panelTimelineTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  panelTimelineScroll: {
    flexDirection: 'row',
  },
  panelTimelineCard: {
    width: 140,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 10,
    marginRight: 8,
    gap: 6,
  },
  panelTimelineNum: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelTimelineNumText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  panelTimelineSpeech: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 16,
  },
  panelTimelineSfxBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.warning[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  panelTimelineSfxText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  panelTimelineEmotion: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  panelEditCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  panelEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelEditNum: {
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  panelEditNumText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  panelEditLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  panelEditFieldLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
    marginBottom: 4,
  },
  panelEditInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 44,
  },
  panelEditInputSmall: {
    minHeight: 36,
    fontSize: 12,
  },
  panelEditRow: {
    flexDirection: 'row',
    gap: 8,
  },
  panelEditFieldWrap: {
    flex: 1,
  },
  panelEditActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  panelEditCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
  },
  panelEditCancelText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  panelEditSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '18',
  },
  panelEditSaveText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  panelEditRegenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  panelEditRegenText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  toggleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.dark.textFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  toggleCheckActive: {
    backgroundColor: theme.colors.accent[500],
    borderColor: theme.colors.accent[500],
  },
  toggleCheckText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  toggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  webViewHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: -1,
  },
  webView: {
    width: 1,
    height: 1,
  },
  directShareBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 8,
  },
  directShareLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  directShareHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  directShareRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  directShareButton: {
    alignItems: 'center',
    gap: 6,
  },
  directShareIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directShareText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  uploadTipsBox: {
    backgroundColor: theme.colors.warning[500] + '0D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '20',
  },
  uploadTipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  uploadTipsTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  uploadTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  uploadTipTextWrap: {
    flex: 1,
    gap: 2,
  },
  uploadTipLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  uploadTipDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 14,
  },
});
