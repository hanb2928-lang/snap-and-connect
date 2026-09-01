import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { safeFetch, friendlyApiError } from '@/lib/apiClient';

export interface CutSegment {
  startSec: number;
  endSec: number;
  label: string;
  purpose: string;
}

export interface CopyVariant {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  disclosure: string;
}

export interface EditPlan {
  duration: 15 | 30;
  totalSegments: number;
  segments: CutSegment[];
  hookTiming: { firstHookSec: number; reason: string };
  psychology: {
    principle: string;
    application: string;
    triggerPoint: string;
  };
  antiAlgorithm: {
    copyVariation: string;
    pacingStrategy: string;
    visualChangeStrategy: string;
    audioChangeStrategy: string;
  };
  copyVariants: CopyVariant[];
  musicMood: string;
  motionPreset: string;
  reason: string;
}

interface EditPlanResponse {
  plan: EditPlan;
}

const EDIT_PLAN_URL = `${supabaseUrl}/functions/v1/generate-video-edit-plan`;

export type PsychologyPreset = 'auto' | 'loss_aversion' | 'curiosity_gap' | 'fomo' | 'social_proof';

export async function fetchVideoEditPlan(params: {
  productName?: string;
  productCategory?: string;
  videoDuration: 15 | 30;
  platform?: string;
  accentColor?: string;
  hook?: string;
  oneLiner?: string;
  psychologyPreset?: PsychologyPreset;
}): Promise<EditPlan> {
  try {
    const resp = await safeFetch(EDIT_PLAN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(params),
      timeoutMs: 30000,
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: '편집 계획 생성에 실패했습니다.' }));
      throw new Error(errData.error || `요청 실패 (${resp.status})`);
    }
    const data = (await resp.json()) as EditPlanResponse;
    if (!data.plan) {
      throw new Error('편집 계획을 불러오지 못했습니다.');
    }
    return data.plan;
  } catch (err) {
    throw new Error(friendlyApiError(err, '편집 계획 생성 중 오류가 발생했습니다.'));
  }
}
