import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_ATTEMPTS = 3;
const MAX_JOBS_PER_RUN = 1;
const JOB_TIMEOUT_MS = 200000;

const ALLOWED_JOB_TYPES = new Set([
  "analyze-photo",
  "virtual-fitting",
  "virtual-cuts",
  "generate-tts",
  "generate-copy",
  "generate-review",
  "generate-comic-scenario",
]);

const JOB_TYPE_TO_FUNCTION_SLUG: Record<string, string> = {
  "virtual-cuts": "generate-virtual-cuts",
  "virtual-fitting": "generate-virtual-fitting",
};

interface RenderJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const processed: Array<{ id: string; status: string; error?: string }> = [];

    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const job = await dequeueJob();
      if (!job) break;

      try {
        const result = await processJob(job);
        await markJobDone(job.id, result);
        processed.push({ id: job.id, status: "done" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        const newAttempts = job.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          await markJobError(job.id, newAttempts, errorMsg);
          processed.push({ id: job.id, status: "error", error: errorMsg });
        } else {
          await requeueJob(job.id, newAttempts, errorMsg);
          processed.push({ id: job.id, status: "requeued" });
        }
      }
    }

    const hasRequeued = processed.some((p) => p.status === "requeued");
    if (hasRequeued && processed.length > 0) {
      // Re-trigger for remaining/requeued jobs so they don't sit idle
      fetch(`${supabaseUrl}/functions/v1/process-queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({ trigger: true }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ processed, count: processed.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Queue processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function checkQueuedJobs(): Promise<boolean> {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/render_jobs?select=id&status=eq.queued&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  if (!resp.ok) return false;
  const rows = await resp.json() as Array<{ id: string }>;
  return rows.length > 0;
}

async function dequeueJob(): Promise<RenderJob | null> {
  const resp = await fetch(
    `${supabaseUrl}/rest/v1/rpc/dequeue_render_job`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_attempts: MAX_ATTEMPTS }),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Dequeue RPC failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const job = Array.isArray(data) ? data[0] : data;
  if (!job || !job.id) return null;

  return {
    id: job.id,
    job_type: job.job_type,
    payload: job.payload,
    attempts: job.attempts ?? 0,
  };
}

async function markJobDone(jobId: string, result: Record<string, unknown>): Promise<void> {
  const resp = await fetch(`${supabaseUrl}/rest/v1/render_jobs?id=eq.${jobId}&status=eq.processing`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "done",
      result: result,
      completed_at: new Date().toISOString(),
      error_message: null,
    }),
  });
  if (!resp.ok) throw new Error(`Mark done failed: ${resp.status}`);
}

async function markJobError(jobId: string, attempts: number, errorMsg: string): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/render_jobs?id=eq.${jobId}&status=eq.processing`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "error",
      error_message: errorMsg,
      attempts: attempts,
      completed_at: new Date().toISOString(),
    }),
  });
}

async function requeueJob(jobId: string, attempts: number, errorMsg: string): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/render_jobs?id=eq.${jobId}&status=eq.processing`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "queued",
      attempts: attempts,
      error_message: errorMsg,
    }),
  });
}

async function processJob(job: RenderJob): Promise<Record<string, unknown>> {
  if (!ALLOWED_JOB_TYPES.has(job.job_type)) {
    throw new Error(`Disallowed job_type: ${job.job_type}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);

  try {
    const functionSlug = JOB_TYPE_TO_FUNCTION_SLUG[job.job_type] ?? job.job_type;
    const functionUrl = `${supabaseUrl}/functions/v1/${functionSlug}`;
    const resp = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      signal: controller.signal,
      body: JSON.stringify(job.payload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "Unknown error");
      throw new Error(`${job.job_type} failed (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    return data as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}
