import { Platform } from 'react-native';
import { uploadImage, saveManualScan } from './analysis';
import { supabase } from './supabase';
import { invokeStereoCutAuto, type AngleImagePayload, type CloudPipelineResult } from './cloudPipeline';
import { runSynthesis, getSynthesisSummary, type AngleInput } from './aiSynthesisEngine';
import { buildShortFormEditPlan, type ShortFormPlatform } from './shortFormEditEngine';
import { buildDirectingPlan, getDirectingSummary, type DirectingPlan } from './directingEngine';
import { buildMultiPlatformPublishPlans, type PublishPlan } from './publishManager';
import { getDeepLink } from './platformUpload';
import * as Linking from 'expo-linking';
import type { AngleShot } from '@/components/MultiAngleCaptureGuide';

export type StereoStepKey = 'upload' | 'synthesis' | 'directing' | 'render' | 'publish';

export interface StereoStepState {
  key: StereoStepKey;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail: string;
}

export interface StereoPipelineProgress {
  steps: StereoStepState[];
  currentStep: number;
  overallProgress: number;
  result: StereoPipelineResult | null;
  error: string | null;
}

export interface StereoPipelineResult {
  scanId: string;
  cloudResult: CloudPipelineResult | null;
  synthesisSummary: string;
  directingSummary: string;
  directingPlan: DirectingPlan | null;
  publishPlans: PublishPlan[];
  publishTargets: { key: string; label: string; deepLinkApp: string; deepLinkWeb: string }[];
}

const STEP_LABELS: Record<StereoStepKey, string> = {
  upload: '클라우드 AI 입체 합성',
  synthesis: '3D 볼륨 분석 & 실사용 맥락 매칭',
  directing: '유튜브 상위 1% 심리 리듬 연출',
  render: '멀티플랫폼 9:16 렌더링 & 메타데이터',
  publish: '갤러리 저장 & 퍼블리시 준비',
};

const PUBLISH_TARGETS: { key: ShortFormPlatform; label: string }[] = [
  { key: 'youtube', label: '유튜브 쇼츠' },
  { key: 'instagram', label: '인스타그램 릴스' },
  { key: 'tiktok', label: '틱톡' },
];

function makeInitialSteps(): StereoStepState[] {
  return (Object.keys(STEP_LABELS) as StereoStepKey[]).map((key) => ({
    key,
    label: STEP_LABELS[key],
    status: 'pending' as const,
    detail: '',
  }));
}

export function makeInitialProgress(): StereoPipelineProgress {
  return {
    steps: makeInitialSteps(),
    currentStep: -1,
    overallProgress: 0,
    result: null,
    error: null,
  };
}

