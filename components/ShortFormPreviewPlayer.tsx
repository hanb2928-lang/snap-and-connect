import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Play,
  Pause,
  RotateCcw,
  Loader2,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { BgmPlayer } from '@/lib/bgmEngine';
import type { ShortFormEditPlan, EditSegment, StoryPhase } from '@/lib/shortFormEditEngine';
import { getCameraMovementForTime, type CameraMovement } from '@/lib/directingEngine';
import { trajectoryToCameraMovement, type NarrativePlan } from '@/lib/humanRealityNarrativeEngine';
import type { VideoGenProgress } from '@/lib/aiVideoPipeline';
import {
  sampleVideoLuminance,
  classifyLuminance,
  getCaptionStyle,
  getSafeZonePadding,
  type LuminanceLevel,
  type CaptionStyle,
} from '@/lib/captionStyling';

interface ShortFormPreviewPlayerProps {
  editPlan: ShortFormEditPlan;
  videoUri: string | null;
  imageUri?: string | null;
  slideshowImages?: string[] | null;
  narrativePlan?: NarrativePlan | null;
  videoGenProgress?: VideoGenProgress | null;
  bgmVolume?: number;
}

const TOTAL_DURATION = 15;
const TICK_MS = 50;
const LUMINANCE_SAMPLE_MS = 500;
const PREVIEW_FRAME_WIDTH = 135;
const PREVIEW_FRAME_HEIGHT = 240;
const VIDEO_LOAD_TIMEOUT_MS = 5000;
const BUFFERING_TIMEOUT_MS = 5000;

function getActiveSegment(segments: EditSegment[], currentSec: number): EditSegment | null {
  return segments.find((s) => currentSec >= s.startSec && currentSec < s.endSec) ?? null;
}

