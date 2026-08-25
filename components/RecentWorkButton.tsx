import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Clock, X, ChevronRight, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { getItem, setItem } from '@/lib/storage';

type RecentScan = {
  id: string;
  image_url: string;
  product_name: string | null;
  title: string | null;
  created_at: string;
};

const { height: screenHeight } = Dimensions.get('window');

export function RecentWorkButton() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [scans, setScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRecent, setHasRecent] = useState(false);

  const sheetAnim = useSharedValue(0);
  const backdropAnim = useSharedValue(0);
  const badgeAnim = useSharedValue(0);

  const checkRecent = useCallback(async () => {
    const seen = await getItem('recent_work_seen');
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('id,image_url,product_name,title,created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasRecent(true);
        if (!seen) {
          badgeAnim.value = withSpring(1, { damping: 12, stiffness: 150 });
        }
      }
    } catch {
      // ignore
    }
  }, [badgeAnim]);

  useEffect(() => {
    checkRecent();
  }, [checkRecent]);

  const openSheet = useCallback(async () => {
    setVisible(true);
    setItem('recent_work_seen', 'true');
    badgeAnim.value = withTiming(0, { duration: 200 });
    backdropAnim.value = withTiming(1, { duration: 250 });
    sheetAnim.value = withTiming(1, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('id,image_url,product_name,title,created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setScans(data as RecentScan[]);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [backdropAnim, sheetAnim, badgeAnim]);

  const closeSheet = useCallback(() => {
    sheetAnim.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    });
    backdropAnim.value = withTiming(0, { duration: 250 });
    setTimeout(() => setVisible(false), 300);
  }, [sheetAnim, backdropAnim]);

  const handleItemPress = useCallback(
    (id: string) => {
      closeSheet();
      setTimeout(() => {
        router.push({ pathname: '/result/[id]', params: { id } });
      }, 200);
    },
    [closeSheet, router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setScans((prev) => prev.filter((s) => s.id !== id));
      try {
        await supabase.from('scans').delete().eq('id', id);
      } catch {
        // ignore
      }
    },
    [],
  );

  const formatDate = useCallback((iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetAnim.value) * (screenHeight * 0.5) }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropAnim.value,
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeAnim.value,
    transform: [{ scale: badgeAnim.value }],
  }));

  if (!hasRecent) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={openSheet}
        activeOpacity={0.7}
      >
        <Clock size={20} color={theme.colors.dark.text} strokeWidth={2} />
        <Animated.View style={[styles.badge, badgeStyle]} pointerEvents="none" />
      </TouchableOpacity>

      {visible && (
        <>
          <Pressable style={styles.backdrop} onPress={closeSheet}>
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}
            />
          </Pressable>

          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Clock size={18} color={theme.colors.primary[300]} strokeWidth={2} />
                <Text style={styles.sheetTitle}>최근 제작함</Text>
              </View>
              <TouchableOpacity onPress={closeSheet} activeOpacity={0.7} style={styles.closeBtn}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyText}>불러오는 중...</Text>
              </View>
            ) : scans.length === 0 ? (
              <View style={styles.sheetEmpty}>
                <Text style={styles.sheetEmptyText}>제작한 콘텐츠가 없습니다</Text>
                <Text style={styles.sheetEmptySubtext}>사진을 찍으면 여기에 표시됩니다</Text>
              </View>
            ) : (
              <FlatList
                data={scans}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.recentItem}
                    activeOpacity={0.7}
                    onPress={() => handleItemPress(item.id)}
                  >
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.recentThumb}
                    />
                    <View style={styles.recentBody}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {item.product_name || item.title || '제품 스캔'}
                      </Text>
                      <Text style={styles.recentDate}>{formatDate(item.created_at)}</Text>
                    </View>
                    <View style={styles.recentActions}>
                      <TouchableOpacity
                        style={styles.recentDelete}
                        onPress={() => handleDelete(item.id)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={15} color={theme.colors.dark.textFaint} strokeWidth={2} />
                      </TouchableOpacity>
                      <ChevronRight size={18} color={theme.colors.dark.textFaint} strokeWidth={2} />
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                contentContainerStyle={{ paddingHorizontal: 0 }}
              />
            )}
          </Animated.View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    top: 120,
    right: theme.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent[400],
    borderWidth: 2,
    borderColor: theme.colors.dark.bg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: screenHeight * 0.5,
    backgroundColor: theme.colors.dark.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    zIndex: 51,
    ...theme.shadows.elevated,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.dark.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  sheetEmptyText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  sheetEmptySubtext: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm + 2,
    gap: theme.spacing.md,
  },
  recentThumb: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    resizeMode: 'cover',
  },
  recentBody: {
    flex: 1,
    gap: 4,
  },
  recentTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  recentDate: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  recentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  recentDelete: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.dark.border + '60',
    marginVertical: 2,
  },
});
