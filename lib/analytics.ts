import { supabase } from '@/lib/supabase';

export interface PlatformClickStat {
  platform: string;
  clicks: number;
  pct: number;
}

export interface DailyClickStat {
  date: string;
  clicks: number;
}

export interface HourlyClickStat {
  hour: number;
  clicks: number;
}

export interface ScanClickStat {
  scan_id: string;
  title: string;
  product_name: string;
  image_url: string;
  clicks: number;
  last_clicked_at: string | null;
}

export interface ClickAnalytics {
  totalClicks: number;
  totalScans: number;
  ctr: number;
  platformBreakdown: PlatformClickStat[];
  dailyClicks: DailyClickStat[];
  hourlyClicks: HourlyClickStat[];
  topScans: ScanClickStat[];
  recentClicks: { platform: string; clicked_at: string; scan_id: string | null }[];
}

function emptyAnalytics(totalScans = 0): ClickAnalytics {
  return {
    totalClicks: 0,
    totalScans,
    ctr: 0,
    platformBreakdown: [],
    dailyClicks: [],
    hourlyClicks: [],
    topScans: [],
    recentClicks: [],
  };
}

function toKoreaDateKey(iso: string): string {
  const d = new Date(iso);
  const korea = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return korea.toISOString().split('T')[0];
}

function getKoreaHour(iso: string): number {
  const d = new Date(iso);
  const korea = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return korea.getUTCHours();
}

function dateKeyOffsetDays(days: number): string {
  const korea = new Date(Date.now() + 9 * 60 * 60 * 1000);
  korea.setDate(korea.getDate() - days);
  return korea.toISOString().split('T')[0];
}

export async function fetchClickAnalytics(): Promise<ClickAnalytics> {
  let totalScans = 0;
  try {
    const [
      clickEventsPage,
      shortLinks,
      scanCountRes,
      scans,
    ] = await Promise.all([
      supabase
        .from('click_events')
        .select('platform, clicked_at, scan_id')
        .order('clicked_at', { ascending: false })
        .limit(5000),
      supabase
        .from('short_links')
        .select('click_count, scan_id, slug, last_clicked_at')
        .order('click_count', { ascending: false }),
      supabase.from('scans').select('id', { count: 'exact', head: true }),
      supabase
        .from('scans')
        .select('id, title, product_name, image_url')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    totalScans = scanCountRes.count ?? 0;

    const events = clickEventsPage.data ?? [];
    const links = (shortLinks.data ?? []) as Array<{ click_count: number; scan_id: string | null; slug: string; last_clicked_at: string | null }>;

    if (events.length === 0 && links.length === 0) {
      return emptyAnalytics(totalScans);
    }

    const totalClicks = links.reduce((sum, l) => sum + (l.click_count || 0), 0);
    const ctr = totalScans > 0 ? (totalClicks / totalScans) * 100 : 0;

    const scanMap = new Map<string, { title: string; product_name: string; image_url: string }>();
    for (const s of (scans.data ?? []) as Array<{ id: string; title: string | null; product_name: string | null; image_url: string }>) {
      scanMap.set(s.id, {
        title: s.title || '',
        product_name: s.product_name || '',
        image_url: s.image_url,
      });
    }

    // Platform breakdown from click_events
    const platformMap = new Map<string, number>();
    for (const e of events) {
      const p = e.platform || '기타';
      platformMap.set(p, (platformMap.get(p) || 0) + 1);
    }
    const platformBreakdown: PlatformClickStat[] = Array.from(platformMap.entries())
      .map(([platform, clicks]) => ({
        platform,
        clicks,
        pct: events.length > 0 ? (clicks / events.length) * 100 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    // Daily clicks — last 14 days (Korea timezone)
    const dailyMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      dailyMap.set(dateKeyOffsetDays(i), 0);
    }
    for (const e of events) {
      if (!e.clicked_at) continue;
      const key = toKoreaDateKey(e.clicked_at);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
      }
    }
    const dailyClicks: DailyClickStat[] = Array.from(dailyMap.entries())
      .map(([date, clicks]) => ({ date, clicks }));

    // Hourly clicks — 0-23 (Korea timezone)
    const hourlyMap = new Map<number, number>();
    for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
    for (const e of events) {
      if (!e.clicked_at) continue;
      const hour = getKoreaHour(e.clicked_at);
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }
    const hourlyClicks: HourlyClickStat[] = Array.from(hourlyMap.entries())
      .map(([hour, clicks]) => ({ hour, clicks }));

    // Per-scan stats from short_links (last_clicked_at already fetched)
    const scanClickMap = new Map<string, number>();
    const scanLastClickMap = new Map<string, string | null>();
    for (const l of links) {
      if (l.scan_id) {
        scanClickMap.set(l.scan_id, (scanClickMap.get(l.scan_id) || 0) + (l.click_count || 0));
        if (l.last_clicked_at) {
          const existing = scanLastClickMap.get(l.scan_id);
          if (!existing || new Date(l.last_clicked_at) > new Date(existing)) {
            scanLastClickMap.set(l.scan_id, l.last_clicked_at);
          }
        }
      }
    }

    const topScans: ScanClickStat[] = Array.from(scanClickMap.entries())
      .filter(([scanId]) => scanMap.has(scanId))
      .map(([scanId, clicks]) => {
        const s = scanMap.get(scanId)!;
        return {
          scan_id: scanId,
          title: s.title,
          product_name: s.product_name,
          image_url: s.image_url,
          clicks,
          last_clicked_at: scanLastClickMap.get(scanId) || null,
        };
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);

    // Recent clicks (last 20)
    const recentClicks = events.filter((e) => e.clicked_at).slice(0, 20).map((e) => ({
      platform: e.platform || '기타',
      clicked_at: e.clicked_at as string,
      scan_id: e.scan_id as string | null,
    }));

    return {
      totalClicks,
      totalScans,
      ctr,
      platformBreakdown,
      dailyClicks,
      hourlyClicks,
      topScans,
      recentClicks,
    };
  } catch {
    return emptyAnalytics(totalScans);
  }
}

export function formatClickTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
