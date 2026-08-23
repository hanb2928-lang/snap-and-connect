/*
# Create increment_click_count RPC function

## Overview
Creates a SECURITY DEFINER function to atomically increment the click_count
column on the short_links table. This is called by the r/ edge function on each
non-bot redirect.

## New Functions
- `increment_click_count(slug text)` — atomically increments click_count by 1
  and updates last_clicked_at to now() for the matching slug. Returns void.
  SECURITY DEFINER so the edge function's service-role client can call it.
*/

CREATE OR REPLACE FUNCTION increment_click_count(slug_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE short_links
  SET click_count = click_count + 1,
      last_clicked_at = now()
  WHERE slug = slug_input;
END;
$$;