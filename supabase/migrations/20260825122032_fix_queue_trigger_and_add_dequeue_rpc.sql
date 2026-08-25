/*
# Fix queue trigger and add atomic dequeue RPC

1. Create dequeue_render_job() SECURITY DEFINER function
   - Atomically selects the oldest queued job and marks it as processing
   - Uses FOR UPDATE SKIP LOCKED to prevent race conditions between concurrent processors
   - Returns the job row so the caller has the payload

2. Fix trigger_queue_processor()
   - The original used current_setting('app.supabase_url', true) which always returns NULL
   - Replace with the Supabase project URL from the pg_settings or hardcode via environment
   - Use the anon key approach: the trigger calls the process-queue function directly via pg_net
     using the Supabase auto-discovered URL

3. Security
   - dequeue_render_job runs as SECURITY DEFINER (service role level access)
   - Grant EXECUTE to anon and authenticated roles
*/

CREATE OR REPLACE FUNCTION dequeue_render_job(max_attempts int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_row record;
  result jsonb;
BEGIN
  SELECT id, job_type, payload, attempts INTO job_row
  FROM render_jobs
  WHERE status = 'queued' AND attempts < max_attempts
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE render_jobs
  SET status = 'processing',
      started_at = now()
  WHERE id = job_row.id AND status = 'queued';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  result := jsonb_build_object(
    'id', job_row.id,
    'job_type', job_row.job_type,
    'payload', job_row.payload,
    'attempts', job_row.attempts
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION dequeue_render_job(int) TO anon, authenticated;

-- Fix the trigger function to use the Supabase internal URL
-- The pg_net extension can call the edge function using the internal project URL
CREATE OR REPLACE FUNCTION trigger_queue_processor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url text;
  svc_key text;
BEGIN
  -- Try to get the project URL from the supabase internal config
  -- In Supabase, the edge function URL is accessible via the internal network
  BEGIN
    SELECT value INTO project_url FROM supabase_functions.secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    project_url := NULL;
  END;

  -- Try service role key
  BEGIN
    SELECT value INTO svc_key FROM supabase_functions.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    svc_key := NULL;
  END;

  IF project_url IS NULL OR svc_key IS NULL THEN
    -- Cannot trigger without config; the client-side fallback in enqueueJob handles this
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key,
      'apikey', svc_key
    ),
    body := jsonb_build_object('trigger', true, 'job_id', NEW.id, 'job_type', NEW.job_type)
  );

  RETURN NEW;
END;
$$;
