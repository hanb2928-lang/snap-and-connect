import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { QrCode, Receipt, TrendingUp, Download, ArrowRight, Star } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { fetchReviews, type CustomerReview } from '@/lib/reviewAutomation';
import { setItem } from '@/lib/storage';

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function QrReviewDashboard() {
  const router = useRouter();
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulseAnim] = useState(new Animated.Value(0));

  const loadReviews = useCallback(async () => {
    try {
      const data = await fetchReviews();
      setReviews(data);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
    const interval = setInterval(loadReviews, 30000);
    return () => clearInterval(interval);
  }, [loadReviews]);

  useEffect(() => {
    if (loading) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [loading, pulseAnim]);

  const todayReviews = reviews.filter((r) => isToday(r.created_at));
  const todayCount = todayReviews.length;
  const completedReels = reviews.filter((r) => r.reel_status === 'completed').length;
  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : '—';

  const handleDownloadQrBanner = () => {
    if (Platform.OS !== 'web') return;
    const qrContent = 'https://snapconnect.app/review/table1';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrContent)}`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
      <head><title>테이블 QR 배너 - 숏커넥트</title>
      <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; font-family: system-ui, sans-serif; }
        .banner { width: 480px; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #2563eb, #06b6d4); padding: 28px 24px 20px; text-align: center; }
        .header h1 { color: white; font-size: 22px; margin: 0; font-weight: 800; }
        .header p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0; }
        .qr-area { padding: 28px; text-align: center; }
        .qr-area img { width: 280px; height: 280px; }
        .cta { padding: 0 28px 24px; text-align: center; }
        .cta h2 { font-size: 18px; color: #1e293b; margin: 0 0 6px; }
        .cta p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.5; }
        .footer { padding: 16px 24px; background: #f1f5f9; text-align: center; }
        .footer span { font-size: 11px; color: #94a3b8; }
        @media print { body { background: white; } .banner { box-shadow: none; } }
      </style>
      </head>
      <body>
        <div class="banner">
          <div class="header">
            <h1>한 줄 평 남기고 서비스 받아가세요!</h1>
            <p>QR을 스캔하면 5초 만에 완료</p>
          </div>
          <div class="qr-area">
            <img src="${qrUrl}" alt="QR Code" />
          </div>
          <div class="cta">
            <h2>이 매장의 진짜 맛 평가</h2>
            <p>손님들의 한 줄 평이 자동으로 릴스로 만들어져요.<br/>오늘의 리뷰 왕이 되어보세요!</p>
          </div>
          <div class="footer">
            <span>Powered by 숏커넥트</span>
          </div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  const handleViewAll = async () => {
    await setItem('marketing_voice_command_active', 'false');
    router.push('/(tabs)/affiliate/assets' as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <QrCode size={20} color={theme.colors.primary[300]} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>오프라인 테이블 QR 스캔 현황</Text>
            <Text style={styles.subtitle}>손님 QR 리뷰 → 자동 릴스 제작 현황</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Animated.View
            style={[
              styles.statGlow,
              {
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.7],
                }),
              },
            ]}
          />
          <Text style={styles.statNum}>{loading ? '…' : todayCount}</Text>
          <Text style={styles.statLabel}>오늘 리뷰</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Receipt size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={[styles.statNum, { color: theme.colors.success[400] }]}>
            {loading ? '…' : completedReels}
          </Text>
          <Text style={styles.statLabel}>릴스 완료</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Star size={14} color={theme.colors.warning[400]} strokeWidth={2.5} fill={theme.colors.warning[400]} />
          <Text style={[styles.statNum, { color: theme.colors.warning[400] }]}>
            {loading ? '—' : avgRating}
          </Text>
          <Text style={styles.statLabel}>평균 평점</Text>
        </View>
      </View>

      {todayCount > 0 && (
        <View style={styles.todayHighlight}>
          <TrendingUp size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={styles.todayHighlightText}>
            오늘 리뷰 {todayCount}건 달성! QR 배너를 매장에 비치해보세요
          </Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.downloadBtn}
          onPress={handleDownloadQrBanner}
          activeOpacity={0.85}
        >
          <Download size={16} color="#fff" strokeWidth={2.5} />
          <Text style={styles.downloadBtnText}>QR 배너 인쇄 및 PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={handleViewAll}
          activeOpacity={0.7}
        >
          <Text style={styles.viewBtnText}>전체 보기</Text>
          <ArrowRight size={14} color={theme.colors.primary[300]} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: 18,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary[400] + '30',
    top: -8,
  },
  statNum: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  statLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.dark.border,
  },
  todayHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  todayHighlightText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary[500],
    ...theme.shadows.card,
  },
  downloadBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  viewBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
});
