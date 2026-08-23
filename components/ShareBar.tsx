import { View, Text, StyleSheet, TouchableOpacity, Share, Platform, Linking } from 'react-native';
import { Copy, Check, PlayCircle, Clapperboard, Download, CloudUpload, Loader2, Instagram, MessageCircle, Globe, ClipboardCheck, ChevronDown, Share2 } from 'lucide-react-native';
import { useRef, useState, useCallback } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, Easing } from 'react-native-reanimated';
import { theme } from '@/lib/theme';
import { getShareDisclosureForPlatforms } from '@/lib/disclosure';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { uploadAssetBlob, saveAssetRecord } from '@/lib/savedAssets';

interface ShareBarProps {
  cardRef: React.RefObject<View | null>;
  shareText: string;
  affiliateUrl: string | null;
  shortUrl?: string | null;
  fileName: string;
  affiliatePlatforms?: string[];
}

export function ShareBar({ cardRef, shareText, affiliateUrl, shortUrl, fileName, affiliatePlatforms = [] }: ShareBarProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const toastAnim = useSharedValue(0);
  const accordionHeight = useSharedValue(0);
  const accordionOpacity = useSharedValue(0);
  const chevronRot = useSharedValue(0);

  const toggleShareAccordion = useCallback(() => {
    const next = !shareOpen;
    setShareOpen(next);
    chevronRot.value = withTiming(next ? 180 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
    accordionHeight.value = withTiming(next ? 180 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
    accordionOpacity.value = withTiming(next ? 1 : 0, { duration: next ? 250 : 150, easing: Easing.out(Easing.cubic) });
  }, [shareOpen, chevronRot, accordionHeight, accordionOpacity]);

  const accordionContentStyle = useAnimatedStyle(() => ({
    height: accordionHeight.value,
    opacity: accordionOpacity.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        fileName,
      });
      return uri;
    } catch {
      return null;
    }
  }, [cardRef, fileName]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastAnim.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.2)) }),
    );
    setTimeout(() => {
      toastAnim.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
      setTimeout(() => setToast(null), 450);
    }, 3500);
  }, [toastAnim]);

  const handleSaveToGallery = useCallback(async () => {
    setSharing(true);
    try {
      const uri = await captureCard();
      if (!uri) {
        showToast('이미지 캡처에 실패했어요');
        setSharing(false);
        return;
      }
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = uri;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('이미지를 다운로드했어요');
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          showToast('사진 접근 권한이 필요해요. 설정에서 허용해주세요');
          setSharing(false);
          return;
        }
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('숏커넥트', asset, false);
        showToast('갤러리에 저장됐어요');
      }
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setSharing(false);
  }, [captureCard, showToast, fileName]);

  const copyImageToClipboard = useCallback(async (uri: string): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      // @ts-ignore ClipboardItem is web-only
      const item = new ClipboardItem({ 'image/png': blob });
      // @ts-ignore navigator.clipboard.write is web-only
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      return false;
    }
  }, []);

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleNaverShare = useCallback(async (platform: 'naverclip' | 'navertv') => {
    setSharing(true);
    const uri = await captureCard();
    setSharing(false);

    const disclosureText = getShareDisclosureForPlatforms(affiliatePlatforms);
    const shareLink = shortUrl || affiliateUrl;
    const linkLine = shareLink && !shareText.includes(shareLink) ? `\n\n${shareLink}` : '';
    const fullText = `${shareText}${linkLine}\n\n${disclosureText}`;

    const siteUrls: Record<string, string> = {
      naverclip: 'https://clip.naver.com',
      navertv: 'https://tv.naver.com',
    };

    let imageCopied = false;
    let textCopied = false;

    if (Platform.OS === 'web') {
      if (uri) {
        imageCopied = await copyImageToClipboard(uri);
        if (imageCopied) {
          await new Promise((r) => setTimeout(r, 300));
          textCopied = await copyTextToClipboard(fullText);
        } else {
          textCopied = await copyTextToClipboard(fullText);
        }
      } else {
        textCopied = await copyTextToClipboard(fullText);
      }

      if (imageCopied && textCopied) {
        showToast('홍보 문구와 이미지가 복사됐어요!\n네이버에서 붙여넣기(Ctrl+V)만 하세요');
      } else if (imageCopied) {
        showToast('이미지가 복사됐어요!\n네이버에서 붙여넣기(Ctrl+V)만 하세요');
      } else if (textCopied) {
        showToast('홍보 문구가 복사됐어요!\n이미지는 아래 버튼으로 저장 후 업로드하세요');
      } else {
        showToast('복사 실패. 수동으로 업로드해주세요');
      }
    } else {
      if (uri) {
        try {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share to Naver',
          });
        } catch {
          await Share.share({ message: fullText });
        }
      } else {
        await Share.share({ message: fullText });
      }
    }

    if (Platform.OS === 'web') {
      window.open(siteUrls[platform], '_blank');
    } else {
      Linking.openURL(siteUrls[platform]).catch(() => {});
    }
  }, [captureCard, shareText, affiliateUrl, shortUrl, affiliatePlatforms, copyImageToClipboard, copyTextToClipboard, showToast]);

  const handleSaveToCloud = useCallback(async () => {
    setCloudSaving(true);
    try {
      const uri = await captureCard();
      if (!uri) {
        showToast('이미지 캡처에 실패했어요');
        setCloudSaving(false);
        return;
      }

      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        const cloudFileName = fileName.replace(/\.png$/, '') + '-' + Date.now() + '.png';
        const fileUrl = await uploadAssetBlob(blob, cloudFileName, 'image/png');
        if (!fileUrl) {
          showToast('클라우드 업로드에 실패했어요');
          setCloudSaving(false);
          return;
        }
        await saveAssetRecord({
          scan_id: null,
          asset_type: 'image',
          title: '템플릿 카드',
          file_url: fileUrl,
          file_name: cloudFileName,
          file_size: blob.size,
          mime_type: 'image/png',
          platform: affiliatePlatforms[0] || null,
          affiliate_platform: affiliatePlatforms[0] || null,
        });
        showToast('클라우드에 저장됐어요. 내 제작물 탭에서 확인하세요');
      } else {
        showToast('클라우드 저장은 웹에서만 가능해요. 갤러리 저장을 이용하세요');
      }
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setCloudSaving(false);
  }, [captureCard, fileName, affiliatePlatforms, showToast]);

  const handleInstagramShare = useCallback(async () => {
    setSharing(true);
    const uri = await captureCard();
    const disclosureText = getShareDisclosureForPlatforms(affiliatePlatforms);
    const shareLink = shortUrl || affiliateUrl;
    const linkLine = shareLink && !shareText.includes(shareLink) ? `\n\n${shareLink}` : '';
    const fullText = `${shareText}${linkLine}\n\n${disclosureText}`;

    if (Platform.OS === 'web') {
      if (uri) {
        await copyImageToClipboard(uri);
        await new Promise((r) => setTimeout(r, 200));
        await copyTextToClipboard(fullText);
      } else {
        await copyTextToClipboard(fullText);
      }
      window.open('https://www.instagram.com', '_blank');
      showToast('홍보 문구와 이미지가 클립보드에 복사됐어요!\n인스타에서 붙여넣기(Ctrl+V)하세요');
    } else {
      if (uri) {
        try {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share to Instagram' });
        } catch {
          await Share.share({ message: fullText });
        }
      } else {
        await Share.share({ message: fullText });
      }
    }
    setSharing(false);
  }, [captureCard, shareText, affiliateUrl, shortUrl, affiliatePlatforms, copyImageToClipboard, copyTextToClipboard, showToast]);

  const handleKakaoShare = useCallback(async () => {
    setSharing(true);
    const uri = await captureCard();
    const disclosureText = getShareDisclosureForPlatforms(affiliatePlatforms);
    const shareLink = shortUrl || affiliateUrl;
    const linkLine = shareLink && !shareText.includes(shareLink) ? `\n\n${shareLink}` : '';
    const fullText = `${shareText}${linkLine}\n\n${disclosureText}`;

    if (Platform.OS === 'web') {
      await copyTextToClipboard(fullText);
      if (uri) await copyImageToClipboard(uri);
      window.open('https://accounts.kakao.com/weblogin/share', '_blank');
      showToast('홍보 문구가 클립보드에 복사됐어요!\n카카오톡에서 붙여넣기하세요');
    } else {
      if (uri) {
        try {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share to KakaoTalk' });
        } catch {
          await Share.share({ message: fullText });
        }
      } else {
        await Share.share({ message: fullText });
      }
    }
    setSharing(false);
  }, [captureCard, shareText, affiliateUrl, shortUrl, affiliatePlatforms, copyTextToClipboard, copyImageToClipboard, showToast]);

  const handleBlogShare = useCallback(async () => {
    setSharing(true);
    const uri = await captureCard();
    const disclosureText = getShareDisclosureForPlatforms(affiliatePlatforms);
    const shareLink = shortUrl || affiliateUrl;
    const linkLine = shareLink && !shareText.includes(shareLink) ? `\n\n${shareLink}` : '';
    const fullText = `${shareText}${linkLine}\n\n${disclosureText}`;

    if (Platform.OS === 'web') {
      if (uri) {
        await copyImageToClipboard(uri);
        await new Promise((r) => setTimeout(r, 200));
        await copyTextToClipboard(fullText);
      } else {
        await copyTextToClipboard(fullText);
      }
      window.open('https://blog.naver.com', '_blank');
      showToast('홍보 문구와 이미지가 클립보드에 복사됐어요!\n블로그에서 붙여넣기(Ctrl+V)하세요');
    } else {
      if (uri) {
        try {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share to Blog' });
        } catch {
          await Share.share({ message: fullText });
        }
      } else {
        await Share.share({ message: fullText });
      }
    }
    setSharing(false);
  }, [captureCard, shareText, affiliateUrl, shortUrl, affiliatePlatforms, copyImageToClipboard, copyTextToClipboard, showToast]);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastAnim.value,
    transform: [{ translateY: (1 - toastAnim.value) * -10 }],
  }));

  const handleCopyLink = useCallback(async () => {
    const linkToCopy = shortUrl || affiliateUrl;
    if (!linkToCopy) return;
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(linkToCopy);
      } else {
        await Clipboard.setStringAsync(linkToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('링크 복사에 실패했어요');
    }
  }, [shortUrl, affiliateUrl, showToast]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggleShareAccordion}
        activeOpacity={0.7}
      >
        <View style={styles.accordionHeaderLeft}>
          <View style={styles.accordionIconWrap}>
            <Share2 size={16} color={theme.colors.accent[400]} strokeWidth={2} />
          </View>
          <Text style={styles.accordionTitle}>SNS 원터치 공유</Text>
        </View>
        <View style={styles.accordionRight}>
          <Text style={styles.accordionCount}>{shareOpen ? '접기' : '펼치기'}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      <Animated.View style={[styles.accordionContent, accordionContentStyle]} pointerEvents={shareOpen ? 'auto' : 'none'}>
        <View style={styles.buttonRow}>
          <ShareButton
            icon={<Clapperboard size={22} color="#fff" strokeWidth={2} />}
            bg="#03C75A"
            label="네이버클립"
            onPress={() => handleNaverShare('naverclip')}
            disabled={sharing}
          />
          <ShareButton
            icon={<PlayCircle size={22} color="#fff" strokeWidth={2} />}
            bg="#E6252C"
            label="네이버TV"
            onPress={() => handleNaverShare('navertv')}
            disabled={sharing}
          />
          <ShareButton
            icon={<Instagram size={22} color="#fff" strokeWidth={2} />}
            bg="#E1306C"
            label="인스타"
            onPress={handleInstagramShare}
            disabled={sharing}
          />
          <ShareButton
            icon={<MessageCircle size={22} color="#fff" strokeWidth={2} />}
            bg="#FEE500"
            label="카카오톡"
            onPress={handleKakaoShare}
            disabled={sharing}
          />
          <ShareButton
            icon={<Globe size={22} color="#fff" strokeWidth={2} />}
            bg="#2DB400"
            label="블로그"
            onPress={handleBlogShare}
            disabled={sharing}
          />
        </View>
      </Animated.View>

      {(shortUrl || affiliateUrl) ? (
        <TouchableOpacity style={styles.copyButton} onPress={handleCopyLink} activeOpacity={0.7}>
          {copied ? (
            <Check size={16} color={theme.colors.success[400]} strokeWidth={2} />
          ) : (
            <Copy size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          )}
          <Text style={[styles.copyText, copied && { color: theme.colors.success[400] }]}>
            {copied ? '링크 복사됨!' : '제휴 링크 복사'}
          </Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        style={styles.galleryButton}
        onPress={handleSaveToGallery}
        disabled={sharing}
        activeOpacity={0.7}
      >
        <Download size={16} color={theme.colors.dark.text} strokeWidth={2} />
        <Text style={styles.galleryButtonText}>
          {sharing ? '저장 중...' : '갤러리에 저장'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cloudButton}
        onPress={handleSaveToCloud}
        disabled={cloudSaving}
        activeOpacity={0.7}
      >
        {cloudSaving ? (
          <Loader2 size={16} color={theme.colors.primary[300]} strokeWidth={2} />
        ) : (
          <CloudUpload size={16} color={theme.colors.primary[300]} strokeWidth={2} />
        )}
        <Text style={styles.cloudButtonText}>
          {cloudSaving ? '저장 중...' : '클라우드에 저장'}
        </Text>
      </TouchableOpacity>
      {toast && (
        <Animated.View style={[styles.toastPopup, toastStyle]} pointerEvents="none">
          <View style={styles.toastIconWrap}>
            <ClipboardCheck size={20} color="#fff" strokeWidth={2.5} />
          </View>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function ShareButton({
  icon,
  bg,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.shareButton}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.shareIcon, { backgroundColor: bg }]}>
        {icon}
      </View>
      <Text style={styles.shareLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.card,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accordionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accordionTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  accordionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accordionCount: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  accordionContent: {
    overflow: 'hidden',
  },
  label: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: theme.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  shareButton: {
    alignItems: 'center',
    gap: 6,
  },
  shareIcon: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  copyText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '20',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '40',
  },
  galleryButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  cloudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  cloudButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  toastPopup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.success[400],
    ...theme.shadows.elevated,
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    flex: 1,
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    lineHeight: 22,
  },
});
