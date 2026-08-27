import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Film,
  Upload,
  X,
  Check,
  Loader as Loader2,
  Sparkles,
  RefreshCw,
  Type,
  CircleAlert as AlertCircle,
  Play,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { COPY_FUNCTION_URL, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

interface MobileVideoImportProps {
  affiliatePlatforms?: string[];
  shortUrl?: string;
  onClose: () => void;
}

interface AICopyItem {
  hook: string;
  caption: string;
}

type Stage = 'idle' | 'picking' | 'uploaded' | 'generating' | 'done' | 'error';

const FONT_SIZES = [
  { label: '작게', value: 36 },
  { label: '보통', value: 48 },
  { label: '크게', value: 64 },
];

export function MobileVideoImport({
  affiliatePlatforms = [],
  shortUrl = '',
  onClose,
}: MobileVideoImportProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(6);
  const [hookText, setHookText] = useState('');
  const [subtitleText, setSubtitleText] = useState('');
  const [hookFontSize, setHookFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(36);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCopies, setAiCopies] = useState<AICopyItem[] | null>(null);
  const [aiError, setAiError] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handlePickVideo = useCallback(async () => {
    setStage('picking');
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        setStage('idle');
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      setVideoUri(uri);
      setDuration(asset.duration ? Math.min(Math.round(asset.duration), 60) : 6);
      setStage('uploaded');
    } catch (err) {
      setError(friendlyError(err, '영상을 불러오지 못했습니다. 다시 시도해주세요.'));
      setStage('error');
    }
  }, []);

  const handleUploadAndProcess = useCallback(async () => {
    if (!videoUri) return;
    setStage('generating');
    setError(null);

    try {
      const uriPath = videoUri.split('?')[0].split('#')[0];
      const fileExt = uriPath.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
      const contentType = fileExt === 'mov'
        ? 'video/quicktime'
        : fileExt === 'webm'
          ? 'video/webm'
          : 'video/mp4';

      if (Platform.OS === 'web') {
        const response = await fetch(videoUri);
        if (!response.ok) throw new Error('영상 파일을 읽을 수 없습니다.');
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, { contentType, upsert: false });
        if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);
      } else {
        const uploadResult = await FileSystem.uploadAsync(
          `${supabaseUrl}/storage/v1/object/videos/${encodeURIComponent(fileName)}`,
          videoUri,
          {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: `Bearer ${supabaseAnonKey}`,
              apikey: supabaseAnonKey,
              'Content-Type': contentType,
            },
          },
        );
        if (uploadResult.status < 200 || uploadResult.status >= 300) {
          let message = '영상 업로드에 실패했습니다.';
          try {
            const body = JSON.parse(uploadResult.body) as { message?: string; error?: string };
            message = body.message || body.error || message;
          } catch {
            // Keep the friendly fallback when the server response is not JSON.
          }
          throw new Error(message); 
        }
      }

      showToast('영상이 업로드되었습니다. 숏폼 가공은 웹에서 지원됩니다.');

      setStage('done');
    } catch (err) {
      setError(friendlyError(err, '영상 처리 중 오류가 발생했습니다.'));
      setStage('error');
    }
  }, [videoUri, affiliatePlatforms, showToast]);

  const handleAiAutoEdit = useCallback(async () => {
    setAiGenerating(true);
    setAiError(false);
    setAiCopies(null);
    try {
      const response = await fetch(COPY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          productName: '이 제품',
          productCategory: '숏폼',
          priceEstimate: '',
          oneLiner: '',
          productAdvantages: ['가성비'],
          copyType: 'viral',
          platform: 'shortform',
          count: 3,
        }),
      });
      if (!response.ok) throw new Error('AI 생성 실패');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAiCopies(
        (data.copies || []).map((c: any) => ({
          hook: c.hook || '',
          caption: c.caption || '',
        })),
      );
    } catch {
      setAiError(true);
    }
    setAiGenerating(false);
  }, []);

  const applyAiCopy = useCallback(
    (item: AICopyItem) => {
      setHookText(item.hook.slice(0, 30));
      setSubtitleText(item.caption.slice(0, 40).split('\n')[0]);
      setAiCopies(null);
      showToast('AI 문구를 적용했어요');
    },
    [showToast],
  );

  const handleShare = useCallback(async () => {
    if (!videoUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(videoUri, {
          mimeType: 'video/mp4',
          dialogTitle: '영상 공유하기',
        });
      } else if (Platform.OS === 'web') {
        Alert.alert('공유 불가', '이 기기에서는 공유를 지원하지 않습니다.');
      }
    } catch {
      showToast('공유에 실패했습니다.');
    }
  }, [videoUri, showToast]);

  const handleReset = useCallback(() => {
    setVideoUri(null);
    setHookText('');
    setSubtitleText('');
    setStage('idle');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <View style={styles.overlay}>
      <View style={styles.modalCard}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Film size={18} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.headerTitle}>동영상 불러오기</Text>
          </View>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={styles.closeBtn}>
            <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          갤러리에서 동영상을 선택하여 숏폼 가공에 사용할 수 있습니다. 선택한 영상은 서버에 업로드됩니다.
        </Text>

        {stage === 'idle' && (
          <View style={styles.idleWrap}>
            <TouchableOpacity style={styles.importButton} onPress={handlePickVideo} activeOpacity={0.8}>
              <Upload size={24} color="#fff" strokeWidth={2} />
              <Text style={styles.importButtonText}>갤러리에서 영상 선택</Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>
              MP4, MOV 등 동영상 파일을 선택하세요 (최대 200MB 권장)
            </Text>
          </View>
        )}

        {stage === 'picking' && (
          <View style={styles.loadingWrap}>
            <Loader2 size={32} color={theme.colors.primary[400]} strokeWidth={2.5} />
            <Text style={styles.loadingText}>영상을 불러오는 중...</Text>
          </View>
        )}

        {stage === 'uploaded' && videoUri && (
          <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.videoPreviewWrap}>
              {Platform.OS === 'web' ? (
                <video src={videoUri} style={styles.previewVideoWeb} controls playsInline />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Film size={40} color={theme.colors.dark.textDim} strokeWidth={1.5} />
                  <Text style={styles.previewText}>영상이 선택되었습니다</Text>
                  <Text style={styles.previewDuration}>약 {duration}초</Text>
                </View>
              )}
            </View>

            <View style={styles.sectionLabel}>
              <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.sectionLabelText}>훅 문구</Text>
            </View>
            <TextInput
              value={hookText}
              onChangeText={setHookText}
              placeholder="직접 입력하거나 AI 자동 편집을 사용하세요"
              style={styles.textInput}
              maxLength={30}
              placeholderTextColor={theme.colors.dark.textFaint}
            />

            <View style={styles.fontSizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.fontSizePill, hookFontSize === s.value && styles.fontSizePillActive]}
                  onPress={() => setHookFontSize(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontSizePillText, hookFontSize === s.value && styles.fontSizePillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionLabel}>
              <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.sectionLabelText}>자막 (선택)</Text>
            </View>
            <TextInput
              value={subtitleText}
              onChangeText={setSubtitleText}
              placeholder="필요한 경우 자막을 입력하세요"
              style={styles.textInput}
              maxLength={40}
              placeholderTextColor={theme.colors.dark.textFaint}
            />

            <View style={styles.fontSizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.fontSizePill, subtitleFontSize === s.value && styles.fontSizePillActive]}
                  onPress={() => setSubtitleFontSize(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontSizePillText, subtitleFontSize === s.value && styles.fontSizePillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.aiEditButton}
              onPress={handleAiAutoEdit}
              disabled={aiGenerating}
              activeOpacity={0.8}
            >
              {aiGenerating ? (
                <Loader2 size={16} color="#fff" strokeWidth={2} />
              ) : (
                <Sparkles size={16} color="#fff" strokeWidth={2} />
              )}
              <Text style={styles.aiEditText}>
                {aiGenerating ? 'AI 생성 중...' : 'AI 자동 편집 문구'}
              </Text>
            </TouchableOpacity>

            {aiError && (
              <View style={styles.aiErrorBox}>
                <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
                <Text style={styles.aiErrorText}>AI 생성에 실패했어요. 직접 입력하거나 다시 시도해주세요.</Text>
              </View>
            )}

            {aiCopies && aiCopies.length > 0 && (
              <View style={styles.aiResultsWrap}>
                <Text style={styles.aiResultsTitle}>AI 추천 문구 — 선택해서 적용하세요</Text>
                {aiCopies.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.aiCopyCard}
                    onPress={() => applyAiCopy(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.aiCopyIndexWrap}>
                      <Text style={styles.aiCopyIndex}>{i + 1}</Text>
                    </View>
                    <View style={styles.aiCopyContent}>
                      <Text style={styles.aiCopyHook} numberOfLines={1}>{item.hook}</Text>
                      <Text style={styles.aiCopyCaption} numberOfLines={2}>{item.caption}</Text>
                    </View>
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.reimportButton} onPress={handleReset} activeOpacity={0.7}>
                <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.reimportText}>다시 선택</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadButton} onPress={handleUploadAndProcess} activeOpacity={0.8}>
                <Upload size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.uploadButtonText}>업로드 및 저장</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {stage === 'generating' && (
          <View style={styles.loadingWrap}>
            <Loader2 size={32} color={theme.colors.primary[400]} strokeWidth={2.5} />
            <Text style={styles.loadingText}>영상을 업로드하는 중...</Text>
            <Text style={styles.loadingHint}>네트워크 환경에 따라 시간이 걸릴 수 있습니다</Text>
          </View>
        )}

        {stage === 'done' && (
          <View style={styles.resultWrap}>
            <View style={styles.successIcon}>
              <Check size={36} color={theme.colors.success[400]} strokeWidth={2.5} />
            </View>
            <Text style={styles.resultTitle}>업로드 완료</Text>
            <Text style={styles.resultDesc}>
              영상이 서버에 저장되었습니다. 숏폼 가공(자막, 훅 문구, 공정위 문구 추가)은 웹 버전에서 지원됩니다.
            </Text>
            {videoUri && (
              <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.8}>
                <Play size={16} color="#fff" strokeWidth={2} />
                <Text style={styles.shareButtonText}>원본 영상 공유하기</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.doneButton} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.doneButtonText}>다른 영상 선택</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'error' && (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color={theme.colors.error[400]} strokeWidth={2} />
            <Text style={styles.errorText}>{error || '오류가 발생했습니다. 다시 시도해주세요.'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleReset} activeOpacity={0.7}>
              <Text style={styles.retryText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {toast && (
          <View style={styles.toastBox}>
            <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,15,30,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    ...theme.shadows.elevated,
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
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  idleWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[600],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: theme.radius.md,
    ...theme.shadows.card,
  },
  importButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  hintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  loadingHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  optionsScroll: {
    maxHeight: 500,
  },
  videoPreviewWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  previewVideoWeb: {
    width: '100%',
    maxWidth: 240,
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
  },
  previewPlaceholder: {
    width: '100%',
    maxWidth: 240,
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  previewText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  previewDuration: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: theme.spacing.sm,
  },
  sectionLabelText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  textInput: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    color: theme.colors.dark.text,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  fontSizeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: theme.spacing.sm,
  },
  fontSizePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  fontSizePillActive: {
    backgroundColor: theme.colors.primary[600],
  },
  fontSizePillText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  fontSizePillTextActive: {
    color: '#fff',
  },
  aiEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    marginTop: theme.spacing.sm,
    ...theme.shadows.card,
  },
  aiEditText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  aiErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  aiErrorText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    flex: 1,
  },
  aiResultsWrap: {
    marginTop: 12,
    gap: 8,
  },
  aiResultsTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
    marginBottom: 4,
  },
  aiCopyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  aiCopyIndexWrap: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[500] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiCopyIndex: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  aiCopyContent: {
    flex: 1,
    gap: 2,
  },
  aiCopyHook: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  aiCopyCaption: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reimportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  reimportText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    ...theme.shadows.card,
  },
  uploadButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  resultWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.success[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  resultDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    marginTop: theme.spacing.sm,
  },
  shareButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  doneButtonText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    padding: 20,
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  retryText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  toastText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    flex: 1,
  },
});
