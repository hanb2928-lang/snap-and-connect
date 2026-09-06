import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image as RNImage,
  Platform,
  Dimensions,
} from 'react-native';
import { Camera, Check, X, RotateCcw, ChevronRight, Image as ImageIcon, Loader } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';

const { width: screenWidth } = Dimensions.get('window');

export type AngleShot = {
  id: string;
  orderIndex: number;
  label: string;
  hint: string;
  base64?: string;
  dataUrl?: string;
  mimeType: string;
};

export type AngleGuide = {
  id: string;
  label: string;
  hint: string;
  emoji: string;
};

const ANGLE_GUIDES: AngleGuide[] = [
  { id: 'front', label: '정면', hint: '제품 전체가 보이도록 정면에서 촬영', emoji: '📸' },
  { id: 'left', label: '좌측면', hint: '제품의 왼쪽 측면을 45도 각도에서 촬영', emoji: '👈' },
  { id: 'right', label: '우측면', hint: '제품의 오른쪽 측면을 45도 각도에서 촬영', emoji: '👉' },
  { id: 'back', label: '후면', hint: '라벨이나 디자인이 보이는 뒷면을 촬영', emoji: '🔄' },
  { id: 'top', label: '상부', hint: '제품의 윗면을 위에서 내려다보며 촬영', emoji: '⬆️' },
];

interface MultiAngleCaptureGuideProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (shots: AngleShot[]) => void;
  /** Pick from gallery instead of camera */
  onPickImage?: (angleId: string) => Promise<{ base64: string; mimeType: string } | null>;
  /** Capture from camera */
  onCaptureImage?: (angleId: string) => Promise<{ base64: string; mimeType: string } | null>;
}

