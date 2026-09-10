import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Youtube, Music2, Instagram, MonitorPlay, Sparkles, Film, Type, AudioLines, Eye } from 'lucide-react-native';
import { theme } from '@/lib/theme';

export type MiniPreviewPlatform = 'shorts' | 'tiktok' | 'reels' | 'naverclip';

interface MiniPreviewProps {
  platform: MiniPreviewPlatform;
  videoTemplate: string;
  captionFont: string;
  captionPosition: string;
  bgmMood: string;
  hookText: string;
  isRegenerating: boolean;
}

const PLATFORM_META: Record<
  MiniPreviewPlatform,
  { label: string; icon: typeof Youtube; color: string }
> = {
  shorts: { label: 'YouTube Shorts', icon: Youtube, color: '#FF0000' },
  tiktok: { label: 'TikTok', icon: Music2, color: '#FF0050' },
  reels: { label: 'Instagram Reels', icon: Instagram, color: '#E1306C' },
  naverclip: { label: '네이버 클립', icon: MonitorPlay, color: '#03C75A' },
};

const MOOD_GRADIENTS: Record<string, [string, string]> = {
  하이텐션: ['#FF6B9D', '#FF4081'],
  시네마틱: ['#1a1a2e', '#16213e'],
  ASMR: ['#a8dadc', '#457b9d'],
  감성: ['#e8a87c', '#c38d9e'],
  로파이: ['#3d5a80', '#98c1d9'],
  트렌디: ['#5b9bd5', '#4a7ab5'],
};

const FONT_STYLES: Record<string, { fontFamily: string | undefined; fontSize: number; letterSpacing: number }> = {
  '고딕 굵게': { fontFamily: theme.typography.fontFamily.bold, fontSize: 7, letterSpacing: 0 },
  '명조 우아': { fontFamily: theme.typography.fontFamily.regular, fontSize: 7, letterSpacing: 0.5 },
  '손글씨 캐주얼': { fontFamily: theme.typography.fontFamily.regular, fontSize: 7, letterSpacing: -0.3 },
  '미니멀 얇게': { fontFamily: theme.typography.fontFamily.regular, fontSize: 6, letterSpacing: 1 },
  '스포츠 강조': { fontFamily: theme.typography.fontFamily.bold, fontSize: 8, letterSpacing: -0.5 },
};

const POSITION_LAYOUT: Record<string, { justifyContent: 'flex-start' | 'center' | 'flex-end'; paddingTop: number }> = {
  '하단 고정': { justifyContent: 'flex-end', paddingTop: 0 },
  '상단 고정': { justifyContent: 'flex-start', paddingTop: 6 },
  중앙: { justifyContent: 'center', paddingTop: 0 },
  '하단 + 상단 번갈': { justifyContent: 'flex-end', paddingTop: 0 },
  '좌측 세로': { justifyContent: 'flex-end', paddingTop: 0 },
};

export function MiniPreview({
  platform,
  videoTemplate,
  captionFont,
  captionPosition,
  bgmMood,
  hookText,
  isRegenerating,
}: MiniPreviewProps) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;
  const gradient = MOOD_GRADIENTS[bgmMood] ?? MOOD_GRADIENTS['트렌디'];
  const fontStyle = FONT_STYLES[captionFont] ?? FONT_STYLES['고딕 굵게'];
  const posLayout = POSITION_LAYOUT[captionPosition] ?? POSITION_LAYOUT['하단 고정'];

  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (isRegenerating) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      spin.value = withRepeat(
        withTiming(360, { duration: 1500, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      cancelAnimation(glow);
      cancelAnimation(spin);
      pulse.value = withTiming(1, { duration: 300 });
      glow.value = withDelay(400, withTiming(0, { duration: 400 }));
      spin.value = 0;
    }
  }, [isRegenerating, pulse, glow, spin]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Eye size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={styles.headerLabel}>실시간 미니 프리뷰</Text>
        </View>
        <View style={[styles.platformBadge, { backgroundColor: meta.color + '20' }]}>
          <Icon size={10} color={meta.color} strokeWidth={2} />
          <Text style={[styles.platformBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.previewRow}>
        {/* 9:16 mini preview card */}
        <Animated.View style={[styles.previewCard, pulseStyle]}>
          {/* Mood gradient background */}
          <View style={[styles.previewBg, { backgroundColor: gradient[0] }]}>
            {/* Platform color top bar */}
            <View style={[styles.previewPlatformBar, { backgroundColor: meta.color }]} />

            {/* Hook text preview */}
            <View style={[styles.previewCaptionArea, { justifyContent: posLayout.justifyContent, paddingTop: posLayout.paddingTop }]}>
              {hookText ? (
                <Text
                  style={[
                    styles.previewCaptionText,
                    {
                      fontFamily: fontStyle.fontFamily,
                      fontSize: fontStyle.fontSize,
                      letterSpacing: fontStyle.letterSpacing,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {hookText}
                </Text>
              ) : (
                <Text style={styles.previewPlaceholder}>후킹 멘트</Text>
              )}
            </View>

            {/* Bottom info bar */}
            <View style={styles.previewBottomBar}>
              <View style={[styles.previewTag, { backgroundColor: meta.color + '40' }]}>
                <Text style={styles.previewTagText} numberOfLines={1}>{videoTemplate}</Text>
              </View>
            </View>
          </View>

          {/* Pulse glow overlay */}
          <Animated.View style={[styles.glowOverlay, glowStyle]} pointerEvents="none">
            <View style={[styles.glowBorder, { borderColor: meta.color }]} />
          </Animated.View>
        </Animated.View>

        {/* Style summary */}
        <View style={styles.summaryColumn}>
          <StyleRow icon={<Film size={10} color={theme.colors.accent[300]} strokeWidth={2} />} label="템플릿" value={videoTemplate} />
          <StyleRow icon={<Type size={10} color={theme.colors.accent[300]} strokeWidth={2} />} label="자막" value={`${captionFont} · ${captionPosition}`} />
          <StyleRow icon={<AudioLines size={10} color={theme.colors.accent[300]} strokeWidth={2} />} label="BGM" value={bgmMood} />
          {isRegenerating && (
            <View style={styles.regeneratingRow}>
              <Animated.View style={spinStyle}>
                <Sparkles size={10} color={meta.color} strokeWidth={2} />
              </Animated.View>
              <Text style={[styles.regeneratingText, { color: meta.color }]}>
                선택된 플랫폼과 스타일로 비주얼을 재구성하는 중...
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function StyleRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.styleRow}>
      {icon}
      <Text style={styles.styleRowLabel}>{label}</Text>
      <Text style={styles.styleRowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  platformBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewCard: {
    width: 72,
    height: 128,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.dark.border,
    position: 'relative',
  },
  previewBg: {
    flex: 1,
    position: 'relative',
  },
  previewPlatformBar: {
    height: 3,
    width: '100%',
  },
  previewCaptionArea: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'center',
  },
  previewCaptionText: {
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  previewPlaceholder: {
    fontSize: 6,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: theme.typography.fontFamily.regular,
  },
  previewBottomBar: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  previewTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  previewTagText: {
    fontSize: 5,
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  glowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    pointerEvents: 'none',
  },
  glowBorder: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 2,
  },
  summaryColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  styleRowLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    width: 28,
  },
  styleRowValue: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    flexShrink: 1,
  },
  regeneratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  regeneratingText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    flexShrink: 1,
  },
});
