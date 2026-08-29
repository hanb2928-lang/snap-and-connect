import { View, StyleSheet, Platform, Image as RNImage } from 'react-native';
import { WebView } from 'react-native-webview';

interface VideoPreviewProps {
  uri: string;
  mimeType: string;
  isVertical?: boolean;
  maxHeight?: number;
}

export function VideoPreview({ uri, mimeType, isVertical = true, maxHeight = 400 }: VideoPreviewProps) {
  const isImage = mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg');
  const aspectStyle = isVertical ? styles.vertical : styles.horizontal;

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
        playsInline
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

  const videoHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;}body{background:#000;overflow:hidden;}video{width:100%;height:100%;object-fit:contain;}</style></head><body><video src="${uri}" controls autoplay loop playsinline webkit-playsinline></video></body></html>`;

  return (
    <View style={[styles.previewContainer, aspectStyle, { maxHeight }]}>
      <WebView
        key={uri}
        source={{ html: videoHtml }}
        style={styles.webViewFill}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        mixedContentMode="always"
        originWhitelist={['*']}
        allowFileAccess
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
});
