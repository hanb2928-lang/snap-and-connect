import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ViewStyle,
} from 'react-native';
import {
  Pencil,
  Check,
  X,
  Flame,
  Tag,
  Link2,
  ShoppingCart,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  Share2,
  CircleCheck as CheckCircle2,
  CircleAlert,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';

export interface QuickTweakProps {
  hook: string;
  productName: string;
  priceEstimate: string;
  affiliateUrl: string | null;
  affiliateLabel: string;
  shortUrl: string | null;
  onHookChange: (hook: string) => void;
  onProductNameChange: (name: string) => void;
  onPriceChange: (price: string) => void;
  onAffiliateChange: (url: string, label: string) => void;
  onSaveAndShare: () => void;
}

type EditField = 'hook' | 'product' | 'price' | 'link' | null;

export function QuickTweakPanel({
  hook,
  productName,
  priceEstimate,
  affiliateUrl,
  affiliateLabel,
  shortUrl,
  onHookChange,
  onProductNameChange,
  onPriceChange,
  onAffiliateChange,
  onSaveAndShare,
}: QuickTweakProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingField, setEditingField] = useState<EditField>(null);
  const [hookInput, setHookInput] = useState(hook);
  const [productInput, setProductInput] = useState(productName);
  const [priceInput, setPriceInput] = useState(priceEstimate);
  const [linkUrlInput, setLinkUrlInput] = useState(affiliateUrl || '');
  const [linkLabelInput, setLinkLabelInput] = useState(affiliateLabel || '');
  const [savedField, setSavedField] = useState<EditField>(null);

  const startEdit = useCallback((field: EditField) => {
    setEditingField(field);
    setHookInput(hook);
    setProductInput(productName);
    setPriceInput(priceEstimate);
    setLinkUrlInput(affiliateUrl || '');
    setLinkLabelInput(affiliateLabel || '');
  }, [hook, productName, priceEstimate, affiliateUrl, affiliateLabel]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const confirmEdit = useCallback((field: EditField) => {
    if (field === 'hook') {
      onHookChange(hookInput.trim());
    } else if (field === 'product') {
      onProductNameChange(productInput.trim());
    } else if (field === 'price') {
      onPriceChange(priceInput.trim());
    } else if (field === 'link') {
      onAffiliateChange(linkUrlInput.trim(), linkLabelInput.trim());
    }
    setEditingField(null);
    setSavedField(field);
    setTimeout(() => setSavedField(null), 2000);
  }, [hookInput, productInput, priceInput, linkUrlInput, linkLabelInput, onHookChange, onProductNameChange, onPriceChange, onAffiliateChange]);

  const hasAllContent = !!(hook && productName);
  const hasLink = !!affiliateUrl;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Sparkles size={15} color={theme.colors.accent[400]} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>미리보기 및 Quick-Tweak</Text>
            <Text style={styles.headerSubtitle}>내보내기 전 최종 검수 및 미세 수정</Text>
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
        ) : (
          <ChevronDown size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Sync status badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.syncBadge, hasAllContent ? styles.syncOk : styles.syncWarn]}>
              {hasAllContent ? (
                <CheckCircle2 size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
              ) : (
                <CircleAlert size={12} color={theme.colors.warning[400]} strokeWidth={2.5} />
              )}
              <Text style={[styles.syncBadgeText, hasAllContent ? styles.syncTextOk : styles.syncTextWarn]}>
                {hasAllContent ? '싱크로율 양호' : '정보 누락'}
              </Text>
            </View>
            <View style={[styles.syncBadge, hasLink ? styles.syncOk : styles.syncWarn]}>
              {hasLink ? (
                <CheckCircle2 size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
              ) : (
                <CircleAlert size={12} color={theme.colors.warning[400]} strokeWidth={2.5} />
              )}
              <Text style={[styles.syncBadgeText, hasLink ? styles.syncTextOk : styles.syncTextWarn]}>
                {hasLink ? '제휴 링크 연결됨' : '링크 미연결'}
              </Text>
            </View>
          </View>

          {/* Hook text row */}
          <View style={styles.tweakRow}>
            <View style={styles.tweakIconWrap}>
              <Flame size={14} color={theme.colors.warning[400]} strokeWidth={2} />
            </View>
            <View style={styles.tweakContent}>
              <Text style={styles.tweakLabel}>매장 홍보 훅 문구</Text>
              {editingField === 'hook' ? (
                <View style={styles.editWrap}>
                  <TextInput
                    style={styles.editInput}
                    value={hookInput}
                    onChangeText={setHookInput}
                    placeholder="후킹 문구 입력"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    multiline
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} activeOpacity={0.7}>
                      <X size={13} color={theme.colors.dark.textDim} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editConfirmBtn} onPress={() => confirmEdit('hook')} activeOpacity={0.7}>
                      <Check size={13} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.tweakDisplay}
                  onPress={() => startEdit('hook')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tweakValue} numberOfLines={2}>
                    {hook || '(미설정) 터치해서 입력'}
                  </Text>
                  {savedField === 'hook' ? (
                    <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
                  ) : (
                    <Pencil size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Product name row */}
          <View style={styles.tweakRow}>
            <View style={styles.tweakIconWrap}>
              <Tag size={14} color={theme.colors.primary[300]} strokeWidth={2} />
            </View>
            <View style={styles.tweakContent}>
              <Text style={styles.tweakLabel}>상품명</Text>
              {editingField === 'product' ? (
                <View style={styles.editWrap}>
                  <TextInput
                    style={styles.editInput}
                    value={productInput}
                    onChangeText={setProductInput}
                    placeholder="상품명 입력"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} activeOpacity={0.7}>
                      <X size={13} color={theme.colors.dark.textDim} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editConfirmBtn} onPress={() => confirmEdit('product')} activeOpacity={0.7}>
                      <Check size={13} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.tweakDisplay}
                  onPress={() => startEdit('product')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tweakValue} numberOfLines={1}>
                    {productName || '(미설정) 터치해서 입력'}
                  </Text>
                  {savedField === 'product' ? (
                    <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
                  ) : (
                    <Pencil size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Price row */}
          <View style={styles.tweakRow}>
            <View style={styles.tweakIconWrap}>
              <ShoppingCart size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            </View>
            <View style={styles.tweakContent}>
              <Text style={styles.tweakLabel}>특가 금액</Text>
              {editingField === 'price' ? (
                <View style={styles.editWrap}>
                  <TextInput
                    style={styles.editInput}
                    value={priceInput}
                    onChangeText={setPriceInput}
                    placeholder="예: 19,900원"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    autoFocus
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} activeOpacity={0.7}>
                      <X size={13} color={theme.colors.dark.textDim} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editConfirmBtn} onPress={() => confirmEdit('price')} activeOpacity={0.7}>
                      <Check size={13} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.tweakDisplay}
                  onPress={() => startEdit('price')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tweakValue} numberOfLines={1}>
                    {priceEstimate || '(미설정) 터치해서 입력'}
                  </Text>
                  {savedField === 'price' ? (
                    <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
                  ) : (
                    <Pencil size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Affiliate link row */}
          <View style={styles.tweakRow}>
            <View style={styles.tweakIconWrap}>
              <Link2 size={14} color={theme.colors.success[400]} strokeWidth={2} />
            </View>
            <View style={styles.tweakContent}>
              <Text style={styles.tweakLabel}>제휴 상품 / 링크</Text>
              {editingField === 'link' ? (
                <View style={styles.editWrap}>
                  <TextInput
                    style={styles.editInput}
                    value={linkUrlInput}
                    onChangeText={setLinkUrlInput}
                    placeholder="제휴 링크 URL"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    autoFocus
                  />
                  <TextInput
                    style={[styles.editInput, styles.editInputLabel]}
                    value={linkLabelInput}
                    onChangeText={setLinkLabelInput}
                    placeholder="링크 표시 이름 (선택)"
                    placeholderTextColor={theme.colors.dark.textFaint}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} activeOpacity={0.7}>
                      <X size={13} color={theme.colors.dark.textDim} strokeWidth={2.5} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editConfirmBtn} onPress={() => confirmEdit('link')} activeOpacity={0.7}>
                      <Check size={13} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.tweakDisplay}
                  onPress={() => startEdit('link')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tweakValue, !hasLink && styles.tweakValueEmpty]} numberOfLines={1}>
                    {hasLink
                      ? (affiliateLabel || affiliateUrl || '링크 연결됨')
                      : '(미연결) 터치해서 제휴 링크 입력'}
                  </Text>
                  {savedField === 'link' ? (
                    <Check size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
                  ) : (
                    <Pencil size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Short URL display */}
          {shortUrl && (
            <View style={styles.shortUrlRow}>
              <Link2 size={12} color={theme.colors.primary[300]} strokeWidth={2} />
              <Text style={styles.shortUrlText} numberOfLines={1}>단축 URL: {shortUrl}</Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.saveShareBtn}
              onPress={onSaveAndShare}
              activeOpacity={0.8}
            >
              <Share2 size={15} color="#fff" strokeWidth={2.5} />
              <Text style={styles.saveShareText}>저장 후 공유하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    ...theme.shadows.card,
    overflow: 'hidden',
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 1,
  },
  body: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  syncOk: {
    backgroundColor: theme.colors.success[500] + '15',
  },
  syncWarn: {
    backgroundColor: theme.colors.warning[500] + '15',
  },
  syncBadgeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  syncTextOk: {
    color: theme.colors.success[400],
  },
  syncTextWarn: {
    color: theme.colors.warning[400],
  },
  tweakRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tweakIconWrap: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  tweakContent: {
    flex: 1,
  },
  tweakLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  tweakDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tweakValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
    lineHeight: 19,
  },
  tweakValueEmpty: {
    color: theme.colors.dark.textFaint,
    fontStyle: 'italic',
  },
  editWrap: {
    gap: 6,
  },
  editInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
    minHeight: Platform.OS === 'web' ? 36 : 40,
  },
  editInputLabel: {
    minHeight: 34,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  editCancelBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editConfirmBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.primary[500] + '10',
    borderRadius: theme.radius.sm,
  },
  shortUrlText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  actionRow: {
    marginTop: 4,
  },
  saveShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
    ...theme.shadows.glowPrimary,
  },
  saveShareText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
