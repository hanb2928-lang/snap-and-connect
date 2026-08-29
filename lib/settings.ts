import { supabase } from '@/lib/supabase';
import type { UserSettings } from '@/types/database';

const SINGLETON_ID = 1;

let cachedSettings: UserSettings | null | undefined;

export async function getUserSettings(): Promise<UserSettings | null> {
  if (cachedSettings !== undefined) return cachedSettings;

  const { data, error } = await supabase
    .from('user_settings')
    .select('id, coupang_partners_id, naver_shopping_id, toss_share_id, openai_api_key, logo_url, default_video_duration, default_tts_voice, tts_speed, tts_pitch, progress_style, auto_disclosure, brand_persona, mascot_enabled, mascot_style, capture_guide_mode, ui_performance, theme_mode, display_density, theme_preset, updated_at')
    .eq('id', SINGLETON_ID)
    .maybeSingle();

  if (error) return null;
  cachedSettings = data as UserSettings | null;
  return cachedSettings;
}

export function invalidateSettingsCache(): void {
  cachedSettings = undefined;
}

export async function updateUserSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({
      id: SINGLETON_ID,
      ...settings,
      updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
  invalidateSettingsCache();
}
