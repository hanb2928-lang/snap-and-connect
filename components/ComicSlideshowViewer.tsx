import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ViewStyle,
} from 'react-native';
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Volume2, VolumeX } from 'lucide-react-native';
import { theme } from '@/lib/theme';

export interface SlideshowPanel {
  imageUri: string;
  speech: string;
  sfx: string;
  emotion: string;
  episodeLabel?: string;
}

interface ComicSlideshowViewerProps {
  panels: SlideshowPanel[];
  audioDataUrl?: string | null;
  durationPerPanel: number;
  maxHeight?: number;
  onReplay?: () => void;
}

export function ComicSlideshowViewer({
  panels,
  audioDataUrl,
  durationPerPanel,
  maxHeight = 380,
  onReplay,
}: ComicSlideshowViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showCaption, setShowCaption] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const totalPanels = panels.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const playAudio = useCallback(() => {
    if (!audioDataUrl || Platform.OS !== 'web') return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (!muted) {
      try {
        const audio = new Audio(audioDataUrl);
        audio.play().catch((e) => console.warn('[ComicSlideshowViewer] audio play failed', e));
        audioRef.current = audio;
      } catch (e) {
        console.warn('[ComicSlideshowViewer] audio creation failed', e);
      }
    }
  }, [audioDataUrl, muted]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    clearTimer();
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= totalPanels) {
        setIsPlaying(false);
        stopAudio();
        return prev;
      }
      return next;
    });
  }, [clearTimer, totalPanels, stopAudio]);

  const goBack = useCallback(() => {
    clearTimer();
    setCurrentIndex((prev) => {
      const next = Math.max(0, prev - 1);
      return next;
    });
  }, [clearTimer]);

  const replay = useCallback(() => {
    clearTimer();
    stopAudio();
    setCurrentIndex(0);
    setIsPlaying(true);
    if (onReplay) onReplay();
  }, [clearTimer, stopAudio, onReplay]);

  const togglePlay = useCallback(() => {
    if (currentIndex >= totalPanels - 1 && !isPlaying) {
      replay();
      return;
    }
    setIsPlaying((prev) => {
      if (!prev) {
        return true;
      }
      return false;
    });
  }, [currentIndex, totalPanels, isPlaying, replay]);

  useEffect(() => {
    if (!isPlaying) return;
    if (currentIndex >= totalPanels - 1) {
      setIsPlaying(false);
      stopAudio();
      return;
    }
    const panelDelay = durationPerPanel / totalPanels;
    timerRef.current = setTimeout(advance, panelDelay);
    return () => clearTimer();
  }, [isPlaying, currentIndex, totalPanels, durationPerPanel, advance, clearTimer, stopAudio]);

  useEffect(() => {
    if (isPlaying && currentIndex === 0) {
      playAudio();
    }
  }, [isPlaying, currentIndex, playAudio]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearTimer();
        stopAudio();
        setIsPlaying(false);
      }
    };
    if (Platform.OS === 'web') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
    return () => {
      clearTimer();
      stopAudio();
      if (Platform.OS === 'web') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [clearTimer, stopAudio]);

  useEffect(() => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const nextIdx = currentIndex + 1;
    if (nextIdx >= totalPanels) return;
    const nextUri = panels[nextIdx]?.imageUri;
    if (nextUri && nextUri.length > 20) {
      const img = new window.Image();
      img.src = nextUri;
    }
  }, [currentIndex, totalPanels, panels]);

  if (totalPanels === 0) {
    console.warn('[ComicSlideshowViewer] rendered with 0 panels');
    return null;
  }

  const panel = panels[currentIndex];
  if (!panel) {
    console.warn(`[ComicSlideshowViewer] panel at index ${currentIndex} is undefined (total: ${totalPanels})`);
    return null;
  }
  const isValidImageUri = panel.imageUri && panel.imageUri.length > 20;
  const isLastPanel = currentIndex >= totalPanels - 1;
  const progressPercent = ((currentIndex + 1) / totalPanels) * 100;

  return (
    <View style={[styles.container, { maxHeight }]}>
      <View style={styles.stage}>
        {isValidImageUri ? (
          <Image
            source={{ uri: panel.imageUri }}
            style={styles.panelImage}
            resizeMode="cover"
            accessibilityLabel={`만화 ${currentIndex + 1}번째 컷`}
          />
        ) : (
          <View style={styles.panelImagePlaceholder}>
            <View style={styles.placeholderGradientLayer} pointerEvents="none" />
            <View style={styles.placeholderInner}>
              {panel.emotion ? (
                <Text style={styles.placeholderEmotion}>{panel.emotion}</Text>
              ) : null}
              {panel.speech ? (
                <Text style={styles.placeholderSpeech}>{panel.speech}</Text>
              ) : null}
            </View>
          </View>
        )}
        <View style={styles.gradientOverlay} pointerEvents="none" />

        {panel.episodeLabel && (
          <View style={styles.episodeBadge}>
            <Text style={styles.episodeBadgeText}>{panel.episodeLabel}</Text>
          </View>
        )}

        {showCaption && (panel.speech || panel.sfx) && (
          <View style={styles.captionContainer} pointerEvents="none">
            {panel.sfx && (
              <View style={styles.sfxBubble}>
                <Text style={styles.sfxText}>{panel.sfx}</Text>
              </View>
            )}
            {panel.speech && (
              <View style={styles.speechBubble}>
                <Text style={styles.speechText}>{panel.speech}</Text>
              </View>
            )}
          </View>
        )}

        {panel.emotion && showCaption && (
          <View style={styles.emotionBadge}>
            <Text style={styles.emotionText}>{panel.emotion}</Text>
          </View>
        )}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={goBack}
          disabled={currentIndex === 0}
          activeOpacity={0.7}
        >
          <SkipBack
            size={18}
            color={currentIndex === 0 ? theme.colors.dark.border : theme.colors.dark.text}
            strokeWidth={2}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playBtn}
          onPress={togglePlay}
          activeOpacity={0.7}
        >
          {isPlaying && !isLastPanel ? (
            <Pause size={22} color="#fff" strokeWidth={2} />
          ) : isLastPanel && !isPlaying ? (
            <RotateCcw size={22} color="#fff" strokeWidth={2} />
          ) : (
            <Play size={22} color="#fff" strokeWidth={2} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={advance}
          disabled={isLastPanel}
          activeOpacity={0.7}
        >
          <SkipForward
            size={18}
            color={isLastPanel ? theme.colors.dark.border : theme.colors.dark.text}
            strokeWidth={2}
          />
        </TouchableOpacity>

        <View style={styles.controlSpacer} />

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setMuted(!muted)}
          activeOpacity={0.7}
        >
          {muted ? (
            <VolumeX size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          ) : (
            <Volume2 size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setShowCaption(!showCaption)}
          activeOpacity={0.7}
        >
          <Text style={styles.captionToggleText}>
            {showCaption ? '대사 숨기기' : '대사 보기'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panelDots}>
        {panels.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  stage: {
    position: 'relative',
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 380,
    backgroundColor: '#0a0f1e',
  },
  panelImage: {
    width: '100%',
    height: '100%',
  },
  panelImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  placeholderGradientLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: Platform.OS === 'web'
      ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 40%, #1a1a2e 100%)'
      : undefined,
  } as ViewStyle,
  placeholderInner: {
    alignItems: 'center',
    gap: 16,
    zIndex: 1,
  },
  placeholderEmotion: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  placeholderSpeech: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 26,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    backgroundImage: Platform.OS === 'web'
      ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.5) 100%)'
      : undefined,
  } as ViewStyle,
  episodeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(10, 16, 24, 0.86)',
  },
  episodeBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[300],
  },
  captionContainer: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    gap: 8,
  },
  sfxBubble: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 214, 0, 0.92)',
    transform: [{ rotate: '-4deg' }],
  },
  sfxText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#1a1a2e',
  },
  speechBubble: {
    alignSelf: 'center',
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 2,
    borderColor: theme.colors.accent[400],
  },
  speechText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#1a1a2e',
    textAlign: 'center',
    lineHeight: 20,
  },
  emotionBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(10, 16, 24, 0.86)',
  },
  emotionText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  progressTrack: {
    height: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.accent[500],
    transition: 'width 0.3s ease',
  } as ViewStyle,
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  controlBtn: {
    padding: 6,
    borderRadius: 6,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent[500],
  },
  controlSpacer: {
    flex: 1,
  },
  captionToggleText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  panelDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.border,
  },
  dotActive: {
    backgroundColor: theme.colors.accent[400],
    width: 16,
  },
});
