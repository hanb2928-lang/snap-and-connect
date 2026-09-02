import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  Package,
  Zap,
  Tag,
  TrendingUp,
  RefreshCw,
  CircleCheck as CheckCircle2,
  TriangleAlert as AlertTriangle,
  ChevronRight,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import {
  fetchPosMenuItems,
  syncPosToMarketing,
  getClosingSaleBadge,
  getTodayMenuBadge,
  type PosMenuItem,
} from '@/lib/posIntegration';
import { setItem } from '@/lib/storage';

export function PosIntegrationCard() {
  const [items, setItems] = useState<PosMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchPosMenuItems();
      setItems(data);
      setError(null);
    } catch {
      setError('POS 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleSync = async () => {
    setSyncing(true);
    setSynced(false);
    try {
      const result = await syncPosToMarketing();
      setItems(result.syncedItems);
      if (result.autoPrompt) {
        await setItem('marketing_custom_prompt', result.autoPrompt);
        await setItem('marketing_selected_hook', result.autoHook || '');
      }
      setSynced(true);
      setTimeout(() => setSynced(false), 3000);
    } catch {
      setError('POS 연동에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const closingBadge = getClosingSaleBadge(items);
  const todayBadge = getTodayMenuBadge(items);
  const hasAlerts = closingBadge || todayBadge;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Package size={18} color={theme.colors.accent[400]} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.title}>POS / 재고 연동</Text>
              <Text style={styles.subtitle}>실시간 메뉴·가격·마감 세일 자동 반영</Text>
            </View>
          </View>
          <ActivityIndicator size="small" color={theme.colors.accent[400]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Package size={18} color={theme.colors.accent[400]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>POS / 재고 연동</Text>
            <Text style={styles.subtitle}>실시간 메뉴·가격·마감 세일 자동 반영</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnActive]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.7}
        >
          {syncing ? (
            <RefreshCw size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
          ) : synced ? (
            <CheckCircle2 size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
          ) : (
            <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2.5} />
          )}
          <Text style={[styles.syncBtnText, synced && { color: theme.colors.success[400] }]}>
            {syncing ? '연동 중' : synced ? '연동 완료' : 'POS 연동'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {hasAlerts && (
        <View style={styles.badgeRow}>
          {closingBadge && (
            <View style={[styles.badge, closingBadge.urgent && styles.badgeUrgent]}>
              <AlertTriangle size={11} color={closingBadge.urgent ? theme.colors.error[400] : theme.colors.warning[400]} strokeWidth={2.5} />
              <Text style={[styles.badgeText, { color: closingBadge.urgent ? theme.colors.error[400] : theme.colors.warning[400] }]}>
                {closingBadge.label} {closingBadge.count}건
              </Text>
            </View>
          )}
          {todayBadge && (
            <View style={[styles.badge, styles.badgeToday]}>
              <TrendingUp size={11} color={theme.colors.primary[300]} strokeWidth={2.5} />
              <Text style={[styles.badgeText, { color: theme.colors.primary[300] }]}>
                {todayBadge.label} {todayBadge.count}건
              </Text>
            </View>
          )}
        </View>
      )}

      {!hasAlerts && items.length > 0 && (
        <View style={styles.allGoodRow}>
          <CheckCircle2 size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={styles.allGoodText}>재고 충분 — 마감 세일 알림 없음</Text>
        </View>
      )}

      {items.length === 0 && !error && (
        <Text style={styles.emptyText}>
          아직 등록된 재고가 없습니다. 어셋 탭에서 재고를 추가하면 POS 연동이 활성화됩니다.
        </Text>
      )}

      {items.length > 0 && (
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandBtnText}>
            {expanded ? '메뉴 목록 접기' : '연동된 메뉴 보기'}
          </Text>
          <ChevronRight
            size={14}
            color={theme.colors.dark.textDim}
            strokeWidth={2.5}
            style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>
      )}

      {expanded && items.length > 0 && (
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const isLow = item.is_active && item.quantity <= item.low_stock_threshold;
            const hasDiscount = item.original_price !== null && item.price !== null && item.original_price > item.price;
            return (
              <View key={item.id} style={[styles.menuRow, isLow && styles.menuRowUrgent]}>
                <View style={styles.menuInfo}>
                  <View style={styles.menuNameRow}>
                    {item.is_today_menu && (
                      <View style={styles.todayDot}>
                        <TrendingUp size={9} color="#fff" strokeWidth={2.5} />
                      </View>
                    )}
                    <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
                    {isLow && (
                      <View style={styles.urgentBadge}>
                        <AlertTriangle size={8} color={theme.colors.error[400]} strokeWidth={2.5} />
                        <Text style={styles.urgentBadgeText}>마감</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.menuSpecRow}>
                    <Text style={styles.menuQty}>잔여 {item.quantity}{item.unit}</Text>
                    {item.price !== null && (
                      <Text style={styles.menuPrice}>
                        {hasDiscount && (
                          <Text style={styles.menuPriceOriginal}>
                            {item.original_price!.toLocaleString('ko-KR')}원 →{' '}
                          </Text>
                        )}
                        <Text style={hasDiscount ? styles.menuPriceDiscount : styles.menuPriceNormal}>
                          {item.price.toLocaleString('ko-KR')}원
                        </Text>
                      </Text>
                    )}
                  </View>
                </View>
                {item.auto_shortform && (
                  <View style={styles.autoBadge}>
                    <Zap size={9} color={theme.colors.warning[400]} strokeWidth={2.5} />
                    <Text style={styles.autoBadgeText}>자동</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {synced && (
        <View style={styles.syncedNotice}>
          <CheckCircle2 size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={styles.syncedNoticeText}>
            POS 데이터가 숏폼 제작에 자동 반영되었습니다. 매장 정보와 후킹 문구를 확인하세요.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.accent[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  syncBtnActive: {
    backgroundColor: theme.colors.accent[500] + '15',
  },
  syncBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[500] + '15',
  },
  badgeUrgent: {
    backgroundColor: theme.colors.error[500] + '15',
  },
  badgeToday: {
    backgroundColor: theme.colors.primary[500] + '15',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  allGoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allGoodText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  expandBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  menuList: {
    maxHeight: 240,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    marginBottom: 6,
  },
  menuRowUrgent: {
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
  },
  menuInfo: {
    flex: 1,
    gap: 4,
  },
  menuNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    flex: 1,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.error[500] + '15',
  },
  urgentBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.error[400],
  },
  menuSpecRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuQty: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  menuPrice: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
  },
  menuPriceOriginal: {
    color: theme.colors.dark.textFaint,
    textDecorationLine: 'line-through',
  },
  menuPriceDiscount: {
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.error[400],
  },
  menuPriceNormal: {
    color: theme.colors.dark.textDim,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[500] + '15',
  },
  autoBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  syncedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500] + '10',
  },
  syncedNoticeText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    lineHeight: 15,
  },
});
