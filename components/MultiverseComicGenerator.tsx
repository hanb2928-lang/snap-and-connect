import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import {
  GitBranch,
  Zap,
  Download,
  RefreshCw,
  AlertCircle,
  CloudUpload,
  Loader2,
  Sparkles,
  CheckCircle,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { uploadAssetFromFileUri, uploadAssetBlob, saveAssetRecord } from '@/lib/savedAssets';
import { urlToDataUrl } from '@/lib/base64';
import { COMIC_SCENARIO_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import { buildComicHTML, type ComicPanel } from '@/components/ComicShortGenerator';
import type { StickerStyle } from '@/components/StickerLink';
import type { StickerPosition } from '@/components/TemplateCard';
import type { PlatformKey } from '@/types/database';

interface MultiverseEnding {
  label: string;
  speech: string;
  sfx: string;
  emotion: string;
}

interface MultiverseData {
  choicePrompt: string;
  endings: [MultiverseEnding, MultiverseEnding];
}

interface MultiverseComicGeneratorProps {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  fileName: string;
  affiliatePlatforms?: string[];
  platform?: PlatformKey;
  shortUrl?: string;
  stickerPosition?: StickerPosition;
  stickerStyle?: StickerStyle;
  stickerSize?: number;
  productName?: string;
  productCategory?: string;
  priceEstimate?: string;
  oneLiner?: string;
  productAdvantages?: string[];
}

type GenState = 'idle' | 'generating' | 'done' | 'error';

type EndingResult = {
  uri: string | null;
  blob: Blob | null;
  mime: string;
  size: number;
  state: GenState;
  progress: number;
};

const DURATION = 6000;

export function MultiverseComicGenerator({
  imageUrl,
  hook,
  title,
  hashtags,
  accentColor,
  fileName,
  affiliatePlatforms = [],
  platform = 'shortform',
  shortUrl = '',
  stickerPosition = 'top-left',
  stickerStyle = 'pill',
  stickerSize = 48,
  productName = '',
  productCategory = '',
  priceEstimate = '',
  oneLiner = '',
  productAdvantages = [],
}: MultiverseComicGeneratorProps) {
  const [multiverse, setMultiverse] = useState<MultiverseData | null>(null);
  const [basePanels, setBasePanels] = useState<ComicPanel[]>([]);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioFallback, setScenarioFallback] = useState(false);
  const [activeEnding, setActiveEnding] = useState<0 | 1>(0);
  const [results, setResults] = useState<[EndingResult, EndingResult]>([
    { uri: null, blob: null, mime: 'video/webm', size: 0, state: 'idle', progress: 0 },
    { uri: null, blob: null, mime: 'video/webm', size: 0, state: 'idle', progress: 0 },
  ]);
  const [cloudSaving, setCloudSaving] = useState<0 | 1 | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [safeImageUrl, setSafeImageUrl] = useState(imageUrl);
  const webViewRef = useRef<WebView>(null);
  const [webviewKey, setWebviewKey] = useState(0);
  const generateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEndingRef = useRef<0 | 1>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const converted = await urlToDataUrl(imageUrl);
      if (!cancelled) setSafeImageUrl(converted);
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    return () => {
      if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      const ending = pendingEndingRef.current;
      if (msg.type === 'progress') {
        setResults((prev) => {
          const next = [...prev] as [EndingResult, EndingResult];
          next[ending] = { ...next[ending], progress: msg.data.progress };
          return next;
        });
      } else if (msg.type === 'done') {
        const { base64, size, mimeType } = msg.data;
        const isImage = msg.data.isImage === true;
        const mime = mimeType || 'video/webm';
        const ext = isImage ? 'png' : (mime.includes('webm') ? 'webm' : 'mp4');
        try {
          let uri: string;
          let blob: Blob | null = null;
          if (Platform.OS === 'web') {
            const byteChars = atob(base64);
            const byteArr = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
            const newBlob = new Blob([byteArr], { type: mime });
            uri = URL.createObjectURL(newBlob);
            blob = newBlob;
          } else {
            const fileUri = `${FileSystem.cacheDirectory}${fileName.replace(/\.png$|\.webm$/, '')}-mv-${ending}-${Date.now()}.${ext}`;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            uri = fileUri;
          }
          if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
          setResults((prev) => {
            const next = [...prev] as [EndingResult, EndingResult];
            next[ending] = { uri, blob, mime, size: size || 0, state: 'done', progress: 100 };
            return next;
          });
          showToast(`${ending === 0 ? 'A' : 'B'} 결말 만화 완성!`);
        } catch {
          setResults((prev) => {
            const next = [...prev] as [EndingResult, EndingResult];
            next[ending] = { ...next[ending], state: 'error' };
            return next;
          });
          showToast('파일 저장에 실패했어요');
        }
      } else if (msg.type === 'error') {
        if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
        setResults((prev) => {
          const next = [...prev] as [EndingResult, EndingResult];
          next[ending] = { ...next[ending], state: 'error' };
          return next;
        });
        showToast('만화 생성에 실패했어요. 다시 시도해주세요');
      }
    } catch {
      // ignore parse errors
    }
  }, [fileName, showToast]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'string') return;
      handleWebViewMessage({ nativeEvent: { data: event.data } } as WebViewMessageEvent);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleWebViewMessage]);

  const generateScenario = useCallback(async () => {
    if (!productName) return null;
    setScenarioLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(COMIC_SCENARIO_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          productName,
          productCategory,
          priceEstimate,
          oneLiner,
          productAdvantages,
          hook,
          panelCount: 2,
          multiverseMode: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data.panels && Array.isArray(data.panels) && data.panels.length > 0) {
          setBasePanels(data.panels);
          setScenarioFallback(!!data.isFallback);
        }
        if (data.multiverse && data.multiverse.endings?.length === 2) {
          setMultiverse(data.multiverse as MultiverseData);
        }
        return data;
      }
    } catch {
      // fallback below
    }
    setScenarioLoading(false);
    return null;
  }, [productName, productCategory, priceEstimate, oneLiner, productAdvantages, hook]);

  const buildEndingPanels = useCallback(
    (endingIdx: 0 | 1): ComicPanel[] => {
      const base = basePanels.length >= 2
        ? basePanels.slice(0, 1)
        : [{ speech: hook, sfx: 'KWAANG!', emotion: '고민' }];
      if (!multiverse) return [...base, { speech: hook, sfx: 'BOOM!', emotion: '행복' }];
      const ending = multiverse.endings[endingIdx];
      return [
        ...base,
        { speech: ending.speech, sfx: ending.sfx, emotion: ending.emotion },
      ];
    },
    [basePanels, hook, multiverse],
  );

  const [pendingHtml, setPendingHtml] = useState<string | null>(null);

  const generateEnding = useCallback(
    async (endingIdx: 0 | 1) => {
      if (!multiverse) {
        await generateScenario();
      }
      pendingEndingRef.current = endingIdx;
      setActiveEnding(endingIdx);
      setResults((prev) => {
        const next = [...prev] as [EndingResult, EndingResult];
        next[endingIdx] = { uri: null, blob: null, mime: 'video/webm', size: 0, state: 'generating', progress: 0 };
        return next;
      });

      const panels = buildEndingPanels(endingIdx);
      const html = buildComicHTML({
        imageUrl: safeImageUrl,
        hook,
        title,
        hashtags,
        accentColor,
        shortUrl,
        moodTemplate: 'noir',
        panelLayout: 'split-2',
        disclosureText: getDisclosureShortForPlatforms(affiliatePlatforms),
        stickerPosition,
        stickerStyle,
        stickerSize,
        panels,
        duration: DURATION,
        episodeMode: false,
        narrationAudioDataUrl: null,
        punchMarkers: [],
        punchAudioDataUrl: null,
        mbtiCommentary: [],
      });
      setPendingHtml(html);
    },
    [multiverse, generateScenario, buildEndingPanels, safeImageUrl, hook, title, hashtags, accentColor, shortUrl, affiliatePlatforms, stickerPosition, stickerStyle, stickerSize],
  );

  useEffect(() => {
    if (pendingHtml === null) return;
    if (generateTimeoutRef.current) clearTimeout(generateTimeoutRef.current);
    generateTimeoutRef.current = setTimeout(() => {
      setResults((prev) => {
        const next = [...prev] as [EndingResult, EndingResult];
        if (next[pendingEndingRef.current].state === 'generating') {
          showToast('생성 시간이 초과됐어요. 다시 시도해주세요');
          next[pendingEndingRef.current] = { ...next[pendingEndingRef.current], state: 'error' };
        }
        return next;
      });
    }, 30000);
    if (Platform.OS !== 'web') {
      webViewRef.current?.reload();
    } else {
      setWebviewKey((k) => k + 1);
    }
  }, [pendingHtml, showToast]);

  const html = pendingHtml ?? '<html><body></body></html>';

  const handleSaveToGallery = useCallback(async (endingIdx: 0 | 1) => {
    const result = results[endingIdx];
    if (!result.uri) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = result.uri;
      a.download = fileName.replace(/\.png$|\.webm$/, '') + `-mv-${endingIdx === 0 ? 'A' : 'B'}.` + (result.mime.includes('png') ? 'png' : 'webm');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`${endingIdx === 0 ? 'A' : 'B'} 결말 다운로드 시작`);
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast('사진 접근 권한이 필요해요');
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      await MediaLibrary.createAlbumAsync('숏커넥트만화', asset, false);
      showToast('갤러리에 저장됐어요');
    } catch {
      showToast('갤러리 저장 중 오류가 발생했어요');
    }
  }, [results, fileName, showToast]);

  const handleSaveToCloud = useCallback(async (endingIdx: 0 | 1) => {
    const result = results[endingIdx];
    if (!result.uri) return;
    setCloudSaving(endingIdx);
    try {
      const ext = result.mime.includes('png') ? 'png' : 'webm';
      const cloudFileName = fileName.replace(/\.png$|\.webm$/, '') + `-mv-${endingIdx === 0 ? 'A' : 'B'}-${Date.now()}.${ext}`;
      let fileUrl: string | null = null;
      if (Platform.OS === 'web' && result.blob) {
        fileUrl = await uploadAssetBlob(result.blob, cloudFileName, result.mime);
      } else {
        fileUrl = await uploadAssetFromFileUri(result.uri, cloudFileName, result.mime);
      }
      if (!fileUrl) {
        showToast('클라우드 업로드에 실패했어요');
        setCloudSaving(null);
        return;
      }
      await saveAssetRecord({
        scan_id: null,
        asset_type: result.mime.includes('png') ? 'image' : 'video',
        title: `${title} (멀티버스 ${endingIdx === 0 ? 'A' : 'B'} 결말)`,
        file_url: fileUrl,
        file_name: cloudFileName,
        file_size: result.size || null,
        mime_type: result.mime,
        thumbnail_url: imageUrl,
        platform,
        affiliate_platform: affiliatePlatforms.join(',') || null,
      });
      showToast('클라우드에 저장됐어요');
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setCloudSaving(null);
  }, [results, fileName, title, imageUrl, platform, affiliatePlatforms, showToast]);

  const handleReset = useCallback(() => {
    results.forEach((r) => {
      if (r.uri && Platform.OS === 'web') URL.revokeObjectURL(r.uri);
    });
    setResults([
      { uri: null, blob: null, mime: 'video/webm', size: 0, state: 'idle', progress: 0 },
      { uri: null, blob: null, mime: 'video/webm', size: 0, state: 'idle', progress: 0 },
    ]);
    setMultiverse(null);
    setBasePanels([]);
    setPendingHtml(null);
  }, [results]);

  const bothDone = results[0].state === 'done' && results[1].state === 'done';
  const anyGenerating = results[0].state === 'generating' || results[1].state === 'generating';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <GitBranch size={18} color={theme.colors.accent[400]} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>멀티버스 웹툰 숏폼</Text>
            <Text style={styles.headerSubtitle}>A/B 다중 결말 시뮬레이션</Text>
          </View>
        </View>
        {bothDone && (
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        만화 마지막에 시청자가 선택할 수 있는 두 가지 갈림길을 만들어요. A 결말과 B 결말 각각의 만화 숏폼을 따로 생성해서, 시청자가 댓글로 선택하게 하세요. 틱톡/릴스에 두 버전을 올려 반응을 비교해보세요.
      </Text>

      {scenarioLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.colors.accent[400]} />
          <Text style={styles.loadingText}>AI가 A/B 결말 시나리오를 만드는 중...</Text>
        </View>
      )}

      {multiverse && !scenarioLoading && (
        <View style={styles.choicePromptBox}>
          <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
          <View style={styles.choicePromptTextWrap}>
            <Text style={styles.choicePromptLabel}>시청자 선택 질문</Text>
            <Text style={styles.choicePromptText}>{multiverse.choicePrompt}</Text>
          </View>
        </View>
      )}

      {scenarioFallback && multiverse && (
        <View style={styles.fallbackBadge}>
          <Sparkles size={11} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.fallbackBadgeText}>스마트 템플릿 A/B 시나리오</Text>
        </View>
      )}
      {!scenarioFallback && multiverse && (
        <View style={styles.aiBadge}>
          <Sparkles size={11} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.aiBadgeText}>AI A/B 결말 시나리오 적용됨</Text>
        </View>
      )}

      {!multiverse && !scenarioLoading && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={generateScenario}
          activeOpacity={0.8}
        >
          <Zap size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.startButtonText}>A/B 결말 시나리오 생성</Text>
        </TouchableOpacity>
      )}

      {multiverse && (
        <View style={styles.endingsRow}>
          {([0, 1] as const).map((idx) => {
            const ending = multiverse.endings[idx];
            const result = results[idx];
            const isActive = activeEnding === idx;
            const isGenerating = result.state === 'generating';
            const isDone = result.state === 'done';
            const isError = result.state === 'error';

            return (
              <View
                key={idx}
                style={[styles.endingCard, isActive && styles.endingCardActive]}
              >
                <View style={styles.endingHeader}>
                  <View style={[styles.endingBadge, idx === 0 ? styles.endingBadgeA : styles.endingBadgeB]}>
                    <Text style={styles.endingBadgeText}>{idx === 0 ? 'A' : 'B'}</Text>
                  </View>
                  <Text style={styles.endingLabel}>{ending.label}</Text>
                </View>

                <Text style={styles.endingSpeech}>"{ending.speech}"</Text>
                <View style={styles.endingMeta}>
                  <Text style={styles.endingSfx}>{ending.sfx}</Text>
                  <Text style={styles.endingEmotion}>{ending.emotion}</Text>
                </View>

                {result.state === 'idle' && (
                  <TouchableOpacity
                    style={styles.generateEndingButton}
                    onPress={() => generateEnding(idx)}
                    activeOpacity={0.8}
                  >
                    <Zap size={16} color="#fff" strokeWidth={2} />
                    <Text style={styles.generateEndingButtonText}>{idx === 0 ? 'A 결말' : 'B 결말'} 만화 생성</Text>
                  </TouchableOpacity>
                )}

                {isGenerating && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${result.progress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>만화 변환 중... {result.progress}%</Text>
                  </View>
                )}

                {isDone && result.uri && (
                  <View style={styles.resultActions}>
                    <TouchableOpacity
                      style={styles.downloadButton}
                      onPress={() => handleSaveToGallery(idx)}
                      activeOpacity={0.8}
                    >
                      <Download size={16} color="#fff" strokeWidth={2} />
                      <Text style={styles.downloadButtonText}>저장</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cloudButton}
                      onPress={() => handleSaveToCloud(idx)}
                      disabled={cloudSaving === idx}
                      activeOpacity={0.7}
                    >
                      {cloudSaving === idx ? (
                        <Loader2 size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                      ) : (
                        <CloudUpload size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                      )}
                      <Text style={styles.cloudButtonText}>클라우드</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isError && (
                  <View style={styles.errorWrap}>
                    <AlertCircle size={12} color={theme.colors.error[400]} strokeWidth={2} />
                    <Text style={styles.errorText}>생성 실패</Text>
                    <TouchableOpacity onPress={() => generateEnding(idx)} activeOpacity={0.7}>
                      <Text style={styles.retryText}>재시도</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {bothDone && (
        <View style={styles.tipBox}>
          <CheckCircle size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.tipText}>
            두 결말 모두 완성! 틱톡/릴스에 A버전과 B버전을 올리고 "댓글로 A or B 선택!" 이라고 유도해보세요.
          </Text>
        </View>
      )}

      {toast && (
        <View style={styles.toastBox}>
          <Zap size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <View style={styles.webViewHidden}>
        {Platform.OS === 'web' ? (
          <iframe
            key={webviewKey}
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            style={{ width: 1, height: 1, border: 'none', opacity: 0.01, position: 'absolute' }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            source={{ html }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mixedContentMode="always"
            originWhitelist={['*']}
            style={styles.webView as ViewStyle}
            scrollEnabled={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  description: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  choicePromptBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  choicePromptTextWrap: {
    flex: 1,
  },
  choicePromptLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginBottom: 2,
  },
  choicePromptText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  fallbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  fallbackBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.accent[500] + '15',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  startButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  endingsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  endingCard: {
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  endingCardActive: {
    borderColor: theme.colors.accent[400] + '50',
  },
  endingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  endingBadge: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endingBadgeA: {
    backgroundColor: theme.colors.primary[500],
  },
  endingBadgeB: {
    backgroundColor: theme.colors.success[500],
  },
  endingBadgeText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  endingLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  endingSpeech: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
    lineHeight: 16,
    marginBottom: 6,
  },
  endingMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  endingSfx: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    backgroundColor: theme.colors.warning[500] + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  endingEmotion: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  generateEndingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent[500],
  },
  generateEndingButtonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    gap: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.bg,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.accent[400],
  },
  progressText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 6,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent[500],
  },
  downloadButtonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  cloudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  cloudButtonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  retryText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  tipBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '10',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 17,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400],
  },
  toastText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  webViewHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0.01,
    left: 0,
    top: 0,
    zIndex: -1,
  },
  webView: {
    width: 1,
    height: 1,
  },
});
