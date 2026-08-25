import { supabase } from '@/lib/supabase';

export type JobType =
  | 'analyze-photo'
  | 'virtual-fitting'
  | 'virtual-cuts'
  | 'generate-tts'
  | 'generate-copy'
  | 'generate-review'
  | 'generate-comic-scenario';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error';

export interface RenderJob {
  id: string;
  job_type: JobType;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  scan_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
}

const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_ATTEMPTS = 3;

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, unknown>,
  options: { priority?: number; scanId?: string } = {},
): Promise<string> {
  const { data, error } = await supabase
    .from('render_jobs')
    .insert({
      job_type: jobType,
      status: 'queued',
      priority: options.priority ?? 5,
      payload,
      scan_id: options.scanId ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Job enqueue failed: ${error.message}`);
  return data.id;
}

export async function getJob(jobId: string): Promise<RenderJob | null> {
  const { data, error } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) throw new Error(`Job fetch failed: ${error.message}`);
  return data as RenderJob | null;
}

export interface JobResult<T = Record<string, unknown>> {
  success: boolean;
  result?: T;
  error?: string;
}

export async function waitForJob<T = Record<string, unknown>>(
  jobId: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<JobResult<T>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    if (job.status === 'done') {
      return { success: true, result: (job.result ?? {}) as T };
    }

    if (job.status === 'error') {
      if (job.attempts < MAX_ATTEMPTS) {
        await retryJob(jobId);
        continue;
      }
      return { success: false, error: job.error_message ?? 'Job failed' };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  await markJobTimedOut(jobId);
  return { success: false, error: 'Job timed out' };
}

async function retryJob(jobId: string): Promise<void> {
  await supabase
    .from('render_jobs')
    .update({
      status: 'queued',
      error_message: null,
      attempts: 0,
    })
    .eq('id', jobId);
}

async function markJobTimedOut(jobId: string): Promise<void> {
  await supabase
    .from('render_jobs')
    .update({
      status: 'error',
      error_message: 'Client-side timeout',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export function subscribeToJob(
  jobId: string,
  onUpdate: (job: RenderJob) => void,
): { unsubscribe: () => void } {
  const channel = supabase
    .channel(`job:${jobId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'render_jobs', filter: `id=eq.${jobId}` },
      (payload) => {
        onUpdate(payload.new as RenderJob);
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

export async function enqueueAndWait<T = Record<string, unknown>>(
  jobType: JobType,
  payload: Record<string, unknown>,
  options: { priority?: number; scanId?: string; timeoutMs?: number } = {},
): Promise<JobResult<T>> {
  const jobId = await enqueueJob(jobType, payload, options);
  return waitForJob<T>(jobId, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}
