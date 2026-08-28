import { getItem, setItem } from '@/lib/storage';
import { isOnline } from '@/hooks/useNetworkStatus';

const QUEUE_KEY = 'offline_request_queue';
const MAX_RETRIES = 3;

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  retries: number;
  createdAt: number;
}

let processing = false;

async function loadQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedRequest[]): Promise<void> {
  try {
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors
  }
}

export async function enqueueRequest(
  url: string,
  method: string = 'POST',
  headers?: Record<string, string>,
  body?: string,
): Promise<void> {
  const queue = await loadQueue();
  const req: QueuedRequest = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    method,
    headers,
    body,
    retries: 0,
    createdAt: Date.now(),
  };
  queue.push(req);
  await saveQueue(queue);
}

export async function getQueuedRequestCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  if (!isOnline()) return;
  processing = true;

  try {
    let queue = await loadQueue();
    if (queue.length === 0) return;

    const remaining: QueuedRequest[] = [];

    for (const req of queue) {
      try {
        const res = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        if (req.retries < MAX_RETRIES) {
          remaining.push({ ...req, retries: req.retries + 1 });
        }
      }
    }

    await saveQueue(remaining);
  } finally {
    processing = false;
  }
}

export async function flushQueue(): Promise<void> {
  await processQueue();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue().catch(() => {});
  });
}
