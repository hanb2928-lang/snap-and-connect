import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  Dimensions,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { FolderOpen, Trash2, Download, Film, Image as ImageIcon, X, Calendar, Youtube, Instagram, FileText, Smartphone, Share2, CircleCheck as CheckCircle2, Clock, CircleDashed, Link2, Crop } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '@/lib/theme';
import { fetchSavedAssets, deleteSavedAsset, updateAssetUploadStatus } from '@/lib/savedAssets';
import type { SavedAsset } from '@/types/database';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeTop } from '@/hooks/useSafeTop';

const { width: screenWidth } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (screenWidth - 48 - CARD_GAP) / 2;

type UploadStatus = 'not_uploaded' | 'uploaded' | 'scheduled';

const STATUS_META: Record<UploadStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  not_uploaded: { label: '미업로드', icon: CircleDashed, color: theme.colors.dark.textDim, bg: theme.colors.dark.surfaceLight },
  uploaded: { label: '업로드 완료', icon: CheckCircle2, color: theme.colors.success[400], bg: theme.colors.success[500] + '15' },
  scheduled: { label: '예약', icon: Clock, color: theme.colors.warning[400], bg: theme.colors.warning[500] + '15' },
};

const REEXPORT_FORMATS = [
  { key: 'youtube_shorts', label: '유튜브 숏츠', ratio: '9:16', icon: Youtube, color: '#FF0000' },
  { key: 'instagram_feed', label: '인스타 피드', ratio: '1:1', icon: Instagram, color: '#E1306C' },
  { key: 'blog_card', label: '블로그 카드뉴스', ratio: '4:3', icon: FileText, color: '#00C4A7' },
  { key: 'mobile_story', label: '모바일 스토리', ratio: '9:16', icon: Smartphone, color: '#8B5CF6' },
];

