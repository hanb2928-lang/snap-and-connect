import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { CloudSun, Zap, X, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getWeatherAlertSettings,
  fetchLiveWeather,
  fetchWeatherAlerts,
  determineWeatherAlert,
  createWeatherAlert,
  type WeatherAlertSettings,
  type WeatherAlert,
} from '@/lib/weatherAutomation';
import { setItem } from '@/lib/storage';

type WeatherCondition = 'clear' | 'rain' | 'snow' | 'cold' | 'hot';

interface BannerData {
  condition: WeatherCondition;
  temperature: number;
  alertType: WeatherAlert['alert_type'] | null;
  alertTitle: string;
  alertBody: string;
  hookPhrase: string;
  promptText: string;
}

export function WeatherBanner() {
  const router = useRouter();
  const [banner, setBanner] = useState<BannerData | null>(null);
  const dismissedRef = useRef(false);
  const lastAlertTypeRef = useRef<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef(0);

  const checkWeather = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < 300000) return; // 5 min debounce
    lastCheckRef.current = now;

    try {
      const settings = await getWeatherAlertSettings();
      if (!settings?.store_latitude || !settings.store_longitude) {
        setBanner(null);
        return;
      }

      const weather = await fetchLiveWeather(
        settings.store_latitude,
        settings.store_longitude,
        settings.cold_snap_threshold,
        settings.heat_wave_threshold,
      );

      const condition: WeatherCondition = weather.is_snowing
        ? 'snow'
        : weather.is_raining
          ? 'rain'
          : weather.temperature <= settings.cold_snap_threshold
            ? 'cold'
            : weather.temperature >= settings.heat_wave_threshold
              ? 'hot'
              : 'clear';

      // Only determine/create alerts when enabled
      const alertData = settings.enabled ? determineWeatherAlert(weather, settings) : null;

      // Reset dismissed when a new alert type appears
      if (alertData && alertData.type !== lastAlertTypeRef.current) {
        dismissedRef.current = false;
        lastAlertTypeRef.current = alertData.type;
      }

      if (alertData && !dismissedRef.current) {
        // Check for existing unread alert of same type in last 2h
        const alerts = await fetchWeatherAlerts(5);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const existing = alerts.find(
          (a) => a.alert_type === alertData.type && !a.is_read && new Date(a.triggered_at) > twoHoursAgo,
        );
        if (!existing) {
          await createWeatherAlert({
            alert_type: alertData.type,
            title: alertData.title,
            body: alertData.body,
            hook_phrase: alertData.hook_phrase,
            prompt_text: alertData.prompt_text,
            temperature: weather.temperature,
            precipitation: weather.precipitation,
            weather_code: weather.weather_code,
          });
        }

        setBanner({
          condition,
          temperature: Math.round(weather.temperature),
          alertType: alertData.type,
          alertTitle: alertData.title,
          alertBody: alertData.body,
          hookPhrase: alertData.hook_phrase,
          promptText: alertData.prompt_text,
        });

        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else if (condition === 'clear') {
        // Calm weather indicator
        setBanner({
          condition: 'clear',
          temperature: Math.round(weather.temperature),
          alertType: null,
          alertTitle: '',
          alertBody: '',
          hookPhrase: '',
          promptText: '',
        });
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } catch {
      // Weather fetch failed — show nothing
    }
  }, [slideAnim]);

  useEffect(() => {
    checkWeather();
    checkIntervalRef.current = setInterval(checkWeather, 300000); // 5 min
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkWeather]);

  const handleDismiss = () => {
    dismissedRef.current = true;
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleAction = async () => {
    if (!banner?.promptText) return;
    await setItem('marketing_voice_command_prompt', banner.promptText);
    await setItem('marketing_voice_command_intent', 'closing');
    await setItem('marketing_voice_command_active', 'true');
    router.push('/(tabs)/marketing' as never);
  };

  if (!banner) return null;

  const isEmergency = banner.alertType !== null;
  const Icon = CloudSun;

  // Emergency banner: red/orange gradient. Calm: subtle dark
  const emergencyGradients: Record<string, [string, string]> = {
    rain: ['#dc2626', '#f59e0b'],
    snow: ['#0ea5e9', '#06b6d4'],
    cold: ['#3b82f6', '#06b6d4'],
    hot: ['#dc2626', '#f97316'],
  };
  const emergencyAccent: Record<string, string> = {
    rain: '#fbbf24',
    snow: theme.colors.neutral[200],
    cold: '#60a5fa',
    hot: '#f97316',
  };
  const accentColor = isEmergency
    ? emergencyAccent[banner.condition] || theme.colors.accent[400]
    : theme.colors.dark.textDim;

  if (isEmergency) {
    const gradient = emergencyGradients[banner.condition] || ['#dc2626', '#f59e0b'];
    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
            borderBottomWidth: 0,
          },
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emergencyGradient}
        >
          <View style={styles.left}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
              <AlertTriangle size={20} color="#fff" strokeWidth={2.5} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.emergencyTitle} numberOfLines={1}>
                {banner.alertType === 'rain' && '비상! '}
                {banner.alertType === 'snow' && '눈! '}
                {banner.alertType === 'cold_snap' && '한파! '}
                {banner.alertType === 'heat_wave' && '폭염! '}
                홀이 한적한 시간입니다
              </Text>
              <Text style={styles.emergencySubtitle} numberOfLines={2}>
                {banner.temperature}°C · {banner.alertBody.slice(0, 60)}
              </Text>
            </View>
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity
              style={styles.emergencyActionBtn}
              onPress={handleAction}
              activeOpacity={0.85}
            >
              <Zap size={14} color="#dc2626" strokeWidth={2.5} />
              <Text style={styles.emergencyActionText}>숏폼 발송</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.7}>
              <X size={14} color="rgba(255,255,255,0.8)" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: 'rgba(10, 15, 30, 0.55)',
          borderColor: 'transparent',
        },
      ]}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <Icon
            size={14}
            color={theme.colors.dark.textDim}
            strokeWidth={2.5}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.calmTitle, { color: theme.colors.dark.textDim }]}>
            {banner.condition === 'clear' ? '현재 동네 날씨 맑음' : banner.condition === 'hot' ? '폭염 주의' : banner.condition === 'cold' ? '쌀쌀한 날씨' : '구름 많음'} · {banner.temperature}°C
          </Text>
          <Text style={styles.calmSub}>마감 자동 경보 대기 중</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    zIndex: 25,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
  emergencyTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
    letterSpacing: -0.3,
  },
  emergencySubtitle: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 14,
  },
  emergencyGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emergencyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#fff',
    ...theme.shadows.card,
  },
  emergencyActionText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#dc2626',
  },
  calmTitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  calmSub: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
