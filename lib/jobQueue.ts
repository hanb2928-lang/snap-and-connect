import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

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
const MAX_CLIENT_RETRIES = 2;

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

  triggerQueueProcessor().catch(() => {});

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
  let clientRetries = 0;

  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    if (job.status === 'done') {
      return { success: true, result: (job.result ?? {}) as T };
    }

    if (job.status === 'error') {
      if (job.attempts < 3 && clientRetries < MAX_CLIENT_RETRIES) {
        clientRetries++;
        await supabase
          .from('render_jobs')
          .update({ status: 'queued', error_message: null })
          .eq('id', jobId)
          .eq('status', 'error');
        triggerQueueProcessor().catch(() => {});
        continue;
      }
      return { success: false, error: job.error_message ?? 'Job failed' };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return { success: false, error: 'Job timed out' };
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
        if (payload.new) {
          onUpdate(payload.new as RenderJob);
        }
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

async function triggerQueueProcessor(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) return;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ trigger: true }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      // Trigger failed but we don't throw — the queue will be picked up on next enqueue
    }
  } catch {
    // Network error — queue will be picked up on next enqueue
  } finally {
    clearTimeout(timeoutId);
  }
}
