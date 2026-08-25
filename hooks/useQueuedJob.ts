import { useState, useRef, useCallback, useEffect } from 'react';
import { enqueueJob, subscribeToJob, getJob, type RenderJob, type JobType, type JobStatus } from '@/lib/jobQueue';

interface QueuedJobState {
  jobId: string | null;
  status: JobStatus | 'idle';
  error: string | null;
  result: Record<string, unknown> | null;
}

const DEFAULT_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 3000;

export function useQueuedJob() {
  const [state, setState] = useState<QueuedJobState>({
    jobId: null,
    status: 'idle',
    error: null,
    result: null,
  });
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitIdRef = useRef(0);

  const clearAll = useCallback(() => {
    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const submit = useCallback(async (
    jobType: JobType,
    payload: Record<string, unknown>,
    options: { priority?: number; scanId?: string; timeoutMs?: number } = {},
  ): Promise<string> => {
    const mySubmitId = ++submitIdRef.current;
    clearAll();

    setState({ jobId: null, status: 'queued', error: null, result: null });

    const jobId = await enqueueJob(jobType, payload, options);

    if (mySubmitId !== submitIdRef.current) return jobId;

    setState((prev) => ({ ...prev, jobId }));

    const handleUpdate = (job: RenderJob) => {
      if (mySubmitId !== submitIdRef.current) return;
      setState((prev) => ({
        ...prev,
        status: job.status,
        error: job.error_message,
        result: job.result,
      }));
      if (job.status === 'done' || job.status === 'error') {
        clearAll();
      }
    };

    subRef.current = subscribeToJob(jobId, handleUpdate);

    getJob(jobId).then((job) => {
      if (mySubmitId !== submitIdRef.current) return;
      if (job && (job.status === 'done' || job.status === 'error')) {
        handleUpdate(job);
      }
    }).catch(() => {});

    pollRef.current = setInterval(() => {
      if (mySubmitId !== submitIdRef.current) return;
      getJob(jobId).then((job) => {
        if (mySubmitId !== submitIdRef.current) return;
        if (job) handleUpdate(job);
      }).catch(() => {});
    }, POLL_INTERVAL_MS);

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    timeoutRef.current = setTimeout(() => {
      if (mySubmitId !== submitIdRef.current) return;
      clearAll();
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: '작업 시간이 초과되었어요. 다시 시도해주세요.',
      }));
    }, timeoutMs);

    return jobId;
  }, [clearAll]);

  const reset = useCallback(() => {
    submitIdRef.current++;
    clearAll();
    setState({ jobId: null, status: 'idle', error: null, result: null });
  }, [clearAll]);

  useEffect(() => {
    return () => {
      submitIdRef.current++;
      clearAll();
    };
  }, [clearAll]);

  return { ...state, submit, reset };
}
