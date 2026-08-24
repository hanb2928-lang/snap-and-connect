import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useKeepAwake } from 'expo-keep-awake';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { initStorage } from '@/lib/storage';
import { theme } from '@/lib/theme';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AffiliateToastProvider } from '@/components/AffiliateToast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

type ReadyState = 'loading' | 'app' | 'error';

export default function RootLayout() {
  useFrameworkReady();
  useKeepAwake();
  const [ready, setReady] = useState<ReadyState>('loading');
  const startedRef = useRef(false);

  const [fontsLoaded, fontError] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (!(fontsLoaded || fontError) || startedRef.current) return;
    startedRef.current = true;

    if (fontError && !fontsLoaded) {
      SplashScreen.hideAsync();
      setReady('error');
      return;
    }

    (async () => {
      try {
        await initStorage();
        setReady('app');
        SplashScreen.hideAsync();
      } catch {
        setReady('error');
        SplashScreen.hideAsync();
      }
    })();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (!url) return;
      if (url.includes('auth/callback') || url.includes('access_token') || url.includes('error=')) {
        WebBrowser.dismissBrowser();
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      sub.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.dark.bg, gap: theme.spacing.md }}>
        <ActivityIndicator size="large" color={theme.colors.primary[400]} />
        <Text style={{ fontSize: 14, color: theme.colors.dark.textDim }}>앱을 시작하는 중...</Text>
      </View>
    );
  }

  if (ready === 'loading') {
    return <LoadingScreen message="앱을 시작하는 중..." />;
  }

  if (ready === 'error') {
    const retryInit = () => {
      startedRef.current = false;
      setReady('loading');
    };
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.dark.bg, paddingHorizontal: 40, gap: 12 }}>
          <Text style={{ fontSize: 18, fontFamily: theme.typography.fontFamily.bold, color: theme.colors.dark.text, marginBottom: 4 }}>
            앱을 시작할 수 없어요
          </Text>
          <Text style={{ fontSize: 14, fontFamily: theme.typography.fontFamily.regular, color: theme.colors.dark.textDim, textAlign: 'center', lineHeight: 22 }}>
            인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, backgroundColor: theme.colors.primary[500] }}
            onPress={retryInit}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, fontFamily: theme.typography.fontFamily.bold, color: '#fff' }}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AffiliateToastProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="editor" options={{ headerShown: false }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: 'fade' }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="light" />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AffiliateToastProvider>
    </ErrorBoundary>
  );
}
