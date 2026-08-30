import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Package, Bell, Plus, X, Trash2, TriangleAlert as AlertTriangle, Clock, Timer, ChevronRight, Zap, CircleCheck as CheckCircle2 } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  fetchAllAlerts,
  markAlertRead,
  markAlertActedOn,
  createPushAlert,
  getAlertSettings,
  updateAlertSettings,
  checkInventoryAlerts,
  isInBreaktime,
  isClosingSoon,
  buildLowStockAlert,
  buildBreaktimeAlert,
  buildClosingSoonAlert,
  type InventoryItem,
  type PushAlert,
  type InventoryAlertSettings,
} from '@/lib/reviewAutomation';
import { getItem, setItem } from '@/lib/storage';

const ALERT_ICON_MAP: Record<string, typeof AlertTriangle> = {
  low_stock: AlertTriangle,
  breaktime: Timer,
  closing_soon: Clock,
  custom: Bell,
};

const ALERT_COLOR_MAP: Record<string, string> = {
  low_stock: theme.colors.error[400],
  breaktime: theme.colors.accent[400],
  closing_soon: theme.colors.warning[400],
  custom: theme.colors.primary[400],
};

export function InventoryAlertAgent() {
  const router = useRouter();
  const [settings, setSettings] = useState<InventoryAlertSettings | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<PushAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('개');
  const [newItemThreshold, setNewItemThreshold] = useState('3');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAlertCheckRef = useRef(0);
  const alertsRef = useRef<PushAlert[]>([]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const loadAll = useCallback(async () => {
    try {
      const [itemsData, alertsData, settingsData] = await Promise.all([
        fetchInventoryItems(),
        fetchAllAlerts(20),
        getAlertSettings(),
      ]);
      setItems(itemsData);
      setAlerts(alertsData);
      setSettings(settingsData);
      setError(null);
    } catch {
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Periodic alert trigger check — runs every 60 seconds when enabled
  useEffect(() => {
    if (!settings?.enabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkAndTrigger = async () => {
      const now = new Date();
      const nowMs = now.getTime();
      // Throttle: don't check more than once per 30 seconds
      if (nowMs - lastAlertCheckRef.current < 30000) return;
      lastAlertCheckRef.current = nowMs;

      try {
        const currentItems = await fetchInventoryItems();
        setItems(currentItems);

        // 1. Low stock alerts
        const lowStockItems = checkInventoryAlerts(currentItems);
        for (const item of lowStockItems) {
          // Check if we already have an unread alert for this item
          const existing = alertsRef.current.find(
            (a) => a.alert_type === 'low_stock' &&
            a.inventory_item_id === item.id &&
            !a.is_read,
          );
          if (!existing) {
            const alertData = buildLowStockAlert(item);
            const created = await createPushAlert(alertData);
            if (created) setAlerts((prev) => [created, ...prev]);
          }
        }

        // 2. Breaktime alert (once per breaktime window)
        if (isInBreaktime(now, settings.breaktime_start, settings.breaktime_end)) {
          const existingBreaktime = alertsRef.current.find(
            (a) => a.alert_type === 'breaktime' &&
            !a.is_read &&
            new Date(a.triggered_at).toDateString() === now.toDateString(),
          );
          if (!existingBreaktime) {
            const alertData = buildBreaktimeAlert(settings);
            const created = await createPushAlert(alertData);
            if (created) setAlerts((prev) => [created, ...prev]);
          }
        }

        // 3. Closing soon alert (once per day)
        if (isClosingSoon(now, settings.closing_hour, settings.closing_alert_minutes)) {
          const existingClosing = alertsRef.current.find(
            (a) => a.alert_type === 'closing_soon' &&
            !a.is_read &&
            new Date(a.triggered_at).toDateString() === now.toDateString(),
          );
          if (!existingClosing) {
            const alertData = buildClosingSoonAlert(settings);
            const created = await createPushAlert(alertData);
            if (created) setAlerts((prev) => [created, ...prev]);
          }
        }
      } catch {}
    };

    checkAndTrigger();
    checkIntervalRef.current = setInterval(checkAndTrigger, 60000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [settings]);

  const handleToggleEnabled = async (enabled: boolean) => {
    setSettings((prev) => {
      if (!prev) {
        return {
          id: 1,
          enabled,
          breaktime_start: '15:00',
          breaktime_end: '17:00',
          closing_hour: 21,
          closing_alert_minutes: 60,
          updated_at: new Date().toISOString(),
        };
      }
      return { ...prev, enabled };
    });
    try {
      await updateAlertSettings({ enabled });
    } catch {
      setSettings((prev) => (prev ? { ...prev, enabled: !enabled } : prev));
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const item = await createInventoryItem({
        name: newItemName.trim(),
        quantity: parseInt(newItemQty || '0', 10),
        unit: newItemUnit.trim() || '개',
        low_stock_threshold: parseInt(newItemThreshold || '3', 10),
        category: newItemCategory.trim() || null,
      });
      if (item) {
        setItems((prev) => [item, ...prev]);
        setShowAddItemModal(false);
        setNewItemName('');
        setNewItemQty('');
        setNewItemUnit('개');
        setNewItemThreshold('3');
        setNewItemCategory('');
      }
    } catch {
      setError('재고 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQty = async (id: string, delta: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: newQty } : i)),
    );
    try {
      await updateInventoryItem(id, { quantity: newQty });
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity: item.quantity } : i)),
      );
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteInventoryItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError('재고 삭제에 실패했습니다.');
    }
  };

  const handleAlertTap = async (alert: PushAlert) => {
    await markAlertRead(alert.id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_read: true, read_at: new Date().toISOString() } : a)),
    );
  };

  const handleAlertAction = async (alert: PushAlert) => {
    await markAlertActedOn(alert.id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_acted_on: true, is_read: true } : a)),
    );
    // Pre-fill marketing.tsx with the alert's hook + prompt
    if (alert.prompt_text) {
      await setItem('marketing_voice_command_prompt', alert.prompt_text);
      await setItem('marketing_voice_command_intent', alert.alert_type === 'low_stock' ? 'closing' : 'discount');
      await setItem('marketing_voice_command_active', 'true');
      router.push('/(tabs)/marketing' as never);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await updateAlertSettings({
        breaktime_start: settings.breaktime_start,
        breaktime_end: settings.breaktime_end,
        closing_hour: settings.closing_hour,
        closing_alert_minutes: settings.closing_alert_minutes,
      });
      setShowSettingsModal(false);
    } catch {
      setError('설정 저장에 실패했습니다.');
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;
  const lowStockCount = items.filter((i) => i.is_active && i.quantity <= i.low_stock_threshold).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Bell size={20} color={theme.colors.error[400]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>재고·시간 반응형 마케팅 자동 경보</Text>
            <Text style={styles.subtitle}>재고 부족·브레이크타임·마감 전 자동 푸시</Text>
          </View>
        </View>
        <Switch
          value={settings?.enabled ?? false}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: theme.colors.dark.border, true: theme.colors.success[500] }}
          thumbColor="#fff"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary[400]} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {/* Alert summary */}
          {unreadCount > 0 && (
            <View style={styles.alertBanner}>
              <View style={styles.alertBannerLeft}>
                <View style={styles.alertPulse} />
                <Text style={styles.alertBannerText}>
                  {unreadCount}건의 미확인 알림 {lowStockCount > 0 && `· 재고 부족 ${lowStockCount}건`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.alertBannerBtn}
                onPress={() => {
                  const first = alerts.find((a) => !a.is_read);
                  if (first) handleAlertAction(first);
                }}
                activeOpacity={0.7}
              >
                <Zap size={13} color="#fff" strokeWidth={2.5} />
                <Text style={styles.alertBannerBtnText}>지금 발송</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Push Alerts List */}
          {alerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>최근 알림</Text>
              <ScrollView
                style={styles.alertList}
                contentContainerStyle={styles.alertListContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      loadAll();
                    }}
                    tintColor={theme.colors.primary[400]}
                  />
                }
              >
                {alerts.slice(0, 10).map((alert) => {
                  const Icon = ALERT_ICON_MAP[alert.alert_type] || Bell;
                  const color = ALERT_COLOR_MAP[alert.alert_type] || theme.colors.primary[400];
                  return (
                    <View
                      key={alert.id}
                      style={[styles.alertCard, !alert.is_read && styles.alertCardUnread]}
                    >
                      <View style={[styles.alertIconWrap, { backgroundColor: color + '18' }]}>
                        <Icon size={16} color={color} strokeWidth={2.5} />
                      </View>
                      <View style={styles.alertBody}>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                        <Text style={styles.alertText} numberOfLines={2}>{alert.body}</Text>
                        <View style={styles.alertActions}>
                          <TouchableOpacity
                            style={[styles.alertActionBtn, { backgroundColor: color + '18' }]}
                            onPress={() => handleAlertAction(alert)}
                            activeOpacity={0.7}
                          >
                            <Zap size={12} color={color} strokeWidth={2.5} />
                            <Text style={[styles.alertActionText, { color }]}>숏폼 발송하기</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.alertDismissBtn}
                            onPress={() => handleAlertTap(alert)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.alertDismissText}>확인</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Inventory Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>재고 현황</Text>
              <View style={styles.sectionHeaderRight}>
                <TouchableOpacity
                  style={styles.settingsBtn}
                  onPress={() => setShowSettingsModal(true)}
                  activeOpacity={0.7}
                >
                  <Clock size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setShowAddItemModal(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.addBtnText}>재고 추가</Text>
                </TouchableOpacity>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={32} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>재고를 등록해보세요</Text>
                <Text style={styles.emptyDesc}>
                  재고 수량이 기준치 이하로 떨어지면 자동으로 마감 떨이 숏폼 발송 알림이 와요
                </Text>
              </View>
            ) : (
              <View style={styles.inventoryList}>
                {items.map((item) => {
                  const isLow = item.is_active && item.quantity <= item.low_stock_threshold;
                  return (
                    <View key={item.id} style={styles.inventoryRow}>
                      <View style={styles.inventoryInfo}>
                        <View style={styles.inventoryNameRow}>
                          <Text style={styles.inventoryName}>{item.name}</Text>
                          {isLow && (
                            <View style={styles.lowStockBadge}>
                              <AlertTriangle size={9} color={theme.colors.error[400]} strokeWidth={2.5} />
                              <Text style={styles.lowStockText}>부족</Text>
                            </View>
                          )}
                        </View>
                        {item.category && (
                          <Text style={styles.inventoryCategory}>{item.category}</Text>
                        )}
                      </View>
                      <View style={styles.inventoryQtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQty(item.id, -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.inventoryQty, isLow && { color: theme.colors.error[400] }]}>
                          {item.quantity}{item.unit}
                        </Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() => handleUpdateQty(item.id, 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        style={styles.inventoryDeleteBtn}
                        onPress={() => handleDeleteItem(item.id)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={14} color={theme.colors.dark.textFaint} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddItemModal} transparent animationType="fade" onRequestClose={() => setShowAddItemModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>재고 추가</Text>
              <TouchableOpacity onPress={() => setShowAddItemModal(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>품목명 *</Text>
              <TextInput
                style={styles.textInput}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="예: 활어, 항정살, 명란"
                placeholderTextColor={theme.colors.dark.textFaint}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>수량</Text>
                <TextInput
                  style={styles.textInput}
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  placeholder="0"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>단위</Text>
                <TextInput
                  style={styles.textInput}
                  value={newItemUnit}
                  onChangeText={setNewItemUnit}
                  placeholder="개"
                  placeholderTextColor={theme.colors.dark.textFaint}
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>알림 기준</Text>
                <TextInput
                  style={styles.textInput}
                  value={newItemThreshold}
                  onChangeText={setNewItemThreshold}
                  placeholder="3"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>카테고리</Text>
                <TextInput
                  style={styles.textInput}
                  value={newItemCategory}
                  onChangeText={setNewItemCategory}
                  placeholder="식재료"
                  placeholderTextColor={theme.colors.dark.textFaint}
                />
              </View>
            </View>

            <Text style={styles.helpText}>
              수량이 알림 기준 이하로 떨어지면 자동으로 "마감 떨이 숏폼 발송하기" 알림이 발송됩니다
            </Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, !newItemName.trim() && styles.submitBtnDisabled]}
              onPress={handleAddItem}
              disabled={!newItemName.trim() || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>재고 등록</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>자동 경보 설정</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {settings && (
              <>
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>브레이크타임 시작</Text>
                    <TextInput
                      style={styles.textInput}
                      value={settings.breaktime_start}
                      onChangeText={(v) => setSettings({ ...settings, breaktime_start: v })}
                      placeholder="15:00"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>브레이크타임 종료</Text>
                    <TextInput
                      style={styles.textInput}
                      value={settings.breaktime_end}
                      onChangeText={(v) => setSettings({ ...settings, breaktime_end: v })}
                      placeholder="17:00"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>마감 시간 (24h)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(settings.closing_hour)}
                      onChangeText={(v) => setSettings({ ...settings, closing_hour: parseInt(v || '21', 10) })}
                      placeholder="21"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>마감 알림 (분 전)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={String(settings.closing_alert_minutes)}
                      onChangeText={(v) => setSettings({ ...settings, closing_alert_minutes: parseInt(v || '60', 10) })}
                      placeholder="60"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleSaveSettings} activeOpacity={0.7}>
                  <Text style={styles.submitBtnText}>설정 저장</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  loader: {
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    paddingVertical: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
  },
  alertBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  alertPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error[400],
  },
  alertBannerText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  alertBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.error[500],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  alertBannerBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  section: {
    marginTop: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: '#fff',
  },
  alertList: {
    maxHeight: 280,
  },
  alertListContent: {
    gap: 8,
  },
  alertCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  alertCardUnread: {
    borderWidth: 1,
    borderColor: theme.colors.primary[500] + '30',
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBody: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  alertText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  alertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertActionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
  },
  alertDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertDismissText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  emptyDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
    lineHeight: 16,
  },
  inventoryList: {
    gap: 8,
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inventoryInfo: {
    flex: 1,
  },
  inventoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inventoryName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowStockText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  inventoryCategory: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  inventoryQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  inventoryQty: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    minWidth: 50,
    textAlign: 'center',
  },
  inventoryDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 380,
    gap: theme.spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  inputGroup: {
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  textInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  helpText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});