function getSegmentProgress(seg: EditSegment | null, currentSec: number): number {
  if (!seg) return 0;
  const elapsed = currentSec - seg.startSec;
  const duration = seg.endSec - seg.startSec;
  return duration > 0 ? Math.min(1, elapsed / duration) : 0;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function applyEasing(easing: CameraMovement['easing'], t: number): number {
  if (easing === 'ease_out_quart') return easeOutQuart(t);
  return easeInOutCubic(t);
}

function getNarrativeCamera(
  segments: EditSegment[],
  currentSec: number,
  narrativePlan: NarrativePlan | null,
): CameraMovement | null {
  if (!narrativePlan) return getCameraMovementForTime(segments, currentSec);
  const seg = getActiveSegment(segments, currentSec);
  if (!seg) return null;
  const traj = narrativePlan.trajectories.find((t) => t.phase === seg.storyPhase);
  if (!traj) return getCameraMovementForTime(segments, currentSec);
  return trajectoryToCameraMovement(traj, seg.index);
}

function computeStoryTransform(
  segments: EditSegment[],
  currentSec: number,
  narrativePlan: NarrativePlan | null = null,
): string {
  const seg = getActiveSegment(segments, currentSec);
  if (!seg) return 'scale(1) translate(0%, 0%)';
  const cam = getNarrativeCamera(segments, currentSec, narrativePlan);
  if (!cam) return 'scale(1) translate(0%, 0%)';
  const rawProgress = getSegmentProgress(seg, currentSec);
  const p = applyEasing(cam.easing, rawProgress);
  const scale = cam.startScale + (cam.endScale - cam.startScale) * p;
  const tx = cam.startTx + (cam.endTx - cam.startTx) * p;
  const ty = cam.startTy + (cam.endTy - cam.startTy) * p;
  return `scale(${scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`;
}

const STORY_PHASE_LABELS: Record<StoryPhase, string> = {
  gaze_hook: '시선 포착',
  need_discovery: '서사 전개',
  transformation: '변화·몰입',
  cta_call: 'CTA',
};

const STORY_PHASE_COLORS: Record<StoryPhase, string> = {
  gaze_hook: theme.colors.accent[300],
  need_discovery: theme.colors.primary[300],
  transformation: theme.colors.primary[400],
  cta_call: theme.colors.warning[400],
};

function getImageForSegment(
  segments: EditSegment[],
  seg: EditSegment | null,
  images: string[] | null,
): { src: string | null; index: number } {
  if (!images || images.length === 0) return { src: null, index: 0 };
  if (!seg) return { src: images[0], index: 0 };
  return { src: images[seg.index % images.length], index: seg.index % images.length };
}

export function ShortFormPreviewPlayer({ editPlan, videoUri, imageUri, slideshowImages, narrativePlan, videoGenProgress, bgmVolume = 0.75 }: ShortFormPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [luminanceLevel, setLuminanceLevel] = useState<LuminanceLevel>('dark');
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);
  const [displayedSegIndex, setDisplayedSegIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoBuffering, setVideoBuffering] = useState(false);
  const [videoFallbackMode, setVideoFallbackMode] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const luminanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgmPlayerRef = useRef<BgmPlayer | null>(null);

  const { width: screenWidth } = useWindowDimensions();

  const hasImage = !!imageUri;
  const hasSlideshow = !!slideshowImages && slideshowImages.length > 1;
  const hasGeneratedVideo = !!videoUri;
  const isGeneratingVideo = !!videoGenProgress && videoGenProgress.phase !== 'completed' && videoGenProgress.phase !== 'error';

  useEffect(() => {
    if (!videoUri) {
      setVideoSrc(null);
      return;
    }
    setVideoError(false);
    setVideoLoaded(false);
    if (Platform.OS === 'web') {
      setVideoSrc(videoUri);
      return;
    }
    if (videoUri.startsWith('data:') || videoUri.startsWith('blob:')) {
      setVideoSrc(videoUri);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(videoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (cancelled) return;
        setVideoSrc(`data:video/mp4;base64,${base64}`);
      } catch {
        if (!cancelled) setVideoSrc(videoUri);
      }
    })();
    return () => { cancelled = true; };
  }, [videoUri]);

  useEffect(() => {
    if (!videoSrc) {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
      return;
    }
    if (videoTimeoutRef.current) clearTimeout(videoTimeoutRef.current);
    videoTimeoutRef.current = setTimeout(() => {
      if (!videoLoaded) {
        setVideoError(true);
        setVideoFallbackMode(true);
      }
    }, VIDEO_LOAD_TIMEOUT_MS);
    return () => {
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
    };
  }, [videoSrc, videoLoaded]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webVideoRef.current || !videoSrc) return;
    const v = webVideoRef.current;
    const handleCanPlay = () => {
      setVideoLoaded(true);
      setVideoFallbackMode(false);
      if (videoTimeoutRef.current) {
        clearTimeout(videoTimeoutRef.current);
        videoTimeoutRef.current = null;
      }
    };
    const handlePlaying = () => {
      setVideoBuffering(false);
      if (isPlaying && bgmPlayerRef.current && !bgmPlayerRef.current.playing) {
        bgmPlayerRef.current.resume();
      }
    };
    const handlePause = () => {
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.pause();
      }
    };
    const handleEnded = () => {
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.stop();
      }
    };
    const handleWaiting = () => {
      setVideoBuffering(true);
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.pause();
      }
      if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = setTimeout(() => {
        setVideoError(true);
        setVideoFallbackMode(true);
      }, BUFFERING_TIMEOUT_MS);
    };
    const handleCanPlayAfterBuffer = () => {
      setVideoBuffering(false);
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
      if (isPlaying && bgmPlayerRef.current && !bgmPlayerRef.current.playing) {
        bgmPlayerRef.current.resume();
      }
    };
    const handleSeeked = () => {
      if (bgmPlayerRef.current && isPlaying) {
        bgmPlayerRef.current.stop();
        bgmPlayerRef.current.start(
          editPlan.bgmTemplate.id,
          editPlan.pacingBpm,
          editPlan.bgmTemplate.highlightStartSec,
          editPlan.bgmTemplate.highlightDurationSec,
          editPlan.bgmTemplate.energyCurve,
        );
      }
    };
    v.addEventListener('canplay', handleCanPlay);
    v.addEventListener('loadeddata', handleCanPlay);
    v.addEventListener('playing', handlePlaying);
    v.addEventListener('pause', handlePause);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('waiting', handleWaiting);
    v.addEventListener('canplaythrough', handleCanPlayAfterBuffer);
    v.addEventListener('seeked', handleSeeked);
    if (isPlaying) {
      v.play().catch(() => {
        setVideoError(true);
        setVideoFallbackMode(true);
      });
    } else {
      v.pause();
    }
    return () => {
      v.removeEventListener('canplay', handleCanPlay);
      v.removeEventListener('loadeddata', handleCanPlay);
      v.removeEventListener('playing', handlePlaying);
      v.removeEventListener('pause', handlePause);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('waiting', handleWaiting);
      v.removeEventListener('canplaythrough', handleCanPlayAfterBuffer);
      v.removeEventListener('seeked', handleSeeked);
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    };
  }, [isPlaying, videoSrc, editPlan.bgmTemplate.id, editPlan.pacingBpm, editPlan.bgmTemplate.highlightStartSec, editPlan.bgmTemplate.highlightDurationSec, editPlan.bgmTemplate.energyCurve]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webVideoRef.current || !videoSrc) return;
    const targetTime = currentSec;
    if (Math.abs(webVideoRef.current.currentTime - targetTime) > 0.5) {
      webVideoRef.current.currentTime = targetTime;
    }
  }, [currentSec, videoSrc]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !videoSrc) {
      setLuminanceLevel('dark');
      return;
    }
    const sampleLuminance = () => {
      const video = webVideoRef.current;
      if (!video || video.readyState < 2) return;
      const activeSeg = getActiveSegment(editPlan.segments, currentSec);
      const region = activeSeg?.position ?? 'center';
      const lum = sampleVideoLuminance(video, region);
      setLuminanceLevel(classifyLuminance(lum));
    };
    sampleLuminance();
    luminanceIntervalRef.current = setInterval(sampleLuminance, LUMINANCE_SAMPLE_MS);
    return () => {
      if (luminanceIntervalRef.current) {
        clearInterval(luminanceIntervalRef.current);
        luminanceIntervalRef.current = null;
      }
    };
  }, [videoSrc, currentSec, editPlan.segments]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (bgmPlayerRef.current) {
      bgmPlayerRef.current.stop();
    }
    setVideoBuffering(false);
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setCurrentSec(0);
  }, [stop]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      if (currentSec >= TOTAL_DURATION) {
        setCurrentSec(0);
      }
      if (Platform.OS === 'web') {
        if (!bgmPlayerRef.current) {
          bgmPlayerRef.current = new BgmPlayer();
        }
        bgmPlayerRef.current.unlockAudio();
        bgmPlayerRef.current.setVolume(bgmVolume);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentSec, stop]);

  const videoReady = hasGeneratedVideo && videoSrc && !videoError && !videoFallbackMode;

  useEffect(() => {
    if (!isPlaying) {
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.pause();
      }
      return;
    }
    if (Platform.OS !== 'web') return;
    if (!bgmPlayerRef.current) {
      bgmPlayerRef.current = new BgmPlayer();
    }
    bgmPlayerRef.current.setVolume(bgmVolume);
    if (!videoReady) {
      bgmPlayerRef.current.start(
        editPlan.bgmTemplate.id,
        editPlan.pacingBpm,
        editPlan.bgmTemplate.highlightStartSec,
        editPlan.bgmTemplate.highlightDurationSec,
        editPlan.bgmTemplate.energyCurve,
      );
    }
  }, [isPlaying, videoReady, editPlan.bgmTemplate.id, editPlan.pacingBpm, editPlan.bgmTemplate.highlightStartSec, editPlan.bgmTemplate.highlightDurationSec, editPlan.bgmTemplate.energyCurve]);

  const prevBgmIdRef = useRef<string>('');
  useEffect(() => {
    if (!isPlaying) return;
    if (!bgmPlayerRef.current) return;
    if (prevBgmIdRef.current === editPlan.bgmTemplate.id) return;
    prevBgmIdRef.current = editPlan.bgmTemplate.id;
    bgmPlayerRef.current.stop();
    bgmPlayerRef.current.start(
      editPlan.bgmTemplate.id,
      editPlan.pacingBpm,
      editPlan.bgmTemplate.highlightStartSec,
      editPlan.bgmTemplate.highlightDurationSec,
      editPlan.bgmTemplate.energyCurve,
    );
  }, [isPlaying, editPlan.bgmTemplate.id, editPlan.pacingBpm, editPlan.bgmTemplate.highlightStartSec, editPlan.bgmTemplate.highlightDurationSec, editPlan.bgmTemplate.energyCurve]);

  useEffect(() => {
    if (!bgmPlayerRef.current) return;
    bgmPlayerRef.current.setVolume(bgmVolume);
  }, [bgmVolume]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentSec((prev) => {
          const next = prev + TICK_MS / 1000;
          if (next >= TOTAL_DURATION) {
            stop();
            return TOTAL_DURATION;
          }
          return next;
        });
      }, TICK_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, stop]);

  useEffect(() => {
    if (!hasSlideshow || !isPlaying) return;
    const seg = getActiveSegment(editPlan.segments, currentSec);
    if (seg) {
      const { src, index } = getImageForSegment(editPlan.segments, seg, slideshowImages ?? null);
      if (src && src !== displayedImage) {
        setDisplayedImage(src);
        setDisplayedSegIndex(index);
      }
    }
  }, [currentSec, hasSlideshow, isPlaying, editPlan.segments, slideshowImages, displayedImage]);

  useEffect(() => {
    if (!hasSlideshow && slideshowImages && slideshowImages.length > 0) {
      setDisplayedImage(slideshowImages[0]);
    }
  }, [slideshowImages, hasSlideshow]);

  useEffect(() => {
    return () => {
      stop();
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.dispose();
        bgmPlayerRef.current = null;
      }
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    };
  }, [stop]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const existing = document.getElementById('snap-connect-cam-keyframes');
    if (existing) return;
    const style = document.createElement('style');
    style.id = 'snap-connect-cam-keyframes';
    style.textContent = [
      '@keyframes cam_fade_in{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:scale(1.08)}}',
      '@keyframes cam_flash{0%{opacity:0}15%{opacity:1}100%{opacity:1}}',
    ].join('\n');
    document.head.appendChild(style);
  }, []);

  const activeSegment = getActiveSegment(editPlan.segments, currentSec);
  const isDisclosureActive =
    editPlan.disclosureEnabled &&
    currentSec >= editPlan.disclosureOverlay.startSec &&
    currentSec < editPlan.disclosureOverlay.endSec;
  const progressPercent = (currentSec / TOTAL_DURATION) * 100;
  const isBgmActive = currentSec > 0 && currentSec < TOTAL_DURATION;

  const responsiveWidth = Math.min(PREVIEW_FRAME_WIDTH, screenWidth * 0.4);
  const captionStyle: CaptionStyle = useMemo(
    () => getCaptionStyle(luminanceLevel, activeSegment?.position ?? 'center', responsiveWidth),
    [luminanceLevel, activeSegment, responsiveWidth],
  );

  const safeZonePadding = useMemo(
    () => getSafeZonePadding(editPlan.safeZone, editPlan.spec, PREVIEW_FRAME_HEIGHT),
    [editPlan.safeZone, editPlan.spec],
  );

  const segmentPositionStyle: ViewStyle = useMemo(() => {
    if (!activeSegment) return { justifyContent: 'center' };
    if (activeSegment.position === 'top') {
      return { justifyContent: 'flex-start', paddingTop: safeZonePadding.paddingTop };
    }
    if (activeSegment.position === 'bottom') {
      return { justifyContent: 'flex-end', paddingBottom: safeZonePadding.paddingBottom };
    }
    return { justifyContent: 'center' };
  }, [activeSegment, safeZonePadding]);

  const liveTransform = useMemo(
    () => computeStoryTransform(editPlan.segments, currentSec, narrativePlan ?? null),
    [editPlan.segments, currentSec, narrativePlan],
  );

  const videoHtml = useMemo(() => {
    if (!videoSrc) return '';
    const playCmd = isPlaying ? 'play()' : 'pause()';
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;}body{background:#000;overflow:hidden;}video{width:100%;height:100%;object-fit:cover;}</style></head><body><video id="v" src="${videoSrc}" autoplay muted loop playsinline webkit-playsinline onerror="window.ReactNativeWebView.postMessage('video_error')"></video><script>var v=document.getElementById('v');v.${playCmd};v.addEventListener('error',function(){window.ReactNativeWebView.postMessage('video_error');},{once:true});v.addEventListener('canplay',function(){window.ReactNativeWebView.postMessage('video_loaded');},{once:true});v.addEventListener('loadeddata',function(){window.ReactNativeWebView.postMessage('video_loaded');},{once:true});setTimeout(function(){if(v.readyState===0){window.ReactNativeWebView.postMessage('video_error');}},8000);</script></body></html>`;
  }, [videoSrc, isPlaying]);

  const webviewSource = useMemo(() => ({ html: videoHtml }), [videoHtml]);

  const slideImgSrc = hasSlideshow ? displayedImage : null;
  const slideImgKey = `${displayedSegIndex}-${displayedImage?.slice(-20) ?? ''}`;



  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setVideoFallbackMode(true);
  }, []);

  const showCinematicFallback = (videoError || videoFallbackMode || isGeneratingVideo || !hasGeneratedVideo || (hasGeneratedVideo && !videoLoaded) || !videoSrc) && (hasSlideshow || hasImage);
  const cinematicFallbackSrc = showCinematicFallback ? (slideImgSrc || imageUri || null) : null;
  const showVideoLoadingSpinner = hasGeneratedVideo && !videoLoaded && !videoError && !videoFallbackMode;
  const showPlaceholder = (!hasGeneratedVideo || videoError) && !showCinematicFallback && !hasImage;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Play size={13} color={theme.colors.primary[400]} strokeWidth={2.5} />
        <Text style={styles.labelText}>실시간 미리보기 (15초)</Text>
      </View>

      <View style={styles.previewFrame}>
        <View style={styles.videoArea}>
          {/* Cinematic fallback layer — visible BEHIND video while loading */}
          {showCinematicFallback && cinematicFallbackSrc ? (
            Platform.OS === 'web' ? (
              // @ts-ignore web-only img element
              <img
                key={`fallback-${slideImgKey}`}
                src={cinematicFallbackSrc ?? ''}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000',
                  transformOrigin: 'center center',
                  transform: isPlaying ? liveTransform : 'scale(1.05)',
                  transition: isPlaying
                    ? 'transform 0.05s linear'
                    : 'transform 0.4s ease-out',
                  opacity: 1,
                  zIndex: 0,
                }}
              />
            ) : (
              <Image
                source={{ uri: (cinematicFallbackSrc ?? '').startsWith('data:') ? (cinematicFallbackSrc ?? '') : (cinematicFallbackSrc ?? '') }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#000',
                  transform: [{ scale: isPlaying ? 1.15 : 1.05 }],
                  zIndex: 0,
                }}
                resizeMode="cover"
              />
            )
          ) : null}

          {/* Generated video layer — sits on top of fallback, transparent until loaded */}
          {videoReady ? (
            Platform.OS === 'web' ? (
              // @ts-ignore web-only video element
              <video
                ref={webVideoRef}
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onError={handleVideoError}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover' as const,
                  backgroundColor: 'transparent',
                  opacity: videoLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease-out',
                  zIndex: 1,
                }}
              />
            ) : (
              <WebView
                key={videoSrc}
                source={webviewSource}
                style={[styles.webViewFill, { opacity: videoLoaded ? 1 : 0, backgroundColor: 'transparent' }]}
                javaScriptEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                scrollEnabled={false}
                mixedContentMode="always"
                originWhitelist={['*']}
                allowFileAccess
                onMessage={(event) => {
                  if (event.nativeEvent.data === 'video_error') {
                    handleVideoError();
                  } else if (event.nativeEvent.data === 'video_loaded') {
                    setVideoLoaded(true);
                    if (videoTimeoutRef.current) {
                      clearTimeout(videoTimeoutRef.current);
                      videoTimeoutRef.current = null;
                    }
                  }
                }}
                onError={handleVideoError}
              />
            )
          ) : null}

          {/* Loading spinner overlay while video URL is being fetched/loaded */}
          {showVideoLoadingSpinner ? (
            <View style={styles.videoLoadingOverlay} pointerEvents="none">
              <Loader2 size={24} color={theme.colors.primary[400]} strokeWidth={2.5} />
              <Text style={styles.videoLoadingText}>영상 로딩 중...</Text>
            </View>
          ) : null}

          {/* Buffering overlay — video paused for network buffering, BGM also paused */}
          {videoBuffering && !showVideoLoadingSpinner ? (
            <View style={styles.videoLoadingOverlay} pointerEvents="none">
              <Loader2 size={20} color={theme.colors.primary[400]} strokeWidth={2.5} />
              <Text style={styles.videoLoadingText}>버퍼링 중...</Text>
            </View>
          ) : null}

          {/* Placeholder when no video, no fallback image, and no generated video */}
          {showPlaceholder ? (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>영상 없음</Text>
              <Text style={styles.videoPlaceholderHint}>촬영 후 미리보기 가능</Text>
            </View>
          ) : null}

          {activeSegment && !isDisclosureActive && activeSegment.textOverlay.trim().length > 0 && (
            <View style={[styles.captionOverlay, segmentPositionStyle, { paddingHorizontal: safeZonePadding.paddingHorizontal }]}>
              <Text
                style={{
                  fontSize: captionStyle.fontSize,
                  fontFamily: theme.typography.fontFamily.bold,
                  color: captionStyle.color,
                  textAlign: 'center',
                  textShadowColor: captionStyle.textShadowColor,
                  textShadowOffset: captionStyle.textShadowOffset,
                  textShadowRadius: captionStyle.textShadowRadius,
                  lineHeight: captionStyle.lineHeight,
                }}
                numberOfLines={2}
              >
                {activeSegment.textOverlay}
              </Text>
            </View>
          )}

          {isDisclosureActive && (
            <View style={styles.disclosureOverlay}>
              <Text style={styles.disclosureText} numberOfLines={2}>
                {editPlan.disclosureOverlay.text || '광고·협찬 포함'}
              </Text>
            </View>
          )}

          {isBgmActive && (
            <View style={styles.bgmIndicator}>
              <Text style={styles.bgmText} numberOfLines={1}>{editPlan.bgmTemplate.label}</Text>
            </View>
          )}

          {activeSegment && isPlaying && (
            <View style={styles.sceneBadge}>
              <View style={[styles.sceneDot, { backgroundColor: STORY_PHASE_COLORS[activeSegment.storyPhase] }]} />
              <Text style={[styles.sceneBadgeText, { color: STORY_PHASE_COLORS[activeSegment.storyPhase] }]} numberOfLines={1}>
                {STORY_PHASE_LABELS[activeSegment.storyPhase]}
              </Text>
            </View>
          )}

          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{currentSec.toFixed(1)}s / {TOTAL_DURATION}s</Text>
          </View>

          {isGeneratingVideo && videoGenProgress && (
            <View style={styles.videoGenOverlay}>
              <View style={styles.videoGenPulseRing} />
              <Text style={styles.videoGenPhaseText}>
                {videoGenProgress.phase === 'submitting' ? 'AI 비디오 생성 요청 중...' : 'AI가 영상을 생성하고 있어요'}
              </Text>
              <View style={styles.videoGenProgressBar}>
                <View style={[styles.videoGenProgressFill, { width: `${Math.round(videoGenProgress.progress * 100)}%` }]} />
              </View>
              <Text style={styles.videoGenDetailText} numberOfLines={1}>
                {videoGenProgress.message} · {videoGenProgress.elapsedSec}s
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay} activeOpacity={0.8}>
          {isPlaying ? (
            <Pause size={20} color="#fff" strokeWidth={2.5} />
          ) : (
            <Play size={20} color="#fff" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={reset} activeOpacity={0.7}>
          <RotateCcw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={styles.progressBackground} />
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          {editPlan.segments.map((seg) => (
            <View
              key={seg.index}
              style={[styles.segmentMarker, { left: `${(seg.startSec / TOTAL_DURATION) * 100}%` }]}
            />
          ))}
          {editPlan.disclosureEnabled && (
            <View
              style={[styles.segmentMarker, styles.disclosureMarker, { left: `${(editPlan.disclosureOverlay.startSec / TOTAL_DURATION) * 100}%` }]}
            />
          )}
        </View>
      </View>

      <View style={styles.segmentLabels}>
        {editPlan.segments.map((seg) => (
          <View key={seg.index} style={[styles.segmentLabelChip, { flex: seg.endSec - seg.startSec }]}>
            <Text style={styles.segmentLabelText} numberOfLines={1}>{seg.label}</Text>
          </View>
        ))}
        {editPlan.disclosureEnabled ? (
          <View style={[styles.segmentLabelChip, styles.disclosureChip, { flex: editPlan.disclosureOverlay.durationSec }]}>
            <Text style={styles.segmentLabelText} numberOfLines={1}>공정위</Text>
          </View>
        ) : (
          <View style={[styles.segmentLabelChip, styles.extraChip, { flex: editPlan.disclosureOverlay.durationSec }]}>
            <Text style={styles.segmentLabelText} numberOfLines={1}>여유</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[500] + '40',
    padding: 12,
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  previewFrame: {
    alignSelf: 'center',
    width: PREVIEW_FRAME_WIDTH,
    height: PREVIEW_FRAME_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  videoArea: {
    flex: 1,
    position: 'relative',
  },
  webViewFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a14',
    gap: 4,
  },
  videoPlaceholderText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  videoPlaceholderHint: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  captionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
  },
  disclosureOverlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 3,
    alignItems: 'center',
  },
  disclosureText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 11,
  },
  bgmIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bgmText: {
    fontSize: 7,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
    maxWidth: 50,
  },
  sceneBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sceneDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sceneBadgeText: {
    fontSize: 7,
    fontFamily: theme.typography.fontFamily.bold,
  },
  timeBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  timeText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.border,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
    backgroundColor: theme.colors.primary[500],
  },
  segmentMarker: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  disclosureMarker: {
    backgroundColor: theme.colors.warning[500],
  },
  segmentLabels: {
    flexDirection: 'row',
    gap: 2,
  },
  segmentLabelChip: {
    borderRadius: 4,
    backgroundColor: theme.colors.primary[600] + '30',
    paddingHorizontal: 4,
    paddingVertical: 3,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  disclosureChip: {
    backgroundColor: theme.colors.warning[500] + '30',
  },
  extraChip: {
    backgroundColor: theme.colors.dark.border,
  },
  segmentLabelText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textDim,
  },
  videoGenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  videoGenPulseRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary[400],
    marginBottom: 4,
  },
  videoGenPhaseText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
    textAlign: 'center',
  },
  videoGenProgressBar: {
    width: '80%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  videoGenProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: theme.colors.primary[400],
  },
  videoGenDetailText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  videoLoadingText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
});
