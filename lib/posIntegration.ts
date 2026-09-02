import { supabase } from '@/lib/supabase';
import { setItem } from '@/lib/storage';
import {
  fetchInventoryItems,
  updateInventoryItem,
  buildLowStockAlert,
  createPushAlert,
} from '@/lib/reviewAutomation';

export interface PosMenuItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  category: string | null;
  is_active: boolean;
  price: number | null;
  original_price: number | null;
  is_today_menu: boolean;
  is_closing_sale: boolean;
  auto_shortform: boolean;
}

export interface PosSyncResult {
  syncedItems: PosMenuItem[];
  closingSaleItems: PosMenuItem[];
  todayMenuItems: PosMenuItem[];
  autoPrompt: string | null;
  autoHook: string | null;
}

export async function fetchPosMenuItems(): Promise<PosMenuItem[]> {
  const items = await fetchInventoryItems();
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    low_stock_threshold: item.low_stock_threshold,
    category: item.category,
    is_active: item.is_active,
    price: item.price ?? null,
    original_price: item.original_price ?? null,
    is_today_menu: item.is_today_menu ?? false,
    is_closing_sale: item.is_closing_sale ?? false,
    auto_shortform: item.auto_shortform ?? false,
  }));
}

export async function updatePosMenuItem(
  id: string,
  updates: Partial<PosMenuItem>,
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.original_price !== undefined) dbUpdates.original_price = updates.original_price;
  if (updates.is_today_menu !== undefined) dbUpdates.is_today_menu = updates.is_today_menu;
  if (updates.is_closing_sale !== undefined) dbUpdates.is_closing_sale = updates.is_closing_sale;
  if (updates.auto_shortform !== undefined) dbUpdates.auto_shortform = updates.auto_shortform;
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (Object.keys(dbUpdates).length > 0) {
    await updateInventoryItem(id, dbUpdates);
  }
}

export async function syncPosToMarketing(): Promise<PosSyncResult> {
  const items = await fetchPosMenuItems();
  const closingSaleItems = items.filter(
    (i) => i.is_active && i.quantity <= i.low_stock_threshold,
  );
  const todayMenuItems = items.filter((i) => i.is_today_menu && i.is_active);

  for (const item of closingSaleItems) {
    if (!item.is_closing_sale) {
      await updatePosMenuItem(item.id, { is_closing_sale: true });
    }
    if (item.auto_shortform) {
      const alertData = buildLowStockAlert({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        low_stock_threshold: item.low_stock_threshold,
        category: item.category,
        is_active: item.is_active,
        last_updated: new Date().toISOString(),
      });
      await createPushAlert(alertData);
    }
  }

  const autoPrompt = buildAutoPrompt(closingSaleItems, todayMenuItems);
  const autoHook = closingSaleItems.length > 0 ? '마감 떨이' : todayMenuItems.length > 0 ? '오늘의 추천' : null;

  if (autoPrompt) {
    await setItem('marketing_pos_auto_prompt', autoPrompt);
  }
  if (autoHook) {
    await setItem('marketing_pos_auto_hook', autoHook);
  }

  return {
    syncedItems: items,
    closingSaleItems,
    todayMenuItems,
    autoPrompt,
    autoHook,
  };
}

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '';
  return `${price.toLocaleString('ko-KR')}원`;
}

function buildAutoPrompt(
  closingSaleItems: PosMenuItem[],
  todayMenuItems: PosMenuItem[],
): string | null {
  if (closingSaleItems.length > 0) {
    const item = closingSaleItems[0];
    const parts: string[] = [`${item.name} 마감 떨이!`];
    if (item.quantity > 0) {
      parts.push(`남은 수량 ${item.quantity}${item.unit}`);
    }
    if (item.price !== null && item.original_price !== null && item.original_price > item.price) {
      parts.push(`특가 ${formatPrice(item.price)} (정가 ${formatPrice(item.original_price)})`);
    } else if (item.price !== null) {
      parts.push(`특가 ${formatPrice(item.price)}`);
    }
    parts.push('선착순 마감 세일');
    return parts.join(', ');
  }

  if (todayMenuItems.length > 0) {
    const item = todayMenuItems[0];
    const parts: string[] = [`오늘의 추천 메뉴: ${item.name}`];
    if (item.price !== null) {
      parts.push(formatPrice(item.price));
    }
    return parts.join(', ');
  }

  return null;
}

export function getClosingSaleBadge(items: PosMenuItem[]): {
  label: string;
  count: number;
  urgent: boolean;
} | null {
  const closingItems = items.filter(
    (i) => i.is_active && i.quantity <= i.low_stock_threshold,
  );
  if (closingItems.length === 0) return null;
  const urgent = closingItems.some((i) => i.quantity <= 1);
  return {
    label: urgent ? '마감 임박' : '마감 세일',
    count: closingItems.length,
    urgent,
  };
}

export function getTodayMenuBadge(items: PosMenuItem[]): {
  label: string;
  count: number;
} | null {
  const todayItems = items.filter((i) => i.is_today_menu && i.is_active);
  if (todayItems.length === 0) return null;
  return {
    label: '오늘의 추천',
    count: todayItems.length,
  };
}
