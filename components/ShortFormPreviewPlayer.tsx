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
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { BgmPlayer } from '@/lib/bgmEngine';
import type { ShortFormEditPlan, EditSegment, StoryPhase } from '@/lib/shortFormEditEngine';
import { getCameraMovementForTime, type CameraMovement } from '@/lib/directingEngine';
import { trajectoryToCameraMovement, type NarrativePlan } from '@/lib/humanRealityNarrativeEngine';
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
}

const TOTAL_DURATION = 15;
const TICK_MS = 50;
const LUMINANCE_SAMPLE_MS = 500;
const PREVIEW_FRAME_WIDTH = 135;
const PREVIEW_FRAME_HEIGHT = 240;

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

export function ShortFormPreviewPlayer({ editPlan, videoUri, imageUri, slideshowImages, narrativePlan }: ShortFormPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [luminanceLevel, setLuminanceLevel] = useState<LuminanceLevel>('dark');
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);
  const [displayedSegIndex, setDisplayedSegIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const luminanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgmPlayerRef = useRef<BgmPlayer | null>(null);

  const { width: screenWidth } = useWindowDimensions();

  const hasImage = !!imageUri;
  const hasSlideshow = !!slideshowImages && slideshowImages.length > 1;

  useEffect(() => {
    if (!videoUri || hasImage || hasSlideshow) {
      setVideoSrc(null);
      return;
    }
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
  }, [videoUri, hasImage, hasSlideshow]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !webVideoRef.current || !videoSrc) return;
    if (isPlaying) {
      webVideoRef.current.play().catch(() => {});
    } else {
      webVideoRef.current.pause();
    }
  }, [isPlaying, videoSrc]);

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
      if (Platform.OS === 'web' && !bgmPlayerRef.current) {
        bgmPlayerRef.current = new BgmPlayer();
      }
      if (bgmPlayerRef.current) {
        bgmPlayerRef.current.start(
          editPlan.bgmTemplate.id,
          editPlan.pacingBpm,
          editPlan.bgmTemplate.highlightStartSec,
          editPlan.bgmTemplate.highlightDurationSec,
          editPlan.bgmTemplate.energyCurve,
        );
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentSec, stop, editPlan.bgmTemplate.id, editPlan.pacingBpm, editPlan.bgmTemplate.highlightStartSec, editPlan.bgmTemplate.highlightDurationSec, editPlan.bgmTemplate.energyCurve]);

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
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;}body{background:#000;overflow:hidden;}video{width:100%;height:100%;object-fit:cover;}</style></head><body><video id="v" src="${videoSrc}" muted loop playsinline webkit-playsinline></video><script>var v=document.getElementById('v');v.${playCmd};</script></body></html>`;
  }, [videoSrc, isPlaying]);

  const webviewSource = useMemo(() => ({ html: videoHtml }), [videoHtml]);

  const slideImgSrc = hasSlideshow ? displayedImage : null;
  const slideImgKey = `${displayedSegIndex}-${displayedImage?.slice(-20) ?? ''}`;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Play size={13} color={theme.colors.primary[400]} strokeWidth={2.5} />
        <Text style={styles.labelText}>실시간 미리보기 (15초)</Text>
      </View>

      <View style={styles.previewFrame}>
        <View style={styles.videoArea}>
          {hasSlideshow && slideImgSrc ? (
            Platform.OS === 'web' ? (
              // @ts-ignore web-only img element
              <img
                key={slideImgKey}
                src={slideImgSrc}
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
                }}
              />
            ) : (
              <Image
                source={{ uri: slideImgSrc.startsWith('data:') ? slideImgSrc : slideImgSrc }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#000',
                  transform: [{ scale: isPlaying ? 1.15 : 1.05 }],
                }}
                resizeMode="cover"
              />
            )
          ) : hasImage && imageUri ? (
            Platform.OS === 'web' ? (
              // @ts-ignore web-only img element
              <img
                src={imageUri}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000',
                  transformOrigin: 'center center',
                  transform: isPlaying ? liveTransform : 'scale(1.0)',
                  transition: isPlaying
                    ? 'transform 0.05s linear'
                    : 'transform 0.3s ease-out',
                }}
              />
            ) : (
              <Image
                source={{ uri: imageUri.startsWith('data:') ? imageUri : imageUri }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#000',
                }}
                resizeMode="cover"
              />
            )
          ) : videoSrc ? (
            Platform.OS === 'web' ? (
              // @ts-ignore web-only video element
              <video
                ref={webVideoRef}
                src={videoSrc}
                loop
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover' as const,
                  backgroundColor: '#000',
                }}
              />
            ) : (
              <WebView
                key={videoSrc}
                source={webviewSource}
                style={styles.webViewFill}
                javaScriptEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                scrollEnabled={false}
                mixedContentMode="always"
                originWhitelist={['*']}
                allowFileAccess
              />
            )
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>영상 없음</Text>
              <Text style={styles.videoPlaceholderHint}>촬영 후 미리보기 가능</Text>
            </View>
          )}

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
});