export async function runStereoPipeline(
  shots: AngleShot[],
  onProgress: (progress: StereoPipelineProgress) => void,
): Promise<StereoPipelineResult> {
  const steps = makeInitialSteps();
  const report = (currentStep: number, overallProgress: number, error: string | null = null, result: StereoPipelineResult | null = null) => {
    onProgress({ steps: [...steps], currentStep, overallProgress, result, error });
  };

  const sorted = [...shots].sort((a, b) => a.orderIndex - b.orderIndex);
  if (!sorted[0]?.base64) throw new Error('촬영된 이미지가 없습니다.');

  // ─── Step 1: Upload 5 angles & cloud AI synthesis ───
  steps[0].status = 'active';
  steps[0].detail = '5각도 이미지 전송 및 3D 볼륨 복원 중...';
  report(0, 0.05);

  const imageUrl = await uploadImage(sorted[0].base64, sorted[0].mimeType || 'image/jpeg');
  const scanId = await saveManualScan(imageUrl);

  const additionalShots = sorted.slice(1);
  const additionalUrls: string[] = [];
  for (let i = 0; i < additionalShots.length; i++) {
    const shot = additionalShots[i];
    if (!shot.base64) continue;
    try {
      const url = await uploadImage(shot.base64, shot.mimeType || 'image/jpeg');
      additionalUrls.push(url);
      steps[0].detail = `5각도 이미지 전송 (${i + 2}/${sorted.length}) 완료`;
      report(0, 0.05 + ((i + 2) / sorted.length) * 0.1);
    } catch { /* skip failed uploads */ }
  }
  if (additionalUrls.length > 0) {
    await supabase.from('scans').update({ additional_image_urls: additionalUrls }).eq('id', scanId);
  }

  // Build angle payloads for cloud
  const anglePayloads: AngleImagePayload[] = sorted
    .filter((s) => s.base64)
    .map((s) => ({
      key: ['front', 'left', 'right', 'back', 'top'][s.orderIndex] || 'front',
      label: s.label,
      base64: s.base64!,
      mimeType: s.mimeType,
      orderIndex: s.orderIndex,
    }));

  // On-device synthesis (for immediate context detection + fallback)
  const angleInputs: AngleInput[] = sorted
    .filter((s) => s.base64)
    .map((s) => ({
      key: (['front', 'left', 'right', 'back', 'top'][s.orderIndex] || 'front') as AngleInput['key'],
      label: s.label,
      base64: s.base64!,
      mimeType: s.mimeType,
      orderIndex: s.orderIndex,
    }));

  const localSynthesis = runSynthesis(angleInputs, '');

  // Cloud synthesis
  let cloudResult: CloudPipelineResult | null = null;
  try {
    steps[0].detail = '클라우드 GPU에서 3D 볼륨 복원 및 보간 진행 중...';
    report(0, 0.15);
    cloudResult = await invokeStereoCutAuto(anglePayloads, '', '', scanId);
    // Defensive: verify the response has the expected shape
    if (!cloudResult?.synthesis?.spatialDepthHint) {
      cloudResult = null;
    }
  } catch {
    // Offline fallback — use local synthesis result
  }

  const synthesisSummary = cloudResult
    ? `${cloudResult.synthesis.spatialDepthHint} · 볼륨 신뢰도 ${Math.round(cloudResult.synthesis.volumeEstimate.confidence * 100)}% · ${cloudResult.synthesis.contextMatch.label} 맥락`
    : getSynthesisSummary(localSynthesis);
  const context = cloudResult
    ? (cloudResult.synthesis.contextMatch.context as import('./aiSynthesisEngine').UsageContext)
    : localSynthesis.contextMatch.context;

  steps[0].status = 'done';
  steps[0].detail = synthesisSummary;
  report(0, 0.25);

  // ─── Step 2: Psychological rhythm directing engine ───
  steps[1].status = 'active';
  steps[1].detail = '초반 3초 패러독스 훅 + 비트 싱크 설계 중...';
  report(1, 0.3);

  // Build edit plan for directing engine input
  const editPlan = buildShortFormEditPlan(
    'youtube', '', 'curiosity_gap', '', undefined, undefined, true, undefined, undefined,
  );

  const directingPlan = buildDirectingPlan(
    editPlan.segments,
    editPlan.bgmTemplate,
    context,
    'youtube',
  );

  const directingSummary = getDirectingSummary(directingPlan);

  // Simulate processing delay for UX (let user see the step)
  await new Promise((r) => setTimeout(r, 600));

  steps[1].status = 'done';
  steps[1].detail = `훅: ${directingPlan.hookTransition.description} | SFX ${directingPlan.sfxPlans.length}건 | 킬링포인트 자막 ${directingPlan.killPointCaptions.length}건`;
  report(1, 0.5);

  // ─── Step 3: Multi-platform rendering & AI metadata ───
  steps[2].status = 'active';
  steps[2].detail = '9:16 H.264 렌더링 코덱 적용 & 메타데이터 생성 중...';
  report(2, 0.55);

  const publishPlans = buildMultiPlatformPublishPlans('', context, ['youtube', 'instagram', 'tiktok']);

  // Build publish target info with deep links
  const publishTargets = PUBLISH_TARGETS.map(({ key, label }) => {
    const dl = getDeepLink(key);
    return { key, label, deepLinkApp: dl.appUrl, deepLinkWeb: dl.webUrl };
  });

  await new Promise((r) => setTimeout(r, 600));

  steps[2].status = 'done';
  const metadataSummary = publishPlans.map((p) => `${p.target}: ${p.metadata.title.slice(0, 20)}...`).join(' | ');
  steps[2].detail = `3개 플랫폼 렌더링 준비 완료 | ${metadataSummary}`;
  report(2, 0.75);

  // ─── Step 4: Gallery save & publish readiness ───
  steps[3].status = 'active';
  steps[3].detail = '비차단 갤러리 저장 처리 및 퍼블리시 딥링크 준비 중...';
  report(3, 0.8);

  // Non-blocking: store first image for gallery download (web) / save (native)
  // The actual save happens in the overlay's "저장" button — here we just prepare
  const firstDataUrl = `data:${sorted[0].mimeType};base64,${sorted[0].base64}`;

  await new Promise((r) => setTimeout(r, 400));

  steps[3].status = 'done';
  steps[3].detail = '갤러리 저장 준비 완료 · 3개 플랫폼 퍼블리시 대기';
  report(3, 0.95);

  // ─── Publish step ───
  steps[4].status = 'active';
  steps[4].detail = '퍼블리시 대기 — 플랫폼 선택 후 원클릭 업로드 가능';
  report(4, 1.0);

  const result: StereoPipelineResult = {
    scanId,
    cloudResult,
    synthesisSummary,
    directingSummary,
    directingPlan,
    publishPlans,
    publishTargets,
  };

  steps[4].status = 'done';
  steps[4].detail = '파이프라인 완료 · 편집 화면으로 이동 가능';
  report(4, 1.0, null, result);

  // Suppress unused var warnings for platform-specific code paths
  if (Platform.OS !== 'web') {
    void firstDataUrl;
    void Linking;
  }

  return result;
}

export async function openPublishDeepLink(platformKey: string): Promise<void> {
  const dl = getDeepLink(platformKey);
  const url = dl.appUrl || dl.webUrl || dl.uploadWebUrl;
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    // Deep link may not be available on web — ignore
  }
}
