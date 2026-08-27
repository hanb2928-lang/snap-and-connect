-- Fix the queue trigger: supabase_functions.secrets is not accessible from PL/pgSQL.
-- Hardcode both the public URL and the public anon key directly in the function.
-- process-queue has verify_jwt=false, so the anon key is sufficient to wake it.
CREATE OR REPLACE FUNCTION public.trigger_queue_processor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_url text;
  anon_key text;
BEGIN
  project_url := 'https://fzvvriycfiqecherbhli.supabase.co';
  anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6dnZyaXljZmlxZWNoZXJiaGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzU4MDUsImV4cCI6MjEwMzA1MTgwNX0.0eAASvxwmKsPamXPukjvnzJrz5DnDoznoDCCm2SV2Vs';

  PERFORM net.http_post(
    url := project_url || '/functions/v1/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    ),
    body := jsonb_build_object('trigger', true, 'job_id', NEW.id, 'job_type', NEW.job_type)
  );

  RETURN NEW;
END;
$function$;
