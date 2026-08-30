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
import {
  CloudRain,
  Snowflake,
  ThermometerSun,
  Bell,
  Plus,
  X,
  Trash2,
  Zap,
  MapPin,
  Settings as SettingsIcon,
  CloudSun,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import {
  getWeatherAlertSettings,
  updateWeatherAlertSettings,
  fetchWeatherAlerts,
  createWeatherAlert,
  markWeatherAlertRead,
  markWeatherAlertActedOn,
  deleteWeatherAlert,
  fetchLiveWeather,
  determineWeatherAlert,
  type WeatherAlertSettings,
  type WeatherAlert,
} from '@/lib/weatherAutomation';
import { setItem } from '@/lib/storage';

const WEATHER_ICON_MAP: Record<string, typeof CloudRain> = {
  rain: CloudRain,
  snow: Snowflake,
  cold_snap: Snowflake,
  heat_wave: ThermometerSun,
};

const WEATHER_COLOR_MAP: Record<string, string> = {
  rain: theme.colors.primary[400],
  snow: theme.colors.neutral[200],
  cold_snap: '#60a5fa',
  heat_wave: theme.colors.error[400],
};

const WEATHER_LABEL_MAP: Record<string, string> = {
  rain: '비',
  snow: '눈',
  cold_snap: '한파',
  heat_wave: '폭염',
};

export function WeatherAlertAgent() {
  const router = useRouter();
  const [settings, setSettings] = useState<WeatherAlertSettings | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeather, setCurrentWeather] = useState<{ temp: number; condition: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef(0);

  // Settings form state
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [storeNameInput, setStoreNameInput] = useState('');
  const [coldInput, setColdInput] = useState('0');
  const [hotInput, setHotInput] = useState('35');

  const loadAll = useCallback(async () => {
    try {
      const [settingsData, alertsData] = await Promise.all([
        getWeatherAlertSettings(),
        fetchWeatherAlerts(20),
      ]);
      setSettings(settingsData);
      setAlerts(alertsData);
      if (settingsData) {
        setLatInput(settingsData.store_latitude?.toString() || '');
        setLonInput(settingsData.store_longitude?.toString() || '');
        setStoreNameInput(settingsData.store_name || '');
        setColdInput(String(settingsData.cold_snap_threshold));
        setHotInput(String(settingsData.heat_wave_threshold));
      }
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

  // Periodic weather check — every 10 minutes when enabled
  useEffect(() => {
    if (!settings?.enabled || !settings.store_latitude || !settings.store_longitude) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    const checkWeather = async () => {
      const now = Date.now();
      // Debounce: don't check more than once per 10 minutes
      if (now - lastCheckRef.current < 600000) return;
      lastCheckRef.current = now;

      setChecking(true);
      try {
        const weather = await fetchLiveWeather(
          settings.store_latitude!,
          settings.store_longitude!,
        );
        const condition = weather.is_snowing ? '눈' : weather.is_raining ? '비' : weather.is_cold ? '한파' : weather.is_hot ? '폭염' : '맑음';
        setCurrentWeather({ temp: Math.round(weather.temperature), condition });

        // Determine if we need to fire an alert
        const alertData = determineWeatherAlert(weather, settings);
        if (alertData) {
          // Check if we already have an unread alert of the same type within last 2 hours
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          const existing = alerts.find(
            (a) => a.alert_type === alertData.type && !a.is_read && new Date(a.triggered_at) > twoHoursAgo,
          );
          if (!existing) {
            const created = await createWeatherAlert({
              alert_type: alertData.type,
              title: alertData.title,
              body: alertData.body,
              hook_phrase: alertData.hook_phrase,
              prompt_text: alertData.prompt_text,
              temperature: weather.temperature,
              precipitation: weather.precipitation,
              weather_code: weather.weather_code,
            });
            if (created) setAlerts((prev) => [created, ...prev]);
            await updateWeatherAlertSettings({ last_weather_check: new Date().toISOString(), last_alert_type: alertData.type });
          }
        }
      } catch {
        // Weather fetch failed — silently skip
      } finally {
        setChecking(false);
      }
    };

    checkWeather();
    checkIntervalRef.current = setInterval(checkWeather, 600000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [settings, alerts]);

  const handleToggleEnabled = async (enabled: boolean) => {
    setSettings((prev) => (prev ? { ...prev, enabled } : prev));
    try {
      await updateWeatherAlertSettings({ enabled });
    } catch {
      setSettings((prev) => (prev ? { ...prev, enabled: !enabled } : prev));
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateWeatherAlertSettings({
        store_latitude: parseFloat(latInput) || null,
        store_longitude: parseFloat(lonInput) || null,
        store_name: storeNameInput.trim() || null,
        cold_snap_threshold: parseFloat(coldInput) || 0,
        heat_wave_threshold: parseFloat(hotInput) || 35,
      });
      setShowSettingsModal(false);
      loadAll();
    } catch {
      setError('설정 저장에 실패했습니다.');
    }
  };

  const handleAlertTap = async (alert: WeatherAlert) => {
    await markWeatherAlertRead(alert.id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_read: true, read_at: new Date().toISOString() } : a)),
    );
  };

  const handleAlertAction = async (alert: WeatherAlert) => {
    await markWeatherAlertActedOn(alert.id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, is_acted_on: true, is_read: true } : a)),
    );
    if (alert.prompt_text) {
      await setItem('marketing_voice_command_prompt', alert.prompt_text);
      await setItem('marketing_voice_command_intent', 'closing');
      await setItem('marketing_voice_command_active', 'true');
      router.push('/(tabs)/marketing' as never);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteWeatherAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('알림 삭제에 실패했습니다.');
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <CloudSun size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>날씨 연동형 긴급 마케팅 자동 경보</Text>
            <Text style={styles.subtitle}>비·눈·한파·폭염 자동 감지 → 맞춤 숏폼 발송</Text>
          </View>
        </View>
        <Switch
          value={settings?.enabled ?? false}
          onValueChange={handleToggleEnabled}
          trackColor={{ false: theme.colors.dark.border, true: theme.colors.accent[500] }}
          thumbColor="#fff"
        />
      </View>

      {/* Current weather status */}
      {currentWeather && (
        <View style={styles.weatherBar}>
          <View style={styles.weatherLeft}>
            {currentWeather.condition === '비' && <CloudRain size={16} color={theme.colors.primary[400]} strokeWidth={2.5} />}
            {currentWeather.condition === '눈' && <Snowflake size={16} color={theme.colors.neutral[200]} strokeWidth={2.5} />}
            {currentWeather.condition === '한파' && <Snowflake size={16} color="#60a5fa" strokeWidth={2.5} />}
            {currentWeather.condition === '폭염' && <ThermometerSun size={16} color={theme.colors.error[400]} strokeWidth={2.5} />}
            {currentWeather.condition === '맑음' && <CloudSun size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />}
            <Text style={styles.weatherText}>
              현재 날씨: {currentWeather.condition} · {currentWeather.temp}°C
            </Text>
          </View>
          {checking && <ActivityIndicator size="small" color={theme.colors.accent[400]} />}
        </View>
      )}

      {/* No location warning */}
      {settings?.enabled && (!settings.store_latitude || !settings.store_longitude) && (
        <View style={styles.warningBar}>
          <MapPin size={14} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.warningText}>매장 위치를 설정해주세요 — 날씨 감지에 필요합니다</Text>
          <TouchableOpacity style={styles.warningBtn} onPress={() => setShowSettingsModal(true)} activeOpacity={0.7}>
            <Text style={styles.warningBtnText}>설정</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.accent[400]} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          {/* Unread alert banner */}
          {unreadCount > 0 && (
            <View style={[styles.alertBanner, { borderColor: theme.colors.accent[400] + '30' }]}>
              <View style={styles.alertBannerLeft}>
                <View style={[styles.alertPulse, { backgroundColor: theme.colors.accent[400] }]} />
                <Text style={[styles.alertBannerText, { color: theme.colors.accent[400] }]}>
                  {unreadCount}건의 날씨 긴급 알림 대기 중
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.alertBannerBtn, { backgroundColor: theme.colors.accent[500] }]}
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

          {/* Weather alerts list */}
          {alerts.length > 0 ? (
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
                  tintColor={theme.colors.accent[400]}
                />
              }
            >
              {alerts.slice(0, 10).map((alert) => {
                const Icon = WEATHER_ICON_MAP[alert.alert_type] || Bell;
                const color = WEATHER_COLOR_MAP[alert.alert_type] || theme.colors.accent[400];
                const label = WEATHER_LABEL_MAP[alert.alert_type] || '날씨';
                return (
                  <View key={alert.id} style={[styles.alertCard, !alert.is_read && styles.alertCardUnread]}>
                    <View style={[styles.alertIconWrap, { backgroundColor: color + '18' }]}>
                      <Icon size={16} color={color} strokeWidth={2.5} />
                    </View>
                    <View style={styles.alertBody}>
                      <View style={styles.alertTitleRow}>
                        <Text style={styles.alertTypeBadge}>{label}</Text>
                        {alert.temperature !== null && (
                          <Text style={styles.alertTempText}>{alert.temperature.toFixed(0)}°C</Text>
                        )}
                      </View>
                      <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
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
                        <TouchableOpacity style={styles.alertDismissBtn} onPress={() => handleAlertTap(alert)} activeOpacity={0.7}>
                          <Text style={styles.alertDismissText}>확인</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.alertDeleteBtn} onPress={() => handleDeleteAlert(alert.id)} activeOpacity={0.7}>
                          <Trash2 size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <CloudSun size={32} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>날씨 알림 대기 중</Text>
              <Text style={styles.emptyDesc}>
                비·눈·한파·폭염이 감지되면 자동으로 맞춤형 마케팅 숏폼 발송 알림이 와요
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setShowSettingsModal(true)}
                activeOpacity={0.7}
              >
                <MapPin size={13} color="#fff" strokeWidth={2.5} />
                <Text style={styles.emptyBtnText}>매장 위치 설정</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settings button */}
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.7}
          >
            <SettingsIcon size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.settingsBtnText}>날씨 알림 설정</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>날씨 알림 설정</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>매장 이름 (선택)</Text>
              <TextInput
                style={styles.textInput}
                value={storeNameInput}
                onChangeText={setStoreNameInput}
                placeholder="예: 우리식당"
                placeholderTextColor={theme.colors.dark.textFaint}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>위도 (latitude)</Text>
                <TextInput
                  style={styles.textInput}
                  value={latInput}
                  onChangeText={setLatInput}
                  placeholder="37.5665"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>경도 (longitude)</Text>
                <TextInput
                  style={styles.textInput}
                  value={lonInput}
                  onChangeText={setLonInput}
                  placeholder="126.9780"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.helpText}>
              서울 기준: 위도 37.5665, 경도 126.9780. 구글 맵에서 매장을 우클릭하면 좌표를 확인할 수 있어요.
            </Text>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>한파 기준 (°C 이하)</Text>
                <TextInput
                  style={styles.textInput}
                  value={coldInput}
                  onChangeText={setColdInput}
                  placeholder="0"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>폭염 기준 (°C 이상)</Text>
                <TextInput
                  style={styles.textInput}
                  value={hotInput}
                  onChangeText={setHotInput}
                  placeholder="35"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveSettings} activeOpacity={0.7}>
              <Text style={styles.submitBtnText}>설정 저장</Text>
            </TouchableOpacity>
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
    backgroundColor: theme.colors.accent[500] + '18',
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
  weatherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  warningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '30',
  },
  warningText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    flex: 1,
  },
  warningBtn: {
    backgroundColor: theme.colors.warning[500],
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  warningBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
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
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
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
  },
  alertBannerText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
  },
  alertBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  alertBannerBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  alertList: {
    maxHeight: 300,
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
    borderColor: theme.colors.accent[500] + '30',
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
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertTypeBadge: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  alertTempText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
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
    alignItems: 'center',
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
  alertDeleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
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
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 6,
  },
  emptyBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    marginTop: 8,
  },
  settingsBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
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
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
