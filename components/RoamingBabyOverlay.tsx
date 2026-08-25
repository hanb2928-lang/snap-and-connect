import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
  withDelay,
} from 'react-native-reanimated';
import { ExternalLink } from 'lucide-react-native';
import { CrawlingBaby } from '@/components/CrawlingBaby';
import { theme } from '@/lib/theme';

interface RoamingBabyOverlayProps {
  linkUrl?: string;
  label?: string;
  containerWidth?: number;
  containerHeight?: number;
  babySize?: number;
  color?: string;
}

export function RoamingBabyOverlay({
  linkUrl,
  label = '구매하기',
  containerWidth = 300,
  containerHeight = 400,
  babySize = 44,
  color = theme.colors.primary[300],
}: RoamingBabyOverlayProps) {
  const posX = useSharedValue(0);
  const posY = useSharedValue(0);
  const dotScale = useSharedValue(1);
  const dotOpacity = useSharedValue(0.7);
  const [tapped, setTapped] = useState(false);

  const padding = 8;
  const stickerWidth = babySize + 52;
  const maxX = Math.max(0, containerWidth - stickerWidth - padding * 2);
  const maxY = Math.max(0, containerHeight - babySize - padding * 2);

  useEffect(() => {
    posX.value = withRepeat(
      withSequence(
        withTiming(maxX * 0.8, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxX * 0.2, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxX * 0.6, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    posY.value = withRepeat(
      withSequence(
        withTiming(maxY * 0.3, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxY * 0.7, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxY * 0.15, { duration: 5500, easing: Easing.inOut(Easing.sin) }),
        withTiming(maxY * 0.5, { duration: 4500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(posX);
      cancelAnimation(posY);
      cancelAnimation(dotScale);
      cancelAnimation(dotOpacity);
    };
  }, [posX, posY, dotScale, dotOpacity, maxX, maxY]);

  const stickerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value + padding },
      { translateY: posY.value + padding },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
    opacity: dotOpacity.value,
  }));

  const handlePress = () => {
    if (!linkUrl) return;
    setTapped(true);
    setTimeout(() => setTapped(false), 2000);
    if (Platform.OS === 'web') {
      window.open(linkUrl, '_blank');
    } else {
      Linking.openURL(linkUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      <Animated.View style={[stickerStyle, styles.stickerWrap]} pointerEvents="auto">
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.touchable}>
          <View style={[styles.babyCircle, tapped && styles.babyCircleTapped]}>
            <CrawlingBaby size={babySize - 12} color={color} crawlWidth={20} speed={1200} />
          </View>
          <View style={styles.linkLabel}>
            <Text style={styles.labelText} numberOfLines={1}>{label}</Text>
            <ExternalLink size={9} color={theme.colors.primary[600]} strokeWidth={2.5} />
          </View>
          <Animated.View style={[styles.pulseDot, dotStyle]} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  stickerWrap: {
    position: 'absolute',
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    ...theme.shadows.card,
  },
  babyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  babyCircleTapped: {
    backgroundColor: theme.colors.success[500] + '25',
  },
  linkLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 4,
  },
  labelText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[700],
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent[400],
    position: 'absolute',
    top: -2,
    right: -2,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
