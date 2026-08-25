/*
# Add database trigger to auto-invoke queue processor on new job

1. Changes
- Creates `pg_net` extension if not present (for outbound HTTP calls)
- Creates function `trigger_queue_processor()` that sends an HTTP POST to the
  process-queue-trigger edge function when a new render_jobs row is inserted
- Creates trigger `on_render_job_insert` that fires AFTER INSERT on render_jobs

2. Security
- The function runs with SECURITY DEFINER (owner-level privileges) to use pg_net
- The trigger fires for all inserts regardless of role
*/

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_queue_processor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  func_url text;
  svc_key text;
BEGIN
  func_url := current_setting('app.supabase_url', true);
  svc_key := current_setting('app.supabase_service_role_key', true);

  IF func_url IS NULL OR svc_key IS NULL THEN
    -- Fallback: try environment variables via the extensions schema
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := func_url || '/functions/v1/process-queue-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := jsonb_build_object('job_id', NEW.id, 'job_type', NEW.job_type)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_render_job_insert ON render_jobs;

CREATE TRIGGER on_render_job_insert
  AFTER INSERT ON render_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_queue_processor();
