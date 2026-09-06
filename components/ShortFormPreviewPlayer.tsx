import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import {
  Play,
  Pause,
  RotateCcw,
  Shield,
  Music,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import type { ShortFormEditPlan, EditSegment } from '@/lib/shortFormEditEngine';

interface ShortFormPreviewPlayerProps {
  editPlan: ShortFormEditPlan;
  videoUri: string | null;
}

const TOTAL_DURATION = 15;
const TICK_MS = 100;

function getActiveSegment(segments: EditSegment[], currentSec: number): EditSegment | null {
  return segments.find((s) => currentSec >= s.startSec && currentSec < s.endSec) ?? null;
}

function getSegmentPositionStyle(position: EditSegment['position']): ViewStyle {
  if (position === 'top') {
    return { justifyContent: 'flex-start', paddingTop: 60 };
  }
  if (position === 'bottom') {
    return { justifyContent: 'flex-end', paddingBottom: 80 };
  }
  return { justifyContent: 'center' };
}

export function ShortFormPreviewPlayer({ editPlan, videoUri }: ShortFormPreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
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
      setIsPlaying(true);
    }
  }, [isPlaying, currentSec, stop]);

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
    return () => stop();
  }, [stop]);

  const activeSegment = getActiveSegment(editPlan.segments, currentSec);
  const isDisclosureActive =
    editPlan.disclosureEnabled &&
    currentSec >= editPlan.disclosureOverlay.startSec &&
    currentSec < editPlan.disclosureOverlay.endSec;
  const progressPercent = (currentSec / TOTAL_DURATION) * 100;
  const isBgmActive = currentSec > 0 && currentSec < TOTAL_DURATION;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Play size={13} color={theme.colors.primary[400]} strokeWidth={2.5} />
        <Text style={styles.labelText}>실시간 미리보기 (15초)</Text>
      </View>

      <View style={styles.previewFrame}>
        <View style={styles.videoArea}>
          {videoUri ? (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>촬영된 영상</Text>
              <Text style={styles.videoPlaceholderHint}>{editPlan.platformLabel} · {editPlan.spec?.ratio ?? '9:16'}</Text>
            </View>
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderText}>영상 없음</Text>
              <Text style={styles.videoPlaceholderHint}>촬영 후 미리보기 가능</Text>
            </View>
          )}

          {activeSegment && !isDisclosureActive && (
            <View style={[styles.captionOverlay, getSegmentPositionStyle(activeSegment.position)]}>
              <View style={styles.captionBadge}>
                <Text style={styles.captionSegmentLabel}>{activeSegment.label}</Text>
              </View>
              <Text
                style={[
                  styles.captionText,
                  activeSegment.position === 'center' && styles.captionTextLarge,
                  activeSegment.position === 'top' && styles.captionTextTop,
                  activeSegment.position === 'bottom' && styles.captionTextBottom,
                ]}
                numberOfLines={2}
              >
                {activeSegment.textOverlay}
              </Text>
            </View>
          )}

          {isDisclosureActive && (
            <View style={styles.disclosureOverlay}>
              <View style={styles.disclosureBadge}>
                <Shield size={10} color="#fff" strokeWidth={2.5} />
                <Text style={styles.disclosureBadgeText}>공정위</Text>
              </View>
              <Text style={styles.disclosureText} numberOfLines={2}>
                {editPlan.disclosureOverlay.text || '광고·협찬 포함'}
              </Text>
            </View>
          )}

          {isBgmActive && (
            <View style={styles.bgmIndicator}>
              <Music size={10} color="#fff" strokeWidth={2.5} />
              <Text style={styles.bgmText} numberOfLines={1}>{editPlan.bgmTemplate.label}</Text>
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
            <Shield size={8} color="#fff" strokeWidth={2.5} />
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
    width: 135,
    height: 240,
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
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  captionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.primary[500] + 'CC',
    marginBottom: 4,
  },
  captionSegmentLabel: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  captionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    lineHeight: 15,
  },
  captionTextLarge: {
    fontSize: 13,
  },
  captionTextTop: {
    fontSize: 10,
  },
  captionTextBottom: {
    fontSize: 10,
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
  disclosureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  disclosureBadgeText: {
    fontSize: 7,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
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