export default function AssetsScreen() {
  const tabBarHeight = useTabBarHeight();
  const safeTop = useSafeTop();
  const [assets, setAssets] = useState<SavedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<SavedAsset | null>(null);
  const [reexportAsset, setReexportAsset] = useState<SavedAsset | null>(null);
  const [reexporting, setReexporting] = useState(false);
  const [reexportDone, setReexportDone] = useState<string | null>(null);
  const [statusPickerAsset, setStatusPickerAsset] = useState<SavedAsset | null>(null);
  const [shareUrlInput, setShareUrlInput] = useState('');

  const fetchAssets = useCallback(async () => {
    try {
      const data = await fetchSavedAssets();
      setAssets(data);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const handleDelete = useCallback(async (asset: SavedAsset) => {
    try {
      const success = await deleteSavedAsset(asset);
      if (success) {
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      }
    } catch {
      Alert.alert('오류', '삭제 중 문제가 발생했어요. 다시 시도해주세요.');
    }
  }, []);

  const handleDownload = useCallback(async (asset: SavedAsset) => {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = asset.file_url;
      a.download = asset.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '사진 접근 권한이 필요해요. 설정에서 허용해주세요.');
        return;
      }
      const ext = asset.asset_type === 'video' ? 'webm' : 'png';
      const localUri = `${FileSystem.cacheDirectory}${asset.file_name.replace(/\.[^.]+$/, '')}-${Date.now()}.${ext}`;
      const downloadRes = await FileSystem.downloadAsync(asset.file_url, localUri);
      if (downloadRes.status !== 200) {
        Alert.alert('오류', '파일을 다운로드하지 못했어요.');
        return;
      }
      const mediaAsset = await MediaLibrary.createAssetAsync(downloadRes.uri);
      const albumName = asset.asset_type === 'video' ? '숏커넥트 영상' : '숏커넥트';
      try {
        await MediaLibrary.createAlbumAsync(albumName, mediaAsset, false);
      } catch {
        // Album creation can fail on scoped storage; the asset is already saved to gallery.
      }
      Alert.alert('저장 완료', '갤러리에 저장됐어요.');
    } catch {
      Alert.alert('오류', '다운로드 중 문제가 발생했어요.');
    }
  }, []);

  const handleReexport = useCallback(async (formatKey: string) => {
    if (!reexportAsset) return;
    setReexporting(true);
    setReexportDone(null);
    setTimeout(() => {
      setReexporting(false);
      setReexportDone(formatKey);
    }, 1500);
  }, [reexportAsset]);

  const handleStatusChange = useCallback(async (status: UploadStatus) => {
    if (!statusPickerAsset) return;
    const shareUrl = status === 'uploaded' ? shareUrlInput.trim() || null : null;
    const success = await updateAssetUploadStatus(statusPickerAsset.id, status, shareUrl);
    if (success) {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === statusPickerAsset.id
            ? { ...a, upload_status: status, share_url: shareUrl }
            : a,
        ),
      );
      setStatusPickerAsset(null);
      setShareUrlInput('');
    } else {
      Alert.alert('오류', '상태 업데이트에 실패했어요.');
    }
  }, [statusPickerAsset, shareUrlInput]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <LoadingScreen message="제작물을 불러오는 중..." />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <Text style={styles.headerTitle}>내 제작물</Text>
        <Text style={styles.headerSubtext}>
          {assets.length}개의 저장된 결과물
        </Text>
      </View>

      <Text style={styles.helpText}>
        템플릿 카드와 동영상 클립을 클라우드에 저장하면 여기서 언제든 다시 불러올 수 있어요. 플랫폼별 재내보내기와 업로드 상태 관리도 가능합니다.
      </Text>

      {assets.length === 0 ? (
        <View style={styles.emptyState}>
          <FolderOpen size={56} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>아직 저장된 제작물이 없습니다</Text>
          <Text style={styles.emptyText}>
            결과 화면에서 '클라우드에 저장' 버튼을 누르면 템플릿 이미지와 동영상이 여기에 저장됩니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary[400]} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 24 }]}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => {
            const statusMeta = STATUS_META[item.upload_status || 'not_uploaded'];
            const StatusIcon = statusMeta.icon;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setPreviewAsset(item)}
              >
                <View style={styles.thumbWrap}>
                  {item.asset_type === 'video' ? (
                    <>
                      <Image
                        source={{ uri: item.thumbnail_url || item.file_url }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                      <View style={styles.videoBadge}>
                        <Film size={10} color="#fff" strokeWidth={2} />
                        <Text style={styles.videoBadgeText}>영상</Text>
                      </View>
                    </>
                  ) : (
                    <Image
                      source={{ uri: item.file_url }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                    <StatusIcon size={9} color={statusMeta.color} strokeWidth={2} />
                    <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.cardMeta}>
                    <Calendar size={9} color={theme.colors.dark.textFaint} strokeWidth={2} />
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  {item.file_size ? (
                    <Text style={styles.cardSize}>{formatSize(item.file_size)}</Text>
                  ) : null}
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setReexportAsset(item)}
                    activeOpacity={0.7}
                  >
                    <Crop size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      setStatusPickerAsset(item);
                      setShareUrlInput(item.share_url || '');
                    }}
                    activeOpacity={0.7}
                  >
                    <Share2 size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDownload(item)}
                    activeOpacity={0.7}
                  >
                    <Download size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={theme.colors.error[400]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Preview Modal */}
      <Modal
        visible={!!previewAsset}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewAsset(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPreviewAsset(null)}
              activeOpacity={0.7}
            >
              <X size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>

            {previewAsset && (
              <>
                <Text style={styles.modalTitle}>{previewAsset.title}</Text>
                <View style={styles.modalMetaRow}>
                  <View style={styles.modalTypeBadge}>
                    {previewAsset.asset_type === 'video' ? (
                      <Film size={11} color="#fff" strokeWidth={2} />
                    ) : (
                      <ImageIcon size={11} color="#fff" strokeWidth={2} />
                    )}
                    <Text style={styles.modalTypeText}>
                      {previewAsset.asset_type === 'video' ? '동영상' : '이미지'}
                    </Text>
                  </View>
                  <Text style={styles.modalDate}>{formatDate(previewAsset.created_at)}</Text>
                  {previewAsset.upload_status && previewAsset.upload_status !== 'not_uploaded' && (
                    <View style={[styles.modalStatusBadge, { backgroundColor: STATUS_META[previewAsset.upload_status].bg }]}>
                      {(() => {
                        const M = STATUS_META[previewAsset.upload_status];
                        const Icon = M.icon;
                        return <Icon size={10} color={M.color} strokeWidth={2} />;
                      })()}
                      <Text style={[styles.modalStatusText, { color: STATUS_META[previewAsset.upload_status].color }]}>
                        {STATUS_META[previewAsset.upload_status].label}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.previewWrap}>
                  {previewAsset.asset_type === 'video' && Platform.OS === 'web' ? (
                    // @ts-ignore video element on web
                    <video
                      src={previewAsset.file_url}
                      style={styles.previewVideo}
                      controls
                      autoPlay
                      loop
                      playsInline
                    />
                  ) : (
                    <Image
                      source={{ uri: previewAsset.asset_type === 'video' ? (previewAsset.thumbnail_url || previewAsset.file_url) : previewAsset.file_url }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  )}
                </View>

                {previewAsset.file_size ? (
                  <Text style={styles.modalSize}>파일 크기: {formatSize(previewAsset.file_size)}</Text>
                ) : null}

                {previewAsset.share_url ? (
                  <TouchableOpacity
                    style={styles.shareLinkRow}
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        window.open(previewAsset.share_url!, '_blank');
                      } else {
                        Linking.openURL(previewAsset.share_url!).catch(() => {});
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Link2 size={13} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.shareLinkText} numberOfLines={1}>{previewAsset.share_url}</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalReexportBtn}
                    onPress={() => {
                      setReexportAsset(previewAsset);
                      setPreviewAsset(null);
                    }}
                    activeOpacity={0.8}
                  >
                    <Crop size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.modalReexportText}>재내보내기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDownloadBtn}
                    onPress={() => handleDownload(previewAsset)}
                    activeOpacity={0.8}
                  >
                    <Download size={16} color="#fff" strokeWidth={2} />
                    <Text style={styles.modalDownloadText}>다운로드</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalDeleteBtn}
                    onPress={() => {
                      handleDelete(previewAsset);
                      setPreviewAsset(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={theme.colors.error[400]} strokeWidth={2} />
                    <Text style={styles.modalDeleteText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Re-export Modal */}
      <Modal
        visible={!!reexportAsset}
        transparent
        animationType="fade"
        onRequestClose={() => { setReexportAsset(null); setReexportDone(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reexportModalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => { setReexportAsset(null); setReexportDone(null); }}
              activeOpacity={0.7}
            >
              <X size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.reexportHeader}>
              <View style={styles.reexportHeaderIcon}>
                <Crop size={24} color={theme.colors.accent[400]} strokeWidth={2} />
              </View>
              <Text style={styles.reexportTitle}>플랫폼별 재내보내기</Text>
              <Text style={styles.reexportSubtitle}>
                '{reexportAsset?.title}'을(를) 다른 플랫폼 규격으로 자동 재가공합니다
              </Text>
            </View>

            {reexportDone ? (
              <View style={styles.reexportDoneCard}>
                <CheckCircle2 size={32} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.reexportDoneTitle}>재가공 완료!</Text>
                <Text style={styles.reexportDoneDesc}>
                  {REEXPORT_FORMATS.find((f) => f.key === reexportDone)?.label} 규격으로 변환되었습니다
                </Text>
                <TouchableOpacity
                  style={styles.reexportDoneBtn}
                  onPress={() => { setReexportAsset(null); setReexportDone(null); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.reexportDoneBtnText}>확인</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.reexportFormatList}>
                {REEXPORT_FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  return (
                    <TouchableOpacity
                      key={fmt.key}
                      style={styles.reexportFormatCard}
                      onPress={() => handleReexport(fmt.key)}
                      disabled={reexporting}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.reexportFormatIcon, { backgroundColor: fmt.color + '20' }]}>
                        <Icon size={20} color={fmt.color} strokeWidth={2} />
                      </View>
                      <View style={styles.reexportFormatInfo}>
                        <Text style={styles.reexportFormatLabel}>{fmt.label}</Text>
                        <Text style={styles.reexportFormatRatio}>비율 {fmt.ratio}</Text>
                      </View>
                      {reexporting ? (
                        <Text style={styles.reexportProcessingText}>처리 중...</Text>
                      ) : (
                        <Crop size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Status Picker Modal */}
      <Modal
        visible={!!statusPickerAsset}
        transparent
        animationType="fade"
        onRequestClose={() => { setStatusPickerAsset(null); setShareUrlInput(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => { setStatusPickerAsset(null); setShareUrlInput(''); }}
              activeOpacity={0.7}
            >
              <X size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.statusHeader}>
              <View style={styles.statusHeaderIcon}>
                <Share2 size={24} color={theme.colors.warning[400]} strokeWidth={2} />
              </View>
              <Text style={styles.statusTitle}>게시 상태 관리</Text>
              <Text style={styles.statusSubtitle} numberOfLines={1}>
                '{statusPickerAsset?.title}'
              </Text>
            </View>

            <View style={styles.statusOptions}>
              {(['not_uploaded', 'scheduled', 'uploaded'] as UploadStatus[]).map((status) => {
                const meta = STATUS_META[status];
                const Icon = meta.icon;
                const isActive = statusPickerAsset?.upload_status === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusOptionCard, isActive && { borderColor: meta.color, backgroundColor: meta.bg }]}
                    onPress={() => handleStatusChange(status)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusOptionIcon, { backgroundColor: meta.color + '20' }]}>
                      <Icon size={18} color={meta.color} strokeWidth={2} />
                    </View>
                    <View style={styles.statusOptionInfo}>
                      <Text style={[styles.statusOptionLabel, isActive && { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {isActive && <CheckCircle2 size={18} color={meta.color} strokeWidth={2} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.shareUrlLabel}>게시 링크 (업로드 완료 시)</Text>
            <TextInput
              style={styles.shareUrlInput}
              value={shareUrlInput}
              onChangeText={setShareUrlInput}
              placeholder="https://youtube.com/shorts/..."
              placeholderTextColor={theme.colors.dark.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <TouchableOpacity
              style={styles.statusSaveBtn}
              onPress={() => handleStatusChange(statusPickerAsset?.upload_status === 'uploaded' ? 'uploaded' : 'uploaded')}
              activeOpacity={0.8}
            >
              <Text style={styles.statusSaveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.title,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
  },
  helpText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  columnWrapper: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  videoBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  statusBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  cardBody: {
    padding: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardDate: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  cardSize: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    gap: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  modalClose: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: theme.spacing.sm,
    paddingRight: 40,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  modalTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  modalTypeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  modalDate: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
  },
  modalStatusText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  previewWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  previewImage: {
    width: '100%',
    maxHeight: 400,
    borderRadius: theme.radius.md,
  },
  previewVideo: {
    width: '100%',
    maxHeight: 400,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
  },
  modalSize: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginBottom: theme.spacing.sm,
  },
  shareLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[500] + '10',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: theme.spacing.md,
  },
  shareLinkText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  modalReexportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '15',
  },
  modalReexportText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  modalDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  modalDownloadText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
  },
  modalDeleteText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  // Re-export modal styles
  reexportModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  reexportHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  reexportHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reexportTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  reexportSubtitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 18,
  },
  reexportFormatList: {
    gap: 10,
  },
  reexportFormatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 14,
  },
  reexportFormatIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reexportFormatInfo: {
    flex: 1,
  },
  reexportFormatLabel: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  reexportFormatRatio: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  reexportProcessingText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
  },
  reexportDoneCard: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: theme.spacing.lg,
  },
  reexportDoneTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  reexportDoneDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  reexportDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
    marginTop: theme.spacing.sm,
  },
  reexportDoneBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  // Status picker modal styles
  statusModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.elevated,
  },
  statusHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  statusHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  statusSubtitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  statusOptions: {
    gap: 10,
    marginBottom: theme.spacing.lg,
  },
  statusOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  statusOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOptionInfo: {
    flex: 1,
  },
  statusOptionLabel: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  shareUrlLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 6,
  },
  shareUrlInput: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    marginBottom: theme.spacing.lg,
  },
  statusSaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
  },
  statusSaveBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
