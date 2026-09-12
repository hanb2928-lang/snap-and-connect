import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform, Image as RNImage, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '@/lib/theme';

interface VideoPreviewProps {
  uri: string;
  mimeType: string;
  isVertical?: boolean;
  maxHeight?: number;
  fallbackImages?: string[];
}

const FALLBACK_SLIDE_INTERVAL_MS = 2500;

export function VideoPreview({ uri, mimeType, isVertical = true, maxHeight = 400, fallbackImages }: VideoPreviewProps) {
  const isImage = mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg');
  const aspectStyle = isVertical ? styles.vertical : styles.horizontal;

  const [dataUri, setDataUri] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasFallbackImages = !!fallbackImages && fallbackImages.length > 0;

  // Reset error state when URI changes
  useEffect(() => {
    setVideoError(false);
  }, [uri]);

  // Fallback slideshow timer
  useEffect(() => {
    if (!videoError || !hasFallbackImages || fallbackImages!.length <= 1) return;
    fallbackTimerRef.current = setInterval(() => {
      setFallbackIndex((prev) => (prev + 1) % fallbackImages!.length);
    }, FALLBACK_SLIDE_INTERVAL_MS);
    return () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [videoError, hasFallbackImages, fallbackImages]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (uri.startsWith('data:') || uri.startsWith('blob:')) {
      setDataUri(uri);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (cancelled) return;
        setDataUri(`data:${mimeType};base64,${base64}`);
      } catch {
        if (!cancelled) setDataUri(uri);
      }
    })();
    return () => { cancelled = true; };
  }, [uri, mimeType]);

  const videoSrc = Platform.OS === 'web' ? uri : (dataUri || uri);

  const videoHtml = useMemo(
    () => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;}body{background:#000;overflow:hidden;}video{width:100%;height:100%;object-fit:contain;}</style></head><body><video src="${videoSrc}" controls autoplay loop muted playsinline webkit-playsinline onerror="window.ReactNativeWebView.postMessage('video_error')"></video><script>document.querySelector('video').addEventListener('error',function(){window.ReactNativeWebView.postMessage('video_error');},{once:true});var v=document.querySelector('video');if(v.readyState===4&&v.networkState===3){window.ReactNativeWebView.postMessage('video_error');}</script></body></html>`,
    [videoSrc],
  );
  const webviewSource = useMemo(() => ({ html: videoHtml }), [videoHtml]);

  // Fallback slideshow rendering (used on both web and native)
  const renderFallbackSlideshow = () => {
    if (!hasFallbackImages) {
      return (
        <View style={[styles.previewContainer, aspectStyle, { maxHeight, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.errorText}>비디오를 불러올 수 없습니다</Text>
          <Text style={styles.errorSubtext}>이미지 미리보기로 전환됩니다</Text>
        </View>
      );
    }

    const currentFallbackImage = fallbackImages![fallbackIndex];

    if (Platform.OS === 'web') {
      return (
        // @ts-ignore web-only img element
        <img
          key={`fallback-${fallbackIndex}`}
          src={currentFallbackImage}
          style={{
            width: '100%',
            aspectRatio: isVertical ? '9 / 16' : '16 / 9',
            maxHeight,
            borderRadius: 12,
            objectFit: 'contain',
            backgroundColor: '#000',
            alignSelf: 'center',
          }}
        />
      );
    }

    return (
      <View style={[styles.previewContainer, aspectStyle, { maxHeight }]}>
        <RNImage
          key={`fallback-${fallbackIndex}`}
          source={{ uri: currentFallbackImage }}
          style={styles.imageFill}
          resizeMode="contain"
        />
        <View style={styles.fallbackBadge}>
          <Text style={styles.fallbackBadgeText}>이미지 폴백</Text>
        </View>
      </View>
    );
  };

  // If video errored, show fallback slideshow
  if (videoError && !isImage) {
    return renderFallbackSlideshow();
  }

  if (Platform.OS === 'web') {
    if (isImage) {
      return (
        // @ts-ignore web-only img element
        <img
          key={uri}
          src={uri}
          style={{
            width: '100%',
            aspectRatio: isVertical ? '9 / 16' : '16 / 9',
            maxHeight,
            borderRadius: 12,
            objectFit: 'contain',
            backgroundColor: '#000',
            alignSelf: 'center',
          }}
        />
      );
    }
    return (
      // @ts-ignore web-only video element
      <video
        key={uri}
        src={uri}
        controls
        autoPlay
        loop
        muted
        playsInline
        onError={handleVideoError}
        style={{
          width: '100%',
          aspectRatio: isVertical ? '9 / 16' : '16 / 9',
          maxHeight,
          borderRadius: 12,
          objectFit: 'contain',
          backgroundColor: '#000',
          alignSelf: 'center',
        }}
      />
    );
  }

  if (isImage) {
    return (
      <View style={[styles.previewContainer, aspectStyle, { maxHeight }]}>
        <RNImage source={{ uri }} style={styles.imageFill} resizeMode="contain" />
      </View>
    );
  }

  if (!dataUri) {
    return (
      <View style={[styles.previewContainer, aspectStyle, { maxHeight, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.loadingDot} />
      </View>
    );
  }

  return (
    <View style={[styles.previewContainer, aspectStyle, { maxHeight }]}>
      <WebView
        key={videoSrc}
        source={webviewSource}
        style={styles.webViewFill}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        mixedContentMode="always"
        originWhitelist={['*']}
        allowFileAccess
        onMessage={(event) => {
          if (event.nativeEvent.data === 'video_error') {
            handleVideoError();
          }
        }}
        onError={handleVideoError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
    width: '100%',
  },
  vertical: {
    aspectRatio: 9 / 16,
  },
  horizontal: {
    aspectRatio: 16 / 9,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  webViewFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  errorSubtext: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 4,
  },
  fallbackBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  fallbackBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
  },
});
