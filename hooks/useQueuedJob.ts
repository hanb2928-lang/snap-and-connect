import { useState, useRef, useCallback, useEffect } from 'react';
import { enqueueJob, subscribeToJob, type RenderJob, type JobType, type JobStatus } from '@/lib/jobQueue';

interface QueuedJobState {
  jobId: string | null;
  status: JobStatus | 'idle';
  error: string | null;
  result: Record<string, unknown> | null;
}

export function useQueuedJob() {
  const [state, setState] = useState<QueuedJobState>({
    jobId: null,
    status: 'idle',
    error: null,
    result: null,
  });
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  const submit = useCallback(async (
    jobType: JobType,
    payload: Record<string, unknown>,
    options: { priority?: number; scanId?: string; timeoutMs?: number } = {},
  ): Promise<string> => {
    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }

    setState({ jobId: null, status: 'queued', error: null, result: null });

    const jobId = await enqueueJob(jobType, payload, options);
    setState((prev) => ({ ...prev, jobId }));

    subRef.current = subscribeToJob(jobId, (job: RenderJob) => {
      setState((prev) => ({
        ...prev,
        status: job.status,
        error: job.error_message,
        result: job.result,
      }));
    });

    return jobId;
  }, []);

  const reset = useCallback(() => {
    if (subRef.current) {
      subRef.current.unsubscribe();
      subRef.current = null;
    }
    setState({ jobId: null, status: 'idle', error: null, result: null });
  }, []);

  useEffect(() => {
    return () => {
      if (subRef.current) {
        subRef.current.unsubscribe();
        subRef.current = null;
      }
    };
  }, []);

  return { ...state, submit, reset };
}
