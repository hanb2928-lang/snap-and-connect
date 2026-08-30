import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  CloudRain,
  Snowflake,
  ThermometerSun,
  CloudSun,
  TrendingUp,
  Users,
  Plus,
  X,
  Zap,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import {
  fetchWeatherAlerts,
  markWeatherAlertActedOn,
  type WeatherAlert,
} from '@/lib/weatherAutomation';
import { supabase } from '@/lib/supabase';
import { setItem } from '@/lib/storage';

const WEATHER_ICON_MAP: Record<string, typeof CloudRain> = {
  rain: CloudRain,
  snow: Snowflake,
  cold_snap: Snowflake,
  heat_wave: ThermometerSun,
};

const WEATHER_LABEL_MAP: Record<string, string> = {
  rain: '비',
  snow: '눈',
  cold_snap: '한파',
  heat_wave: '폭염',
};

const WEATHER_COLOR_MAP: Record<string, string> = {
  rain: theme.colors.primary[400],
  snow: theme.colors.neutral[300],
  cold_snap: '#60a5fa',
  heat_wave: theme.colors.error[400],
};

export function WeatherMarketingHistory() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultModal, setResultModal] = useState<WeatherAlert | null>(null);
  const [visitorInput, setVisitorInput] = useState('');
  const [revenueInput, setRevenueInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchWeatherAlerts(50);
      setAlerts(data);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleRelaunch = async (alert: WeatherAlert) => {
    if (alert.prompt_text) {
      await setItem('marketing_voice_command_prompt', alert.prompt_text);
      await setItem('marketing_voice_command_intent', 'closing');
      await setItem('marketing_voice_command_active', 'true');
      router.push('/(tabs)/marketing' as never);
    }
  };

  const handleSaveResult = async () => {
    if (!resultModal) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('weather_alerts')
        .update({
          visitor_count: parseInt(visitorInput || '0', 10),
          revenue_impact: parseInt(revenueInput || '0', 10),
          result_note: noteInput.trim() || null,
        })
        .eq('id', resultModal.id);
      if (!error) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === resultModal.id
              ? {
                  ...a,
                  visitor_count: parseInt(visitorInput || '0', 10),
                  revenue_impact: parseInt(revenueInput || '0', 10),
                  result_note: noteInput.trim() || null,
                }
              : a,
          ),
        );
        setResultModal(null);
        setVisitorInput('');
        setRevenueInput('');
        setNoteInput('');
      }
    } catch {}
    setSaving(false);
  };

  // Calculate aggregate stats
  const totalVisitors = alerts.reduce((sum, a) => sum + (a.visitor_count || 0), 0);
  const totalRevenue = alerts.reduce((sum, a) => sum + (a.revenue_impact || 0), 0);
  const actedCount = alerts.filter((a) => a.is_acted_on).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.colors.accent[400]} style={styles.loader} />
      </View>
    );
  }

  if (alerts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <CloudSun size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>날씨 특화 마케팅 히스토리</Text>
            <Text style={styles.subtitle}>비·한파·폭염 날 발송한 숏폼 성과 추적</Text>
          </View>
        </View>
      </View>

      {/* Aggregate stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Users size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={styles.statNum}>{totalVisitors}팀</Text>
          <Text style={styles.statLabel}>추가 방문</Text>
        </View>
        <View style={styles.statBox}>
          <TrendingUp size={14} color={theme.colors.warning[400]} strokeWidth={2.5} />
          <Text style={styles.statNum}>{totalRevenue > 0 ? `${(totalRevenue / 10000).toFixed(0)}만` : '0'}</Text>
          <Text style={styles.statLabel}>추가 매출</Text>
        </View>
        <View style={styles.statBox}>
          <Zap size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
          <Text style={styles.statNum}>{actedCount}건</Text>
          <Text style={styles.statLabel}>발송 완료</Text>
        </View>
      </View>

      {/* Alert history list */}
      <ScrollView style={styles.historyList} contentContainerStyle={styles.historyContent} showsVerticalScrollIndicator={false}>
        {alerts.map((alert) => {
          const Icon = WEATHER_ICON_MAP[alert.alert_type] || CloudSun;
          const color = WEATHER_COLOR_MAP[alert.alert_type] || theme.colors.accent[400];
          const label = WEATHER_LABEL_MAP[alert.alert_type] || '날씨';
          const hasResult = alert.visitor_count > 0 || alert.revenue_impact > 0;
          return (
            <View key={alert.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <View style={[styles.historyIcon, { backgroundColor: color + '18' }]}>
                  <Icon size={14} color={color} strokeWidth={2.5} />
                </View>
                <View style={styles.historyInfo}>
                  <View style={styles.historyLabelRow}>
                    <Text style={[styles.historyLabel, { color }]}>{label}</Text>
                    {alert.temperature !== null && (
                      <Text style={styles.historyTemp}>{alert.temperature.toFixed(0)}°C</Text>
                    )}
                    <Text style={styles.historyDate}>
                      {new Date(alert.triggered_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.historyTitle} numberOfLines={1}>{alert.title}</Text>
                </View>
              </View>

              {hasResult && (
                <View style={styles.resultBar}>
                  <View style={styles.resultChip}>
                    <Users size={10} color={theme.colors.success[400]} strokeWidth={2.5} />
                    <Text style={styles.resultChipText}>추가 {alert.visitor_count}팀 방문</Text>
                  </View>
                  {alert.revenue_impact > 0 && (
                    <View style={styles.resultChip}>
                      <TrendingUp size={10} color={theme.colors.warning[400]} strokeWidth={2.5} />
                      <Text style={styles.resultChipText}>매출 +{(alert.revenue_impact / 10000).toFixed(0)}만</Text>
                    </View>
                  )}
                </View>
              )}

              {alert.result_note && (
                <Text style={styles.resultNote}>{alert.result_note}</Text>
              )}

              <View style={styles.historyActions}>
                <TouchableOpacity
                  style={[styles.historyActionBtn, { backgroundColor: color + '18' }]}
                  onPress={() => handleRelaunch(alert)}
                  activeOpacity={0.7}
                >
                  <Zap size={11} color={color} strokeWidth={2.5} />
                  <Text style={[styles.historyActionText, { color }]}>재발송</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resultBtn}
                  onPress={() => {
                    setResultModal(alert);
                    setVisitorInput(String(alert.visitor_count || ''));
                    setRevenueInput(String(alert.revenue_impact || ''));
                    setNoteInput(alert.result_note || '');
                  }}
                  activeOpacity={0.7}
                >
                  <Plus size={11} color={theme.colors.dark.textDim} strokeWidth={2.5} />
                  <Text style={styles.resultBtnText}>성과 기록</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Result Input Modal */}
      <Modal visible={!!resultModal} transparent animationType="fade" onRequestClose={() => setResultModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>마케팅 성과 기록</Text>
              <TouchableOpacity onPress={() => setResultModal(null)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {resultModal && (
              <Text style={styles.modalContext}>
                {WEATHER_LABEL_MAP[resultModal.alert_type]} · {resultModal.title}
              </Text>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>추가 방문 팀 수</Text>
              <TextInput
                style={styles.textInput}
                value={visitorInput}
                onChangeText={setVisitorInput}
                placeholder="예: 12"
                placeholderTextColor={theme.colors.dark.textFaint}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>추가 매출 (원)</Text>
              <TextInput
                style={styles.textInput}
                value={revenueInput}
                onChangeText={setRevenueInput}
                placeholder="예: 150000"
                placeholderTextColor={theme.colors.dark.textFaint}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>메모 (선택)</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 50 }]}
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="예: 비 오는 날 어묵탕 특가로 추가 12팀 방문!"
                placeholderTextColor={theme.colors.dark.textFaint}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveResult} disabled={saving} activeOpacity={0.7}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>성과 저장</Text>}
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
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  loader: {
    paddingVertical: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  historyList: {
    maxHeight: 300,
  },
  historyContent: {
    gap: 8,
  },
  historyCard: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  historyTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  historyTemp: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  historyDate: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  historyTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  resultBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  resultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
  resultNote: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 6,
    lineHeight: 15,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  historyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyActionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
  },
  resultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  resultBtnText: {
    fontSize: 11,
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
  modalContext: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputGroup: {
    gap: 6,
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
