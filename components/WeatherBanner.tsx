import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import {
  CloudRain,
  Snowflake,
  ThermometerSun,
  CloudSun,
  Zap,
  X,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
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
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckRef = useRef(0);

  const checkWeather = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheckRef.current < 300000) return; // 5 min debounce
    lastCheckRef.current = now;

    try {
      const settings = await getWeatherAlertSettings();
      if (!settings?.enabled || !settings.store_latitude || !settings.store_longitude) {
        setBanner(null);
        return;
      }

      const weather = await fetchLiveWeather(
        settings.store_latitude,
        settings.store_longitude,
      );

      const condition: WeatherCondition = weather.is_snowing
        ? 'snow'
        : weather.is_raining
          ? 'rain'
          : weather.is_cold
            ? 'cold'
            : weather.is_hot
              ? 'hot'
              : 'clear';

      const alertData = determineWeatherAlert(weather, settings);

      if (alertData && !dismissed) {
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
  }, [dismissed, slideAnim]);

  useEffect(() => {
    checkWeather();
    checkIntervalRef.current = setInterval(checkWeather, 300000); // 5 min
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkWeather]);

  const handleDismiss = () => {
    setDismissed(true);
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
  const Icon = isEmergency
    ? banner.condition === 'rain'
      ? CloudRain
      : banner.condition === 'snow'
        ? Snowflake
        : banner.condition === 'hot'
          ? ThermometerSun
          : Snowflake
    : CloudSun;

  // Emergency banner: red/orange gradient. Calm: subtle dark
  const emergencyColors: Record<string, string> = {
    rain: '#1a3a5c',
    snow: '#2a4a6a',
    cold: '#1a3050',
    hot: '#5c1a1a',
  };
  const emergencyAccent: Record<string, string> = {
    rain: theme.colors.primary[400],
    snow: theme.colors.neutral[300],
    cold: '#60a5fa',
    hot: theme.colors.error[400],
  };
  const accentColor = isEmergency
    ? emergencyAccent[banner.condition] || theme.colors.accent[400]
    : theme.colors.dark.textDim;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isEmergency
            ? emergencyColors[banner.condition] || theme.colors.dark.surface
            : 'rgba(10, 15, 30, 0.55)',
          borderColor: isEmergency ? accentColor + '50' : 'transparent',
        },
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.iconWrap, isEmergency && { backgroundColor: accentColor + '25' }]}>
          <Icon
            size={isEmergency ? 18 : 14}
            color={isEmergency ? accentColor : theme.colors.dark.textDim}
            strokeWidth={2.5}
          />
        </View>
        <View style={styles.textWrap}>
          {isEmergency ? (
            <>
              <Text style={[styles.title, { color: isEmergency ? '#fff' : theme.colors.dark.text }]}>
                {banner.alertType === 'rain' && '비상! '}
                {banner.alertType === 'snow' && '눈! '}
                {banner.alertType === 'cold_snap' && '한파! '}
                {banner.alertType === 'heat_wave' && '폭염! '}
                홀이 한적한 시간입니다
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {banner.temperature}°C · {banner.alertBody.slice(0, 50)}...
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.calmTitle, { color: theme.colors.dark.textDim }]}>
                현재 동네 날씨 맑음 · {banner.temperature}°C
              </Text>
              <Text style={styles.calmSub}>마감 자동 경보 대기 중</Text>
            </>
          )}
        </View>
      </View>

      {isEmergency ? (
        <View style={styles.rightActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: accentColor }]}
            onPress={handleAction}
            activeOpacity={0.7}
          >
            <Zap size={12} color="#fff" strokeWidth={2.5} />
            <Text style={styles.actionText}>숏폼 발송</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} activeOpacity={0.7}>
            <X size={14} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      ) : null}
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
  title: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  subtitle: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
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
