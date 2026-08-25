import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Mic, MicOff, Square, Trash2, Zap, ZoomIn, Waves, Bomb, CircleAlert as AlertCircle, Volume2 } from 'lucide-react-native';
import { Platform } from 'react-native';
import { theme } from '@/lib/theme';
import { useSoundPunch, type PunchEffectType, type PunchMarker } from '@/hooks/useSoundPunch';

const EFFECT_META: Record<PunchEffectType, { label: string; icon: typeof Zap; color: string }> = {
  cut: { label: '컷 전환', icon: Zap, color: theme.colors.accent[400] },
  zoom: { label: '줌인', icon: ZoomIn, color: theme.colors.primary[400] },
  shake: { label: '화면 흔들림', icon: Waves, color: theme.colors.warning[400] },
  explosion: { label: '폭발 이펙트', icon: Bomb, color: theme.colors.error[400] },
};

interface SoundPunchEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onMarkersChange: (markers: PunchMarker[]) => void;
  onAudioReady: (dataUrl: string | null) => void;
  style?: ViewStyle;
}

export function SoundPunchEditor({ enabled, onToggle, onMarkersChange, onAudioReady, style }: SoundPunchEditorProps) {
  const punch = useSoundPunch();

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.enableCard, style]}>
        <View style={styles.enableIconWrap}>
          <MicOff size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
        </View>
        <View style={styles.enableTextWrap}>
          <Text style={styles.enableTitle}>소리 펀치 컷 편집</Text>
          <Text style={styles.enableDesc}>웹 브라우저에서만 사용할 수 있어요</Text>
        </View>
      </View>
    );
  }
  const lastMarkersRef = useRef<string>('');
  const lastAudioRef = useRef<string | null>(null);

  useEffect(() => {
    const sig = JSON.stringify(punch.markers);
    if (sig !== lastMarkersRef.current) {
      lastMarkersRef.current = sig;
      onMarkersChange(punch.markers);
    }
  }, [punch.markers, onMarkersChange]);

  useEffect(() => {
    if (!enabled) return;
    if (punch.audioBlob && !punch.isRecording) {
      (async () => {
        const dataUrl = await punch.getAudioDataUrl();
        if (dataUrl && dataUrl !== lastAudioRef.current) {
          lastAudioRef.current = dataUrl;
          onAudioReady(dataUrl);
        }
      })();
    }
  }, [enabled, punch.audioBlob, punch.isRecording, punch.getAudioDataUrl, onAudioReady]);

  if (!enabled) {
    return (
      <TouchableOpacity
        style={[styles.enableCard, style]}
        onPress={() => onToggle(true)}
        activeOpacity={0.7}
      >
        <View style={styles.enableIconWrap}>
          <Mic size={20} color={theme.colors.accent[400]} strokeWidth={2} />
        </View>
        <View style={styles.enableTextWrap}>
          <Text style={styles.enableTitle}>소리 펀치 컷 편집</Text>
          <Text style={styles.enableDesc}>
            마이크에 "펑!", "줌인!", "컷!" 하고 외치거나 박수를 치면 AI가 자동으로 효과를 타임라인에 꽂아요
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const amplitudeBarWidth = Math.min(punch.amplitude * 100, 100);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Mic size={16} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>소리 펀치 컷 편집</Text>
        </View>
        <TouchableOpacity onPress={() => onToggle(false)} activeOpacity={0.7}>
          <MicOff size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        마이크 켜고 소리치거나 말하면 자동으로 효과이 찍혀요. "펑!" = 폭발, "줌!" = 줌인, "컷!" = 전환, "흔들!" = 흔들림
      </Text>

      {punch.error && (
        <View style={styles.errorBox}>
          <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{punch.error}</Text>
        </View>
      )}

      <View style={styles.recordSection}>
        {!punch.isRecording ? (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={punch.startRecording}
            activeOpacity={0.8}
          >
            <Mic size={22} color="#fff" strokeWidth={2} />
            <Text style={styles.recordButtonText}>녹음 시작</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={punch.stopRecording}
            activeOpacity={0.8}
          >
            <Square size={20} color="#fff" strokeWidth={2} fill="#fff" />
            <Text style={styles.stopButtonText}>녹음 중지 ({(punch.duration / 1000).toFixed(1)}s)</Text>
          </TouchableOpacity>
        )}

        {punch.isRecording && (
          <View style={styles.amplitudeWrap}>
            <View style={styles.amplitudeBarBg}>
              <View
                style={[
                  styles.amplitudeBarFill,
                  { width: `${amplitudeBarWidth}%` },
                ]}
              />
            </View>
            <View style={styles.amplitudeDots}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.amplitudeDot,
                    {
                      opacity: punch.amplitude > i * 0.15 ? 1 : 0.2,
                      transform: [{ scale: punch.amplitude > i * 0.15 ? 1 + punch.amplitude * 0.3 : 1 }],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {punch.audioBlob && !punch.isRecording && (
        <View style={styles.audioReadyBox}>
          <Volume2 size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.audioReadyText}>음성 녹음 완료 ({(punch.duration / 1000).toFixed(1)}초) - 만화에 포함됩니다</Text>
        </View>
      )}

      {punch.markers.length > 0 && (
        <View style={styles.markersSection}>
          <View style={styles.markersHeader}>
            <Text style={styles.markersTitle}>찍힌 효과 ({punch.markers.length}개)</Text>
            <Text style={styles.markersHint}>효과 아이콘을 탭하면 변경, X를 탭하면 삭제</Text>
          </View>

          <View style={styles.timelineWrap}>
            <View style={styles.timelineBar}>
              {punch.markers.map((m) => {
                const pos = punch.duration > 0 ? (m.time / punch.duration) * 100 : 0;
                const meta = EFFECT_META[m.effect];
                const Icon = meta.icon;
                return (
                  <View
                    key={m.id}
                    style={[styles.timelineMarker, { left: `${Math.min(pos, 95)}%` }]}
                  >
                    <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.markerList}>
            {punch.markers.map((m) => {
              const meta = EFFECT_META[m.effect];
              const Icon = meta.icon;
              return (
                <View key={m.id} style={styles.markerCard}>
                  <Text style={styles.markerTime}>{(m.time / 1000).toFixed(2)}s</Text>
                  <TouchableOpacity
                    style={styles.markerEffectBtn}
                    onPress={() => {
                      const effects = Object.keys(EFFECT_META) as PunchEffectType[];
                      const nextIdx = (effects.indexOf(m.effect) + 1) % effects.length;
                      punch.updateMarkerEffect(m.id, effects[nextIdx]);
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon size={14} color={meta.color} strokeWidth={2.2} />
                    <Text style={[styles.markerEffectLabel, { color: meta.color }]}>{meta.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.markerDelete}
                    onPress={() => punch.removeMarker(m.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={13} color={theme.colors.dark.textDim} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {punch.isRecording && punch.markers.length === 0 && (
        <Text style={styles.recordingHint}>
          큰 소리를 내거나 박수를 쳐보세요! 효과가 자동으로 찍힙니다
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  enableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.accent[500] + '0D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '25',
  },
  enableIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enableTextWrap: {
    flex: 1,
  },
  enableTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginBottom: 2,
  },
  enableDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  container: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  recordSection: {
    gap: theme.spacing.sm,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
    ...theme.shadows.card,
  },
  recordButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500],
    ...theme.shadows.card,
  },
  stopButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  amplitudeWrap: {
    gap: 6,
  },
  amplitudeBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.border,
    overflow: 'hidden',
  },
  amplitudeBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.accent[400],
  },
  amplitudeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  amplitudeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent[400],
  },
  audioReadyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: theme.spacing.sm,
  },
  audioReadyText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  markersSection: {
    marginTop: theme.spacing.md,
    gap: 8,
  },
  markersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  markersTitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  markersHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  timelineWrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  timelineBar: {
    height: 28,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  timelineMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    alignItems: 'center',
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  markerList: {
    gap: 4,
  },
  markerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markerTime: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    width: 50,
  },
  markerEffectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  markerEffectLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  markerDelete: {
    padding: 4,
  },
  recordingHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
});
