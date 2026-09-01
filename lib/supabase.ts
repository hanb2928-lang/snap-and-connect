import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://fzvvriycfiqecherbhli.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dnZyaXljZmlxZWNoZXJiaGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzU4MDUsImV4cCI6MjEwMzA1MTgwNX0.0eAASvxwmKsPamXPukjvnzJrz5DnDoznoDCCm2SV2Vs';

function resolveEnvVars(): { url: string; anonKey: string } {
  if (typeof process !== 'undefined' && process.env) {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) return { url, anonKey };
  }

  try {
    const Constants = require('expo-constants').default;
    const extra = Constants?.expoConfig?.extra;
    if (extra?.supabaseUrl && extra?.supabaseAnonKey) {
      return { url: extra.supabaseUrl, anonKey: extra.supabaseAnonKey };
    }
  } catch {
    // Constants not available
  }

  return { url: FALLBACK_URL, anonKey: FALLBACK_KEY };
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveEnvVars();

export { supabaseUrl, supabaseAnonKey };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

export const ANALYSIS_FUNCTION_URL = `${supabaseUrl}/functions/v1/analyze-photo`;
export const REVIEW_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-review`;
export const COPY_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-copy`;
export const KEYWORD_TRENDS_URL = `${supabaseUrl}/functions/v1/keyword-trends`;
export const COMIC_SCENARIO_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-comic-scenario`;
export const TREND_COPY_FUNCTION_URL = `${supabaseUrl}/functions/v1/trend-copy`;
export const TTS_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-tts`;
export const BATCH_TTS_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-batch-tts`;
export const VARIANT_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-variants`;
export const OCR_TEXT_FUNCTION_URL = `${supabaseUrl}/functions/v1/extract-ocr-text`;
export const VIRAL_PREDICT_FUNCTION_URL = `${supabaseUrl}/functions/v1/viral-predict`;
export const LOCALIZE_FUNCTION_URL = `${supabaseUrl}/functions/v1/translate-localize`;
export const SHORTFORM_GUIDE_URL = `${supabaseUrl}/functions/v1/generate-shortform-guide`;
export const PERSONA_SIMULATOR_URL = `${supabaseUrl}/functions/v1/persona-simulator`;
export const TREND_MATCH_URL = `${supabaseUrl}/functions/v1/trend-match`;
export const PEXELS_VIDEO_SEARCH_URL = `${supabaseUrl}/functions/v1/search-pexels-videos`;