export function MultiAngleCaptureGuide({
  visible,
  onClose,
  onComplete,
  onPickImage,
  onCaptureImage,
}: MultiAngleCaptureGuideProps) {
  const safeTop = useSafeTop();
  const [shots, setShots] = useState<Record<string, AngleShot>>({});
  const [currentAngle, setCurrentAngle] = useState(0);
  const [processing, setProcessing] = useState(false);
  const pickLockRef = useRef(false);

  const completedCount = Object.keys(shots).length;
  const allDone = completedCount >= ANGLE_GUIDES.length;

  const handleAddShot = useCallback(
    (angleId: string, base64: string, mimeType: string) => {
      const guideIndex = ANGLE_GUIDES.findIndex((g) => g.id === angleId);
      const guide = ANGLE_GUIDES[guideIndex];
      setShots((prev) => {
        const next = { ...prev };
        // Free the previous data URL if replacing an existing shot
        const prevShot = next[angleId];
        if (prevShot?.dataUrl) {
          // Allow GC to reclaim the old string
          prevShot.dataUrl = undefined;
          prevShot.base64 = undefined;
        }
        next[angleId] = {
          id: angleId,
          orderIndex: guideIndex,
          label: guide.label,
          hint: guide.hint,
          base64,
          dataUrl: `data:${mimeType};base64,${base64}`,
          mimeType,
        };
        return next;
      });
    },
    [],
  );

  const handlePickFromGallery = useCallback(
    async (angleId: string) => {
      if (!onPickImage) return;
      if (pickLockRef.current) return;
      pickLockRef.current = true;
      setProcessing(true);
      try {
        const result = await onPickImage(angleId);
        if (result) {
          handleAddShot(angleId, result.base64, result.mimeType);
        }
      } catch {
        // ignore
      }
      setProcessing(false);
      setTimeout(() => { pickLockRef.current = false; }, 500);
    },
    [onPickImage, handleAddShot],
  );

  const handleCaptureFromCamera = useCallback(
    async (angleId: string) => {
      if (!onCaptureImage) return;
      if (pickLockRef.current) return;
      pickLockRef.current = true;
      setProcessing(true);
      try {
        const result = await onCaptureImage(angleId);
        if (result) {
          handleAddShot(angleId, result.base64, result.mimeType);
        }
      } catch {
        // ignore
      }
      setProcessing(false);
      setTimeout(() => { pickLockRef.current = false; }, 500);
    },
    [onCaptureImage, handleAddShot],
  );

  const handleRetake = useCallback((angleId: string) => {
    setShots((prev) => {
      const next = { ...prev };
      delete next[angleId];
      return next;
    });
  }, []);

  const handleComplete = useCallback(() => {
    const ordered = ANGLE_GUIDES.map((g, idx) => {
      const shot = shots[g.id];
      if (!shot) return null;
      return { ...shot, orderIndex: idx };
    }).filter(Boolean) as AngleShot[];
    onComplete(ordered);
    setShots({});
  }, [shots, onComplete]);

  const handleClose = useCallback(() => {
    setShots({});
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { paddingTop: safeTop }]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleClose} activeOpacity={0.7}>
              <X size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>멀티 앵글 가이드</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Progress */}
          <View style={styles.progressRow}>
            {ANGLE_GUIDES.map((g, i) => (
              <View key={g.id} style={[styles.progressDot, shots[g.id] && styles.progressDotDone, i === currentAngle && styles.progressDotActive]} />
            ))}
            <Text style={styles.progressText}>{completedCount}/{ANGLE_GUIDES.length} 완료</Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Intro */}
            <View style={styles.introBox}>
              <Text style={styles.introTitle}>5각도 순차 촬영으로 입체적 AI 영상 완성</Text>
              <Text style={styles.introDesc}>
                정면, 좌측, 우측, 후면, 상부를 순서대로 촬영하면 AI가 제품의 입체적 특성을 정밀하게 복원합니다.
                5장의 사진으로 왜곡 없는 역동적인 숏폼을 생성합니다.
              </Text>
            </View>

            {/* Angle cards */}
            {ANGLE_GUIDES.map((guide, idx) => {
              const shot = shots[guide.id];
              const isActive = idx === currentAngle;
              return (
                <View key={guide.id} style={[styles.angleCard, isActive && styles.angleCardActive]}>
                  <View style={styles.angleHeader}>
                    <Text style={styles.angleEmoji}>{guide.emoji}</Text>
                    <View style={styles.angleHeaderText}>
                      <Text style={styles.angleLabel}>STEP {idx + 1} · {guide.label}</Text>
                      <Text style={styles.angleHint}>{guide.hint}</Text>
                    </View>
                    {shot && (
                      <View style={styles.doneBadge}>
                        <Check size={12} color="#fff" strokeWidth={2.5} />
                      </View>
                    )}
                  </View>

                  {shot?.dataUrl ? (
                    <View style={styles.shotPreview}>
                      <RNImage source={{ uri: shot.dataUrl }} style={styles.shotImage} resizeMode="cover" />
                      <View style={styles.shotIndexBadge}>
                        <Text style={styles.shotIndexText}>{String(idx + 1).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.shotActions}>
                        <TouchableOpacity
                          style={styles.retakeBtn}
                          onPress={() => {
                            handleRetake(guide.id);
                            setCurrentAngle(idx);
                          }}
                          activeOpacity={0.7}
                        >
                          <RotateCcw size={13} color={theme.colors.dark.text} strokeWidth={2} />
                          <Text style={styles.retakeText}>다시 촬영</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.shotPlaceholder}>
                      {onCaptureImage && (
                        <TouchableOpacity
                          style={styles.captureBtn}
                          onPress={() => {
                            setCurrentAngle(idx);
                            handleCaptureFromCamera(guide.id);
                          }}
                          disabled={processing}
                          activeOpacity={0.7}
                        >
                          <Camera size={18} color={theme.colors.dark.text} strokeWidth={2} />
                          <Text style={styles.galleryBtnText}>촬영하기</Text>
                        </TouchableOpacity>
                      )}
                      {onPickImage && (
                        <TouchableOpacity
                          style={styles.galleryBtn}
                          onPress={() => {
                            setCurrentAngle(idx);
                            handlePickFromGallery(guide.id);
                          }}
                          disabled={processing}
                          activeOpacity={0.7}
                        >
                          <ImageIcon size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
                          <Text style={styles.galleryBtnText}>갤러리에서 선택</Text>
                        </TouchableOpacity>
                      )}
                      {processing && (
                        <View style={styles.processingRow}>
                          <Loader size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                          <Text style={styles.processingText}>이미지 불러오는 중...</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Bottom action */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.completeBtn, !allDone && styles.completeBtnDisabled]}
              onPress={handleComplete}
              disabled={!allDone}
              activeOpacity={0.7}
            >
              <Check size={18} color={allDone ? '#fff' : theme.colors.dark.textFaint} strokeWidth={2} />
              <Text style={[styles.completeBtnText, !allDone && styles.completeBtnTextDisabled]}>
                {allDone ? '5장으로 콘텐츠 만들기' : `${ANGLE_GUIDES.length - completedCount}장 더 촬영하세요`}
              </Text>
              {allDone && <ChevronRight size={18} color="#fff" strokeWidth={2} />}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSpacer: {
    width: 40,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.border,
  },
  progressDotDone: {
    backgroundColor: theme.colors.success[500],
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary[400],
    width: 24,
  },
  progressText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginLeft: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  introBox: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 6,
  },
  introTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  introDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
  },
  angleCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: theme.spacing.sm,
  },
  angleCardActive: {
    borderColor: theme.colors.primary[400],
  },
  angleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  angleEmoji: {
    fontSize: 24,
  },
  angleHeaderText: {
    flex: 1,
    gap: 2,
  },
  angleLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  angleHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  doneBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  shotPreview: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  shotIndexBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shotIndexText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  shotImage: {
    width: '100%',
    height: 240,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  shotActions: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  retakeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: '#fff',
  },
  shotPlaceholder: {
    minHeight: 140,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  galleryBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  processingText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  bottomBar: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
    backgroundColor: theme.colors.dark.surface,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500],
  },
  completeBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  completeBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  completeBtnTextDisabled: {
    color: theme.colors.dark.textFaint,
  },
});
