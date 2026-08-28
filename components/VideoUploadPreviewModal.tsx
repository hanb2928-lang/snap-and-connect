import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { X, Check, CreditCard as Edit3, Eye, ShieldCheck, Film, Download, CloudUpload, Hash, Type, Sparkles } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoPreview } from '@/components/VideoPreview';

export interface VideoUploadPreviewData {
  videoUri: string;
  videoMime: string;
  format: 'vertical' | 'horizontal';
  hook: string;
  title: string;
  hashtags: string[];
  affiliatePlatforms: string[];
  disclosureText: string;
  autoDisclosure: boolean;
  templateLabel: string;
}

interface VideoUploadPreviewModalProps {
  visible: boolean;
  data: VideoUploadPreviewData | null;
  onConfirm: (edited: {
    hook: string;
    title: string;
    hashtags: string[];
    autoDisclosure: boolean;
  }) => void;
  onClose: () => void;
}

type Mode = 'preview' | 'edit';

export function VideoUploadPreviewModal({ visible, data, onConfirm, onClose }: VideoUploadPreviewModalProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('preview');
  const [hook, setHook] = useState('');
  const [title, setTitle] = useState('');
  const [hashtagText, setHashtagText] = useState('');
  const [autoDisclosure, setAutoDisclosure] = useState(true);

  useEffect(() => {
    if (data) {
      setHook(data.hook);
      setTitle(data.title);
      setHashtagText(data.hashtags.map((h) => `#${h}`).join(' '));
      setAutoDisclosure(data.autoDisclosure);
      setMode('preview');
    }
  }, [data]);

  const parsedHashtags = useMemo(
    () =>
      hashtagText
        .split(/\s+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean),
    [hashtagText],
  );

  if (!data) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={theme.colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>업로드 미리보기</Text>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'preview' && styles.modeBtnActive]}
              onPress={() => setMode('preview')}
            >
              <Eye size={14} color={mode === 'preview' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.modeBtnText, mode === 'preview' && styles.modeBtnTextActive]}>미리보기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'edit' && styles.modeBtnActive]}
              onPress={() => setMode('edit')}
            >
              <Edit3 size={14} color={mode === 'edit' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.modeBtnText, mode === 'edit' && styles.modeBtnTextActive]}>수정</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Video preview */}
          <View style={styles.mediaWrap}>
            <VideoPreview
              uri={data.videoUri}
              mimeType={data.videoMime}
              isVertical={data.format === 'vertical'}
              maxHeight={340}
            />
            {data.templateLabel ? (
              <View style={styles.templateTag}>
                <Sparkles size={10} color="#fff" strokeWidth={2.5} />
                <Text style={styles.templateTagText}>{data.templateLabel}</Text>
              </View>
            ) : null}
          </View>

          {mode === 'preview' ? (
            <PreviewMode
              data={data}
              hook={hook}
              title={title}
              hashtagText={hashtagText}
              autoDisclosure={autoDisclosure}
            />
          ) : (
            <EditMode
              hook={hook}
              setHook={setHook}
              title={title}
              setTitle={setTitle}
              hashtagText={hashtagText}
              setHashtagText={setHashtagText}
              autoDisclosure={autoDisclosure}
              setAutoDisclosure={setAutoDisclosure}
              disclosureText={data.disclosureText}
            />
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>취소</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => onConfirm({ hook, title, hashtags: parsedHashtags, autoDisclosure })}
            activeOpacity={0.8}
          >
            <Download size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.uploadBtnText}>저장 및 업로드</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PreviewMode({
  data,
  hook,
  title,
  hashtagText,
  autoDisclosure,
}: {
  data: VideoUploadPreviewData;
  hook: string;
  title: string;
  hashtagText: string;
  autoDisclosure: boolean;
}) {
  return (
    <View style={styles.previewSection}>
      <Text style={styles.previewSectionLabel}>캡션 미리보기</Text>
      <View style={styles.captionCard}>
        {autoDisclosure && data.disclosureText ? (
          <>
            <Text style={styles.captionDisclosure}>{data.disclosureText}</Text>
            <Text style={styles.captionDivider}>{'─'.repeat(24)}</Text>
          </>
        ) : null}
        <Text style={styles.captionTitle}>{title || '제목 없음'}</Text>
        <Text style={styles.captionHook}>{hook || '후킹 문구 없음'}</Text>
        {hashtagText.trim() ? (
          <Text style={styles.captionHashtags}>{hashtagText}</Text>
        ) : null}
      </View>

      <View style={styles.summaryList}>
        <SummaryRow
          icon={<Film size={16} color={theme.colors.warning[400]} strokeWidth={2} />}
          label="템플릿"
          value={data.templateLabel || '기본'}
        />
        <SummaryRow
          icon={<Type size={16} color={theme.colors.primary[300]} strokeWidth={2} />}
          label="제목"
          value={title ? '입력됨' : '없음'}
        />
        <SummaryRow
          icon={<Hash size={16} color={theme.colors.accent[400]} strokeWidth={2} />}
          label="해시태그"
          value={hashtagText.trim() ? `${hashtagText.split(/\s+/).filter(Boolean).length}개` : '없음'}
        />
        <SummaryRow
          icon={<ShieldCheck size={16} color={autoDisclosure ? theme.colors.success[400] : theme.colors.dark.textDim} strokeWidth={2} />}
          label="공정위 문구"
          value={autoDisclosure ? '자동 추가됨' : '미사용'}
        />
      </View>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      {icon}
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function EditMode({
  hook,
  setHook,
  title,
  setTitle,
  hashtagText,
  setHashtagText,
  autoDisclosure,
  setAutoDisclosure,
  disclosureText,
}: {
  hook: string;
  setHook: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  hashtagText: string;
  setHashtagText: (v: string) => void;
  autoDisclosure: boolean;
  setAutoDisclosure: (v: boolean) => void;
  disclosureText: string;
}) {
  return (
    <View style={styles.editSection}>
      <Text style={styles.editLabel}>제목</Text>
      <TextInput
        style={styles.textInput}
        value={title}
        onChangeText={setTitle}
        placeholder="제목을 입력하세요"
        placeholderTextColor={theme.colors.dark.textFaint}
      />

      <Text style={styles.editLabel}>후킹 문구</Text>
      <TextInput
        style={[styles.textInput, { minHeight: 60 }]}
        value={hook}
        onChangeText={setHook}
        placeholder="후킹 문구를 입력하세요..."
        placeholderTextColor={theme.colors.dark.textFaint}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.editLabel}>해시태그</Text>
      <TextInput
        style={[styles.textInput, { minHeight: 50 }]}
        value={hashtagText}
        onChangeText={setHashtagText}
        placeholder="#해시태그 #띄어쓰기로 #구분"
        placeholderTextColor={theme.colors.dark.textFaint}
        multiline
      />

      <TouchableOpacity
        style={styles.disclosureToggle}
        onPress={() => setAutoDisclosure(!autoDisclosure)}
        activeOpacity={0.7}
      >
        <View style={styles.disclosureToggleInfo}>
          <ShieldCheck size={18} color={theme.colors.success[400]} strokeWidth={2} />
          <View style={styles.disclosureToggleTextWrap}>
            <Text style={styles.disclosureToggleTitle}>공정위 문구 자동 추가</Text>
            <Text style={styles.disclosureToggleDesc}>
              영상 캡션에 제휴 광고 문구가 자동으로 들어갑니다
            </Text>
          </View>
        </View>
        <Switch
          value={autoDisclosure}
          onValueChange={setAutoDisclosure}
          trackColor={{ false: theme.colors.dark.border, true: theme.colors.success[500] }}
          thumbColor="#fff"
        />
      </TouchableOpacity>

      {autoDisclosure && disclosureText ? (
        <View style={styles.disclosurePreviewBox}>
          <Text style={styles.disclosurePreviewLabel}>추가될 문구</Text>
          <Text style={styles.disclosurePreviewText}>{disclosureText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.glass.border,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.full,
    padding: 3,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.warning[500],
  },
  modeBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  modeBtnTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  mediaWrap: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    position: 'relative',
    alignItems: 'center',
  },
  templateTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  templateTagText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  previewSection: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  previewSectionLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  captionCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.glass.border,
    gap: 6,
  },
  captionDisclosure: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    lineHeight: 16,
  },
  captionDivider: {
    fontSize: 10,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
  },
  captionTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    lineHeight: 21,
  },
  captionHook: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 19,
  },
  captionHashtags: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
    marginTop: 2,
  },
  summaryList: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  editSection: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  editLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  textInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.glass.border,
  },
  disclosureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  disclosureToggleInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  disclosureToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  disclosureToggleTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  disclosureToggleDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  disclosurePreviewBox: {
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '30',
  },
  disclosurePreviewLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  disclosurePreviewText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    lineHeight: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: theme.glass.border,
    backgroundColor: theme.glass.surface,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' as unknown as undefined } : {}),
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.glass.border,
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    ...theme.shadows.elevated,
  },
  uploadBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
