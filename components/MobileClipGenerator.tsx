import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Film, Download, RefreshCw, CircleAlert as AlertCircle, CloudUpload, Loader as Loader2, Play, Sparkles, ChevronDown } from 'lucide-react-native';
import { VideoPreview } from '@/components/VideoPreview';
import { RoamingBabyOverlay } from '@/components/RoamingBabyOverlay';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { uploadAssetFromFileUri, saveAssetRecord } from '@/lib/savedAssets';
import { urlToDataUrl } from '@/lib/base64';
import { getWebViewOverlayScript } from '@/lib/canvasOverlay';
import { DURATION_PRESETS, DEFAULT_DURATION, getRecommendedDuration, tierLabel, tierColor, getTierForDuration } from '@/lib/durationPresets';
import type { PlatformKey, PlatformVariant, CustomReview } from '@/types/database';
import type { StyleRecommendation } from '@/lib/styleRecommend';

interface MobileClipGeneratorProps {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  category: string;
  fileName: string;
  affiliatePlatforms?: string[];
  platform?: PlatformKey;
  templateData?: {
    targetAudience?: string;
    emotionAngle?: string;
    platformVariants?: Record<PlatformKey, PlatformVariant>;
  } | null;
  customReview?: CustomReview | null;
  shortUrl?: string;
  recommendedStyle?: StyleRecommendation | null;
  styleAppliedKey?: string | null;
}

type GenState = 'idle' | 'generating' | 'done' | 'error';
type VideoFormat = 'vertical' | 'horizontal';
type CardStyleKey = 'bold' | 'magazine' | 'feed' | 'minimal';
type MusicMood = 'none' | 'upbeat' | 'calm' | 'emotional';
type MotionPreset = 'kenburns' | 'zoom-in' | 'zoom-out' | 'slide-in' | 'slow-motion';
type HybridMode = 'off' | 'photo-to-comic';

const MOTION_PRESETS: { label: string; value: MotionPreset; desc: string }[] = [
  { label: '켄번즈', value: 'kenburns', desc: '부드러운 줌인 + 위로 패닝. 기본 연출.' },
  { label: '줌인', value: 'zoom-in', desc: '빠르게 당기는 줌인으로 시선 집중.' },
  { label: '줌아웃', value: 'zoom-out', desc: '축소되며 전체가 드러나는 효과.' },
  { label: '슬라이드인', value: 'slide-in', desc: '왼쪽에서 슬라이드하며 등장.' },
  { label: '슬로우모션', value: 'slow-motion', desc: '느린 줌 + 페이드로 감성 연출.' },
];

const HYBRID_PRESETS: { label: string; value: HybridMode; desc: string }[] = [
  { label: '사용 안 함', value: 'off', desc: '실사만으로 동영상 생성.' },
  { label: '실사→만화', value: 'photo-to-comic', desc: '처음 1.5초 실사 후킹 → 만화 스타일 전환. 초반 3초 시선 사로잡기.' },
];

const PLATFORM_FORMAT_DEFAULT: Record<PlatformKey, VideoFormat> = {
  naverBlog: 'horizontal',
  shortform: 'vertical',
  instagram: 'vertical',
  threads: 'vertical',
  twitter: 'horizontal',
  pinterest: 'vertical',
  smartstore: 'horizontal',
};

const FORMAT_PRESETS: { label: string; value: VideoFormat; aspect: string }[] = [
  { label: '세로형', value: 'vertical', aspect: '9:16' },
  { label: '가로형', value: 'horizontal', aspect: '16:9' },
];

const STYLE_PRESETS: { label: string; value: CardStyleKey; tag: string; desc: string }[] = [
  { label: '볼드', value: 'bold', tag: 'REELS', desc: '숏폼 전용 · 큰 텍스트와 강렬한 색상 배지로 시선을 사로잡는 스타일. 릴스·쇼츠·틱톡에 최적화.' },
  { label: '매거진', value: 'magazine', tag: 'BLOG', desc: '블로그 전용 · 잡지처럼 우아한 레이아웃과 상세한 설명으로 신뢰감을 주는 스타일. 네이버 블로그에 최적화.' },
  { label: '피드', value: 'feed', tag: 'FEED', desc: '인스타 전용 · 사각형 비율에 리뷰 별점을 강조하여 구매를 유도하는 스타일. 인스타그램 피드에 최적화.' },
  { label: '미니멀', value: 'minimal', tag: 'X', desc: 'X(트위터) 전용 · 여백이 많은 깔끔한 디자인으로 핵심만 전달하는 스타일. 스레드·X 게시에 최적화.' },
];

