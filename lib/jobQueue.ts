import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type JobType =
  | 'analyze-photo'
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

const POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 300000;
const MAX_POLL_ERRORS = 5;

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
  return new Promise((resolve) => {
    let settled = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(timeoutTimer);
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };

    const finish = (result: JobResult<T>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const channel = supabase
      .channel(`job-wait:${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'render_jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const job = payload.new as RenderJob;
          if (job.status === 'done') {
            finish({ success: true, result: (job.result ?? {}) as T });
          } else if (job.status === 'error') {
            finish({ success: false, error: job.error_message ?? 'Job failed' });
          }
        },
      )
      .subscribe();

    const timeoutTimer = setTimeout(() => {
      finish({ success: false, error: 'Job timed out' });
    }, timeoutMs);

    let pollErrors = 0;

    const poll = async () => {
      if (settled) return;
      try {
        const job = await getJob(jobId);
        pollErrors = 0;
        if (!job) { finish({ success: false, error: 'Job not found' }); return; }
        if (job.status === 'done') {
          finish({ success: true, result: (job.result ?? {}) as T });
        } else if (job.status === 'error') {
          finish({ success: false, error: job.error_message ?? 'Job failed' });
        }
      } catch {
        pollErrors++;
        if (pollErrors >= MAX_POLL_ERRORS) {
          finish({ success: false, error: '네트워크 연결이 불안정합니다. 다시 시도해주세요.' });
        }
      }
    };

    setTimeout(poll, 5000);
    pollInterval = setInterval(poll, POLL_INTERVAL_MS);
  });
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
      const errBody = await resp.text().catch(() => '');
      console.warn('process-queue trigger failed', resp.status, errBody);
    }
  } catch (err) {
    console.warn('process-queue trigger network error', err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeoutId);
  }
}
