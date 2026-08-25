import { supabase } from '@/lib/supabase';
import type { UserSettings } from '@/types/database';

const SINGLETON_ID = 1;

export async function getUserSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('id, coupang_partners_id, naver_shopping_id, toss_share_id, openai_api_key, logo_url, updated_at')
    .eq('id', SINGLETON_ID)
    .maybeSingle();

  if (error) return null;
  return data as UserSettings | null;
}

export async function updateUserSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('id', SINGLETON_ID)
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await supabase
      .from('user_settings')
      .insert({
        id: SINGLETON_ID,
        ...settings,
        updated_at: new Date().toISOString(),
      });

    if (insertError) throw new Error(`Failed to save settings: ${insertError.message}`);
    return;
  }

  const { error } = await supabase
    .from('user_settings')
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', SINGLETON_ID);

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}