const PLATFORM_STYLE_MAP: Record<PlatformKey, CardStyleKey> = {
  naverBlog: 'magazine',
  shortform: 'bold',
  twitter: 'minimal',
  instagram: 'feed',
  threads: 'minimal',
  pinterest: 'magazine',
  smartstore: 'magazine',
};

const MUSIC_PRESETS: { label: string; value: MusicMood }[] = [
  { label: '없음', value: 'none' },
  { label: '업비트', value: 'upbeat' },
  { label: '차분', value: 'calm' },
  { label: '감성', value: 'emotional' },
];

const FPS = 30;

const FORMATS: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
};

function buildWebViewHTML(params: {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  affiliatePlatforms: string[];
  shortUrl: string;
  duration: number;
  format: VideoFormat;
  cardStyle: CardStyleKey;
  musicMood: MusicMood;
  motionPreset: MotionPreset;
  hybridMode: HybridMode;
  tagText: string;
  disclosureText: string;
}): string {
  const { imageUrl, hook, title, hashtags, accentColor, affiliatePlatforms, shortUrl, duration, format, cardStyle, musicMood, motionPreset, hybridMode, tagText, disclosureText } = params;
  const { width: W, height: H } = FORMATS[format];
  const hashtagStr = hashtags.slice(0, 8).map((h) => `#${h}`).join(' ');
  const hasHashtags = hashtags.length > 0 ? 'true' : 'false';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
</head><body>
<canvas id="cv"></canvas>
<script>
(function(){
  var W=${W}, H=${H};
  var canvas=document.getElementById('cv');
  canvas.width=W; canvas.height=H;
  var ctx=canvas.getContext('2d');
  var hook=${JSON.stringify(hook)};
  var title=${JSON.stringify(title)};
  var hashtagStr=${JSON.stringify(hashtagStr)};
  var hasHashtags=${hasHashtags};
  var accentColor=${JSON.stringify(accentColor)};
  var shortUrl=${JSON.stringify(shortUrl)};
  var tagText=${JSON.stringify(tagText)};
  var disclosureText=${JSON.stringify(disclosureText)};
  var duration=${duration};
  var musicMood=${JSON.stringify(musicMood)};
  var motionPreset=${JSON.stringify(motionPreset)};
  var hybridMode=${JSON.stringify(hybridMode)};
  var FPS=${FPS};
  var imageUrl=${JSON.stringify(imageUrl)};

  function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function easeOutCubic(t){return 1-Math.pow(1-t,3);}
  function easeInOutCubic(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
  function easeOutBack(t){var c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}
  function getMotionParams(motion,t){
    switch(motion){
      case 'zoom-in':return{scale:1.05+easeOutCubic(t)*0.35,panX:0,panY:-easeOutCubic(t)*20,alpha:1};
      case 'zoom-out':{var zt=easeOutCubic(t);return{scale:1.5-zt*0.35,panX:0,panY:-zt*15,alpha:1};}
      case 'slide-in':{var slideT=Math.min(t*2.5,1);var eased=easeOutCubic(slideT);return{scale:1+easeOutCubic(t)*0.15,panX:(1-eased)*-300,panY:-easeOutCubic(t)*20,alpha:1};}
      case 'slow-motion':{var slowT=Math.pow(t,0.6);return{scale:1.02+slowT*0.12,panX:0,panY:-slowT*25,alpha:Math.min(t*3,1)};}
      default:return{scale:1+easeOutCubic(t)*0.18,panX:0,panY:-easeOutCubic(t)*30,alpha:1};
    }
  }
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

  // Layout
  var L;
  if('${format}'==='vertical'){
    L={badge:{x:60,y:120,w:300,h:56,r:28},badgeText:{x:82,y:148,font:'600 24px sans-serif'},catTag:{x:W-200,y:128,w:140,h:44,r:10},catText:{x:W-188,y:150},
      hookBox:{x:50,yBase:0.52,w:W-100,h:140,r:16},hookText:{x:84,yOffset:-48,maxWidth:W-168,lineHeight:64,font:'700 54px sans-serif'},
      title:{x:60,yBase:0.7,maxWidth:W-120,lineHeight:48,font:'600 38px sans-serif'},
      hashtags:{x:60,yBase:0.76,maxWidth:W-120,lineHeight:38,font:'500 30px sans-serif'},
      cta:{x:60,y:H-220,w:W-120,h:68,r:16},ctaText:{x:W/2,y:H-186,font:'700 30px sans-serif'},
      ctaDisclosure:{x:W/2,y:H-130},ctaShortUrl:{x:W/2,y:H-104},
      outro:{captionY:Math.round(H*0.42),captionFont:'700 52px sans-serif',urlY:Math.round(H*0.52),urlFont:'500 40px sans-serif'}};
  } else {
    L={badge:{x:60,y:80,w:280,h:52,r:26},badgeText:{x:80,y:106,font:'600 22px sans-serif'},catTag:{x:W-200,y:88,w:140,h:42,r:10},catText:{x:W-188,y:109},
      hookBox:{x:60,yBase:0.42,w:700,h:120,r:16},hookText:{x:90,yOffset:-40,maxWidth:600,lineHeight:56,font:'700 48px sans-serif'},
      title:{x:60,yBase:0.6,maxWidth:800,lineHeight:44,font:'600 36px sans-serif'},
      hashtags:{x:60,yBase:0.7,maxWidth:W-120,lineHeight:36,font:'500 28px sans-serif'},
      cta:{x:60,y:H-160,w:480,h:60,r:16},ctaText:{x:300,y:H-130,font:'700 26px sans-serif'},
      ctaDisclosure:{x:300,y:H-80},ctaShortUrl:{x:300,y:H-56},
      outro:{captionY:Math.round(H*0.4),captionFont:'700 44px sans-serif',urlY:Math.round(H*0.5),urlFont:'500 34px sans-serif'}};
  }

  // Music patterns
  var MUSIC_PATTERNS={
    upbeat:{notes:[261.63,329.63,392.0,523.25,392.0,329.63,392.0,523.25],noteDuration:180,waveType:'triangle',volume:0.12,harmony:[130.81,196.0,196.0,261.63]},
    calm:{notes:[220.0,277.18,329.63,277.18,220.0,277.18,329.63,440.0],noteDuration:400,waveType:'sine',volume:0.1,harmony:[110.0,164.81,110.0,164.81]},
    emotional:{notes:[196.0,233.08,293.66,349.23,293.66,233.08,196.0,174.61],noteDuration:320,waveType:'sine',volume:0.11,harmony:[98.0,146.83,98.0,146.83]}
  };

  function createBgm(mood,durMs){
    if(!window.AudioContext)return null;
    var ac=new AudioContext();var dest=ac.createMediaStreamDestination();
    var masterGain=ac.createGain();masterGain.gain.value=0;
    masterGain.connect(dest);masterGain.connect(ac.destination);
    var p=MUSIC_PATTERNS[mood];var totalNotes=Math.ceil(durMs/p.noteDuration);var oscs=[];
    var fadeIn=Math.min(0.3,durMs/1000/3);var fadeOut=Math.max(0,durMs/1000-0.5);
    masterGain.gain.setValueAtTime(0,0);
    masterGain.gain.linearRampToValueAtTime(p.volume,fadeIn);
    masterGain.gain.setValueAtTime(p.volume,fadeOut);
    masterGain.gain.linearRampToValueAtTime(0,durMs/1000);
    for(var i=0;i<totalNotes;i++){
      var st=i*(p.noteDuration/1000);var freq=p.notes[i%p.notes.length];var hf=p.harmony[i%p.harmony.length];
      var osc=ac.createOscillator();var ng=ac.createGain();
      osc.type=p.waveType;osc.frequency.value=freq;
      ng.gain.setValueAtTime(0,st);ng.gain.linearRampToValueAtTime(0.6,st+0.02);
      ng.gain.exponentialRampToValueAtTime(0.001,st+p.noteDuration/1000*0.9);
      osc.connect(ng);ng.connect(masterGain);osc.start(st);osc.stop(st+p.noteDuration/1000);oscs.push(osc);
      var ho=ac.createOscillator();var hg=ac.createGain();
      ho.type='sine';ho.frequency.value=hf;
      hg.gain.setValueAtTime(0,st);hg.gain.linearRampToValueAtTime(0.3,st+0.05);
      hg.gain.exponentialRampToValueAtTime(0.001,st+p.noteDuration/1000);
      ho.connect(hg);hg.connect(masterGain);ho.start(st);ho.stop(st+p.noteDuration/1000);oscs.push(ho);
    }
    return {stream:dest.stream,stop:function(){try{oscs.forEach(function(o){try{o.stop();}catch(e){}});ac.close();}catch(e){}}};
  }

  ${getWebViewOverlayScript()}

  function postMsg(type,data){
    var msg=JSON.stringify({type:type,data:data||{}});
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(msg);}
    else if(window.parent&&window.parent!==window){window.parent.postMessage(msg,'*');}
  }

  var img=new Image();
  var imgLoadTimeout=setTimeout(function(){postMsg('error',{msg:'image load timeout'});},45000);
  img.onload=function(){
    clearTimeout(imgLoadTimeout);
    postMsg('ready',{});
    try{startGeneration();}catch(e){postMsg('error',{msg:'generation failed: '+(e&&e.message||'unknown')});}
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
      img.onload=function(){
        clearTimeout(imgLoadTimeout);
        try{
          var testCanvas=document.createElement('canvas');
          testCanvas.width=1;testCanvas.height=1;
          var testCtx=testCanvas.getContext('2d');
          if(testCtx){testCtx.drawImage(img,0,0,1,1);testCtx.getImageData(0,0,1,1);}
          postMsg('ready',{});
          try{startGeneration();}catch(e){postMsg('error',{msg:'generation failed: '+(e&&e.message||'unknown')});}
        }catch(e){
          postMsg('error',{msg:'canvas tainted (CORS): '+(e&&e.message||'unknown')});
        }
      };
      img.onerror=function(){
        clearTimeout(imgLoadTimeout);
        postMsg('error',{msg:'image load failed (CORS or network)'});
      };
      img.src=imageUrl;
    });
  }

  function startGeneration(){
    var hasRecorder=typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function';
    var canvasStream=null,recorder=null,bgmResult=null,combinedStream=null,mimeType='video/webm';
    var donePromise=null;
    if(hasRecorder){
      canvasStream=canvas.captureStream(FPS);
      if(musicMood!=='none'){bgmResult=createBgm(musicMood,duration);}
      combinedStream=canvasStream;
      if(bgmResult){
        var tracks=canvasStream.getVideoTracks().concat(bgmResult.stream.getAudioTracks());
        if(tracks.length>canvasStream.getVideoTracks().length){combinedStream=new MediaStream(tracks);}
      }
      if(MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))mimeType='video/webm;codecs=vp9';
      else if(MediaRecorder.isTypeSupported('video/webm;codecs=vp8'))mimeType='video/webm;codecs=vp8';
      recorder=new MediaRecorder(combinedStream,{mimeType:mimeType,videoBitsPerSecond:6000000});
      var chunks=[];
      recorder.ondataavailable=function(e){if(e.data.size>0)chunks.push(e.data);};
      donePromise=new Promise(function(resolve){
        recorder.onstop=function(){resolve(new Blob(chunks,{type:mimeType}));};
      });
      recorder.start();
    }
    var startTime=performance.now();

    // Pre-render halftone dot grid to offscreen canvas
    var halftoneCanvas=null;
    if(hybridMode==='photo-to-comic'){
      halftoneCanvas=document.createElement('canvas');
      halftoneCanvas.width=W;halftoneCanvas.height=H;
      var hctx=halftoneCanvas.getContext('2d');
      if(hctx){hctx.fillStyle=accentColor;
        for(var hdy=0;hdy<H;hdy+=24){for(var hdx=0;hdx<W;hdx+=24){hctx.beginPath();hctx.arc(hdx,hdy,3,0,Math.PI*2);hctx.fill();}}
      }
    }
    // Pre-build gradient
    var cachedGrad=ctx.createLinearGradient(0,0,0,H);
    cachedGrad.addColorStop(0,'rgba(10,15,30,0.25)');cachedGrad.addColorStop(0.45,'rgba(10,15,30,0.55)');cachedGrad.addColorStop(1,'rgba(10,15,30,0.95)');
    var lastPct=-1;

    function drawFrame(){
      var elapsed=performance.now()-startTime;
      var t=Math.min(elapsed/duration,1);
      var pct=Math.round(t*100);
      if(pct!==lastPct){lastPct=pct;postMsg('progress',{progress:pct});}

      ctx.fillStyle='#0a0f1e';ctx.fillRect(0,0,W,H);
      var mp=getMotionParams(motionPreset,t);
      var scale=mp.scale;var imgRatio=img.width/img.height;var canvasRatio=W/H;
      var drawW,drawH;
      if(imgRatio>canvasRatio){drawH=H*scale;drawW=drawH*imgRatio;}
      else{drawW=W*scale;drawH=drawW/imgRatio;}
      var panY=(H-drawH)/2+mp.panY;var panX=(W-drawW)/2+mp.panX;
      ctx.globalAlpha=mp.alpha;ctx.drawImage(img,panX,panY,drawW,drawH);ctx.globalAlpha=1;

      // Hybrid: photo-to-comic transition
      var hybridTP=0.25;var isHybrid=hybridMode==='photo-to-comic';var inComic=isHybrid&&t>=hybridTP;
      if(inComic){
        var comicT=Math.min((t-hybridTP)/0.15,1);var ec=easeInOutCubic(comicT);
        ctx.globalAlpha=ec*0.45;ctx.fillStyle=accentColor;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
        ctx.save();ctx.filter='saturate(2.0) contrast(1.4) brightness(1.05)';ctx.globalAlpha=ec*0.6;
        ctx.drawImage(img,panX,panY,drawW,drawH);ctx.restore();ctx.filter='none';ctx.globalAlpha=1;
        if(comicT>0.3){var fa=Math.min((comicT-0.3)*3,1)*(1-Math.min((comicT-0.3)*2,1));ctx.globalAlpha=fa;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
        if(comicT>0.5&&halftoneCanvas){var da=Math.min((comicT-0.5)*4,1)*0.08;ctx.globalAlpha=da;ctx.drawImage(halftoneCanvas,0,0);ctx.globalAlpha=1;}
      }

      ctx.fillStyle=cachedGrad;ctx.fillRect(0,0,W,H);

      // Hook
      var hookT=Math.max(0,(t-0.15)/0.3);
      if(hookT>0){var hookAlpha=Math.min(hookT*4,1);var hookOffset=(1-easeOutBack(Math.min(hookT,1)))*50;
        var hookY=H*0.72+hookOffset;ctx.globalAlpha=hookAlpha;
        ctx.fillStyle='#fff';ctx.font='700 44px sans-serif';ctx.textBaseline='top';
        ctx.shadowColor='rgba(0,0,0,0.85)';ctx.shadowBlur=12;ctx.shadowOffsetY=3;
        drawTextLines(ctx,hook,60,hookY,W-120,56);
        ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
        ctx.globalAlpha=1;}

      // Baby + link sticker composited into the video frame
      if(shortUrl&&t<0.667){
        __drawRoamingBabyWithLink(ctx,elapsed,W,H,shortUrl,accentColor);
      }

      // Disclosure text (last ~2 seconds)
      if(t>=0.667){
        var dt=Math.min((t-0.667)/0.1,1);
        ctx.globalAlpha=dt;ctx.fillStyle='#0a0f1e';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='400 18px sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        drawTextLines(ctx,disclosureText,W/2,H/2-20,W-80,26);
        ctx.textAlign='left';ctx.globalAlpha=1;
      }

      if(t<1){setTimeout(drawFrame,16);}
      else{setTimeout(function(){if(recorder&&recorder.state!=='inactive')recorder.stop();if(bgmResult)bgmResult.stop();},150);}
    }
    setTimeout(drawFrame,0);
    var watchdog=setTimeout(function(){if(lastPct<0||lastPct===0){postMsg('error',{msg:'generation watchdog: no progress within '+(Math.round(duration/1000)+15)+'s'});}},duration+15000);

    if(donePromise){
      donePromise.then(function(blob){
        var reader=new FileReader();
        reader.onloadend=function(){
          var base64=reader.result.split(',')[1];
          postMsg('done',{base64:base64,size:blob.size,mimeType:mimeType});
        };
        reader.readAsDataURL(blob);
      });
    } else {
      setTimeout(function(){
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
</script>
</body></html>`;
}

export function MobileClipGenerator({
  imageUrl,
  hook,
  title,
  hashtags,
  accentColor,
  category: _category,
  fileName,
  affiliatePlatforms = [],
  platform = 'shortform',
  templateData = null,
  customReview: _customReview = null,
  shortUrl = '',
  recommendedStyle = null,
  styleAppliedKey = null,
}: MobileClipGeneratorProps) {
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [format, setFormat] = useState<VideoFormat>(PLATFORM_FORMAT_DEFAULT[platform] || 'vertical');
  const [cardStyle, setCardStyle] = useState<CardStyleKey>(PLATFORM_STYLE_MAP[platform] || 'bold');
  const [musicMood, setMusicMood] = useState<MusicMood>('none');
  const [motionPreset, setMotionPreset] = useState<MotionPreset>('kenburns');
  const [hybridMode, setHybridMode] = useState<HybridMode>('off');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const lastAppliedKey = useRef<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/webm');
  const [videoSize, setVideoSize] = useState<number>(0);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [safeImageUrl, setSafeImageUrl] = useState(imageUrl);
  const webViewRef = useRef<WebView>(null);
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [webviewKey, setWebviewKey] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const converted = await urlToDataUrl(imageUrl);
        if (!cancelled) setSafeImageUrl(converted);
      } catch {
        if (!cancelled) setSafeImageUrl(imageUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    setCardStyle(PLATFORM_STYLE_MAP[platform] || 'bold');
    setFormat(PLATFORM_FORMAT_DEFAULT[platform] || 'vertical');
    lastAppliedKey.current = null;
  }, [platform]);

  useEffect(() => {
    if (!recommendedStyle || !styleAppliedKey) return;
    if (lastAppliedKey.current === styleAppliedKey) return;
    lastAppliedKey.current = styleAppliedKey;
    setCardStyle(recommendedStyle.cardStyle);
    setMusicMood(recommendedStyle.musicMood);
    setMotionPreset(recommendedStyle.motionPreset);
    setFormat(recommendedStyle.format);
    setDuration(recommendedStyle.duration);
    setHybridMode(recommendedStyle.hybridMode);
    showToast('AI 추천 스타일이 적용되었습니다!');
  }, [recommendedStyle, styleAppliedKey, showToast]);

  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
      if (videoUri && Platform.OS !== 'web') {
        FileSystem.deleteAsync(videoUri, { idempotent: true }).catch(() => {});
      }
    };
  }, [videoUri]);

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
        if (generateTimeoutRef.current) { clearTimeout(generateTimeoutRef.current); generateTimeoutRef.current = null; }
        const { base64, size, mimeType: rawMime } = msg.data;
        const mimeType = rawMime || 'video/webm';
        const isImage = msg.data.isImage === true;
        setVideoMime(mimeType);
        setVideoSize(size || 0);
        const ext = isImage ? 'png' : (mimeType.includes('webm') ? 'webm' : 'mp4');
        const fileUri = `${FileSystem.cacheDirectory}${fileName.replace(/\.png$|\.webm$/, '')}-${Date.now()}.${ext}`;
        try {
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setVideoUri(fileUri);
          setState('done');
          setProgress(100);
          showToast(isImage ? '템플릿 이미지가 생성됐어요. 갤러리나 클라우드에 저장하세요' : '동영상이 생성됐어요. 갤러리에 저장하거나 클라우드에 올릴 수 있어요');
        } catch {
          setState('error');
          showToast('동영상 파일 저장에 실패했어요');
        }
      } else if (msg.type === 'error') {
        if (stateRef.current !== 'generating') return;
        if (generateTimeoutRef.current) { clearTimeout(generateTimeoutRef.current); generateTimeoutRef.current = null; }
        setState('error');
        const errMsg = msg.data?.msg || '';
        if (errMsg.includes('timeout')) {
          showToast('이미지 로드 시간이 초과됐어요. 다시 시도해주세요');
        } else if (errMsg.includes('image load')) {
          showToast('이미지를 불러올 수 없어요. 다시 시도해주세요');
        } else {
          showToast('동영상 생성에 실패했어요. 다시 시도해주세요');
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [fileName, showToast]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      handleWebViewMessage({ nativeEvent: { data: event.data } } as WebViewMessageEvent);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleWebViewMessage]);

  const handleGenerate = useCallback(async () => {
    if (state === 'generating') return;
    setState('generating');
    setProgress(0);
    setVideoUri(null);
    if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    try {
      const converted = await urlToDataUrl(imageUrl);
      setSafeImageUrl(converted);
    } catch {
      // keep original URL; WebView fetch will retry
    }
    generateTimeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev === 'generating') {
          showToast('생성 시간이 초과됐어요. 다시 시도해주세요');
          return 'error';
        }
        return prev;
      });
    }, 60000);
    setWebviewKey((k) => k + 1);
  }, [state, imageUrl, showToast]);

  const handleSaveToGallery = useCallback(async () => {
    if (!videoUri) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('사진 접근 권한이 필요해요. 설정에서 허용해주세요');
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(videoUri);
      await MediaLibrary.createAlbumAsync('숏커넥트', asset, false);
      showToast('갤러리에 저장됐어요');
    } catch {
      showToast('갤러리 저장 중 오류가 발생했어요');
    }
  }, [videoUri, showToast]);

  const handleSaveToCloud = useCallback(async () => {
    if (!videoUri) return;
    setCloudSaving(true);
    try {
      const cloudExt = videoMime.includes('png') ? 'png' : 'webm';
      const cloudFileName = fileName.replace(/\.png$|\.webm$/, '') + '-clip-' + Date.now() + '.' + cloudExt;
      const fileUrl = await uploadAssetFromFileUri(videoUri, cloudFileName, videoMime);
      if (!fileUrl) {
        showToast('클라우드 업로드에 실패했어요');
        setCloudSaving(false);
        return;
      }
      await saveAssetRecord({
        scan_id: null,
        asset_type: videoMime.includes('png') ? 'image' : 'video',
        title: title || '동영상 클립',
        file_url: fileUrl,
        file_name: cloudFileName,
        file_size: videoSize || null,
        mime_type: videoMime,
        thumbnail_url: imageUrl,
        platform: platform,
        affiliate_platform: affiliatePlatforms.join(',') || null,
      });
      showToast('클라우드에 저장됐어요. 내 제작물 탭에서 확인하세요');
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setCloudSaving(false);
  }, [videoUri, fileName, title, imageUrl, platform, affiliatePlatforms, videoMime, videoSize, showToast]);

  const handleReset = useCallback(() => {
    if (generateTimeoutRef.current) { clearTimeout(generateTimeoutRef.current); generateTimeoutRef.current = null; }
    if (videoUri && Platform.OS !== 'web') {
      FileSystem.deleteAsync(videoUri, { idempotent: true }).catch(() => {});
    }
    setVideoUri(null);
    setState('idle');
    setProgress(0);
  }, [videoUri]);

  const html = useMemo(() => buildWebViewHTML({
    imageUrl: safeImageUrl,
    hook,
    title,
    hashtags,
    accentColor,
    affiliatePlatforms,
    shortUrl,
    duration,
    format,
    cardStyle,
    musicMood,
    motionPreset,
    hybridMode,
    tagText: STYLE_PRESETS.find((s) => s.value === cardStyle)?.tag || 'PRODUCT',
    disclosureText: getDisclosureShortForPlatforms(affiliatePlatforms),
  }), [safeImageUrl, hook, title, hashtags, accentColor, affiliatePlatforms, shortUrl, duration, format, cardStyle, musicMood, motionPreset, hybridMode]);
  const isVertical = format === 'vertical';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Film size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>{Platform.OS === 'ios' ? '템플릿 이미지 만들기' : '동영상 만들기'}</Text>
        </View>
        {state === 'done' && (
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        {Platform.OS === 'ios'
          ? '제품 사진과 마케팅 카피로 템플릿 이미지를 생성합니다. AI가 플랫폼에 맞춰 자동으로 구성해요.'
          : '제품 사진과 마케팅 카피로 동영상을 자동 생성합니다. AI가 플랫폼에 맞춰 템플릿·비율·길이·음악을 자동으로 선택해요.'}
      </Text>

      {state === 'idle' && (
        <View>
          <View style={styles.autoInfoBox}>
            <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.autoInfoText}>
              위 설정은 AI 추천값입니다. 필요하면 고급 옵션에서 직접 조정할 수 있어요
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
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>템플릿</Text>
                <View style={styles.styleScroll}>
                  {STYLE_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[styles.stylePill, cardStyle === preset.value && styles.stylePillActive]}
                      onPress={() => setCardStyle(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stylePillText, cardStyle === preset.value && styles.stylePillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(() => {
                const selected = STYLE_PRESETS.find((s) => s.value === cardStyle);
                if (!selected) return null;
                return (
                  <View style={styles.styleDescBox}>
                    <Text style={styles.styleDescTag}>{selected.tag}</Text>
                    <Text style={styles.styleDescText}>{selected.desc}</Text>
                  </View>
                );
              })()}

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>화면 비율</Text>
                <View style={styles.toggleGroup}>
                  {FORMAT_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[styles.togglePill, format === preset.value && styles.togglePillActive]}
                      onPress={() => setFormat(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.togglePillText, format === preset.value && styles.togglePillTextActive]}>
                        {preset.label}
                      </Text>
                      <Text style={[styles.togglePillSub, format === preset.value && styles.togglePillSubActive]}>
                        {preset.aspect}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>배경 음악</Text>
                <View style={styles.toggleGroup}>
                  {MUSIC_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[styles.togglePill, musicMood === preset.value && styles.togglePillActive]}
                      onPress={() => setMusicMood(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.togglePillText, musicMood === preset.value && styles.togglePillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>모션 효과</Text>
                <View style={styles.motionScroll}>
                  {MOTION_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[styles.stylePill, motionPreset === preset.value && styles.stylePillActive]}
                      onPress={() => setMotionPreset(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stylePillText, motionPreset === preset.value && styles.stylePillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.durationSection}>
                <View style={styles.durationHeaderRow}>
                  <Text style={styles.optionLabel}>영상 길이</Text>
                  <View style={styles.durationTierBadge}>
                    <Text style={[styles.durationTierText, { color: tierColor(getTierForDuration(duration)) }]}>
                      {tierLabel(getTierForDuration(duration))}
                    </Text>
                  </View>
                </View>
                <View style={styles.durationPillGroup}>
                  {(() => {
                    const recDur = getRecommendedDuration(_category);
                    return DURATION_PRESETS.map((preset) => {
                    const active = duration === preset.value;
                    const isRec = recDur.duration === preset.value;
                    return (
                      <TouchableOpacity
                        key={preset.value}
                        style={[
                          styles.durationPill,
                          active && styles.durationPillActive,
                        ]}
                        onPress={() => setDuration(preset.value)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.durationPillLabel,
                            active && styles.durationPillLabelActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        {isRec && (
                          <View style={styles.recDot} />
                        )}
                      </TouchableOpacity>
                    );
                    });
                  })()}
                </View>
                <Text style={styles.durationHint}>
                  {DURATION_PRESETS.find((p) => p.value === duration)?.desc}
                </Text>
                <View style={styles.durationRecBox}>
                  <Sparkles size={12} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.durationRecText}>
                    {(() => { const r = getRecommendedDuration(_category); return `이 카테고리 추천: ${r.duration / 1000}초 · ${r.reason}`; })()}
                  </Text>
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>하이브리드</Text>
                <View style={styles.hybridScroll}>
                  {HYBRID_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[styles.stylePill, hybridMode === preset.value && styles.hybridPillActive]}
                      onPress={() => setHybridMode(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stylePillText, hybridMode === preset.value && styles.stylePillTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {hybridMode !== 'off' && (
                <View style={styles.styleDescBox}>
                  <Text style={styles.styleDescText}>
                    {HYBRID_PRESETS.find((h) => h.value === hybridMode)?.desc}
                  </Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} activeOpacity={0.8}>
            <Film size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.generateButtonText}>{Platform.OS === 'ios' ? '이미지 만들기' : '동영상 만들기'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'generating' && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressLabelRow}>
            <ActivityIndicator size="small" color={theme.colors.primary[400]} />
            <Text style={styles.progressText}>생성 중... {progress}%</Text>
          </View>
        </View>
      )}

      {state === 'done' && videoUri && (
        <View style={styles.resultWrap}>
          <Text style={styles.doneNotice}>
            {videoMime.includes('png')
              ? '템플릿 이미지가 생성됐어요. 미리보기 후 저장하세요.'
              : '동영상이 생성됐어요. 미리보기 후 저장하세요.'}
          </Text>
          <View style={styles.previewWrap}>
            <View style={styles.previewInner}>
              <VideoPreview
                uri={videoUri}
                mimeType={videoMime}
                isVertical={format === 'vertical'}
                maxHeight={380}
              />
              {shortUrl && Platform.OS !== 'web' && (
                <RoamingBabyOverlay
                  linkUrl={shortUrl}
                  containerWidth={format === 'vertical' ? 220 : 360}
                  containerHeight={format === 'vertical' ? 380 : 220}
                />
              )}
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

      {toast && (
        <View style={styles.toastBox}>
          <Play size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {state === 'generating' && (
        <View style={styles.webViewHidden}>
          {Platform.OS === 'web' ? (
            <iframe
              key={webviewKey}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              style={{ width: 1, height: 1, border: 'none', opacity: 0.01, position: 'absolute' }}
            />
          ) : (
            <WebView
              key={webviewKey}
              ref={webViewRef}
              source={{ html }}
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
          )}
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: theme.colors.warning[500],
  },
  togglePillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  togglePillTextActive: {
    color: '#fff',
  },
  togglePillSub: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 1,
  },
  togglePillSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  durationSection: {
    marginBottom: theme.spacing.md,
  },
  durationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  durationTierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  durationTierText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
  },
  durationPillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  durationPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  durationPillActive: {
    backgroundColor: theme.colors.warning[500],
  },
  durationPillLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  durationPillLabelActive: {
    color: '#fff',
  },
  recDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.warning[400],
  },
  durationHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 6,
    marginBottom: 8,
  },
  durationRecBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.warning[500] + '0D',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '20',
  },
  durationRecText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  styleScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 220,
  },
  motionScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 240,
  },
  hybridScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 200,
  },
  hybridPillActive: {
    backgroundColor: theme.colors.primary[500],
  },
  stylePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
  },
  stylePillActive: {
    backgroundColor: theme.colors.warning[500],
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  styleDescTag: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    backgroundColor: theme.colors.warning[500] + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  styleDescText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  autoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  autoInfoText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
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
    backgroundColor: theme.colors.warning[500],
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
    backgroundColor: theme.colors.warning[400],
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
  previewInner: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
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
    gap: 6,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
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
    fontSize: 12,
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
});
