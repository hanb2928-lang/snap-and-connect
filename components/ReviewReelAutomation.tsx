import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Receipt, Star, Plus, X, Film, CircleCheck as CheckCircle2, Clock, CircleAlert as AlertCircle, Trash2, Sparkles, QrCode } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import {
  fetchReviews,
  createReview,
  updateReviewStatus,
  deleteReview,
  type CustomerReview,
} from '@/lib/reviewAutomation';
import { getItem, setItem } from '@/lib/storage';
import { useRouter } from 'expo-router';

const STATUS_META: Record<CustomerReview['reel_status'], { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: '대기 중', icon: Clock, color: theme.colors.warning[400] },
  rendering: { label: '렌더링 중', icon: Film, color: theme.colors.primary[400] },
  completed: { label: '완료', icon: CheckCircle2, color: theme.colors.success[400] },
  failed: { label: '실패', icon: AlertCircle, color: theme.colors.error[400] },
};

export function ReviewReelAutomation() {
  const router = useRouter();
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewerName, setNewReviewerName] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const data = await fetchReviews();
      setReviews(data);
      setError(null);
    } catch (err) {
      setError('리뷰를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleAddReview = async () => {
    if (!newReviewText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await createReview({
        review_text: newReviewText.trim(),
        reviewer_name: newReviewerName.trim() || null,
        rating: newRating,
        table_number: newTableNumber.trim() || null,
      });
      if (review) {
        setReviews((prev) => [review, ...prev]);
        setShowAddModal(false);
        setNewReviewText('');
        setNewReviewerName('');
        setNewRating(5);
        setNewTableNumber('');
        simulateReelGeneration(review.id);
      }
    } catch {
      setError('리뷰 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const simulateReelGeneration = async (reviewId: string) => {
    try {
      await updateReviewStatus(reviewId, 'rendering');
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, reel_status: 'rendering' } : r)),
      );
      setTimeout(async () => {
        try {
          await updateReviewStatus(reviewId, 'completed', `reel_${reviewId}.mp4`);
          setReviews((prev) =>
            prev.map((r) =>
              r.id === reviewId
                ? { ...r, reel_status: 'completed', reel_asset_url: `reel_${reviewId}.mp4`, is_published: true }
                : r,
            ),
          );
        } catch {
          await updateReviewStatus(reviewId, 'failed');
          setReviews((prev) =>
            prev.map((r) => (r.id === reviewId ? { ...r, reel_status: 'failed' } : r)),
          );
        }
      }, 2000);
    } catch {}
  };

  const handleDeleteReview = async (id: string) => {
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('리뷰 삭제에 실패했습니다.');
    }
  };

  const handleUseReviewForShortform = async (review: CustomerReview) => {
    await setItem('marketing_voice_command_prompt', review.review_text);
    await setItem('marketing_voice_command_intent', 'best_seller');
    await setItem('marketing_voice_command_active', 'true');
    router.push('/(tabs)/marketing' as never);
  };

  const completedCount = reviews.filter((r) => r.reel_status === 'completed').length;
  const pendingCount = reviews.filter((r) => r.reel_status === 'pending' || r.reel_status === 'rendering').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Receipt size={20} color={theme.colors.primary[300]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>영수증 리뷰 릴스 자동화</Text>
            <Text style={styles.subtitle}>손님 한 줄 평 + 매장 사진 → 자동 릴스 렌더링</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.primary[400]} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <QrCode size={32} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>아직 리뷰가 없어요</Text>
          <Text style={styles.emptyDesc}>테이블 QR로 손님이 한 줄 평을 남기면 자동으로 릴스가 만들어져요</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{reviews.length}</Text>
              <Text style={styles.statLabel}>전체 리뷰</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: theme.colors.success[400] }]}>{completedCount}</Text>
              <Text style={styles.statLabel}>릴스 완료</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: theme.colors.warning[400] }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>대기/렌더링</Text>
            </View>
          </View>

          <ScrollView
            style={styles.reviewList}
            contentContainerStyle={styles.reviewListContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadReviews();
                }}
                tintColor={theme.colors.primary[400]}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {reviews.map((review) => {
              const status = STATUS_META[review.reel_status];
              const StatusIcon = status.icon;
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          color={s <= review.rating ? theme.colors.warning[400] : theme.colors.dark.border}
                          strokeWidth={2}
                          fill={s <= review.rating ? theme.colors.warning[400] : 'transparent'}
                        />
                      ))}
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: status.color + '18' }]}>
                      <StatusIcon size={11} color={status.color} strokeWidth={2} />
                      <Text style={[styles.statusChipText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{review.review_text}</Text>
                  <View style={styles.reviewMeta}>
                    {review.reviewer_name && (
                      <Text style={styles.reviewMetaText}>{review.reviewer_name}</Text>
                    )}
                    {review.table_number && (
                      <Text style={styles.reviewMetaText}>테이블 {review.table_number}</Text>
                    )}
                    <Text style={styles.reviewMetaText}>
                      {new Date(review.created_at).toLocaleDateString('ko-KR')}
                    </Text>
                  </View>
                  <View style={styles.reviewActions}>
                    <TouchableOpacity
                      style={styles.reviewActionBtn}
                      onPress={() => handleUseReviewForShortform(review)}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                      <Text style={styles.reviewActionText}>숏폼으로 만들기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.reviewDeleteBtn}
                      onPress={() => handleDeleteReview(review.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={theme.colors.error[400]} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Add Review Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>손님 리뷰 등록</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>한 줄 평 *</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                value={newReviewText}
                onChangeText={setNewReviewText}
                placeholder="예: 명란 비빔밥 진짜 고소하고 맛있어요!"
                placeholderTextColor={theme.colors.dark.textFaint}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>손님 이름 (선택)</Text>
              <TextInput
                style={styles.textInput}
                value={newReviewerName}
                onChangeText={setNewReviewerName}
                placeholder="예: 김단골"
                placeholderTextColor={theme.colors.dark.textFaint}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>테이블 번호 (선택)</Text>
              <TextInput
                style={styles.textInput}
                value={newTableNumber}
                onChangeText={setNewTableNumber}
                placeholder="예: 5"
                placeholderTextColor={theme.colors.dark.textFaint}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>별점</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setNewRating(s)} activeOpacity={0.7}>
                    <Star
                      size={28}
                      color={s <= newRating ? theme.colors.warning[400] : theme.colors.dark.border}
                      strokeWidth={2}
                      fill={s <= newRating ? theme.colors.warning[400] : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, !newReviewText.trim() && styles.submitBtnDisabled]}
              onPress={handleAddReview}
              disabled={!newReviewText.trim() || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>리뷰 등록 & 릴스 자동 생성</Text>
              )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '18',
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
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    paddingVertical: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  emptyDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
    lineHeight: 16,
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
  },
  statNum: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  reviewList: {
    maxHeight: 340,
  },
  reviewListContent: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
  },
  reviewText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
    marginBottom: 6,
  },
  reviewMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  reviewMetaText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  reviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary[500] + '18',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
  },
  reviewActionText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  reviewDeleteBtn: {
    width: 32,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.error[500] + '12',
    justifyContent: 'center',
    alignItems: 'center',
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
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
