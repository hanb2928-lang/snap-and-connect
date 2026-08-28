/*
# Add increment_analysis_cache_hit RPC

1. New Function
- `increment_analysis_cache_hit(p_hash text)`: Atomically increments the hit_count
  on an analysis_cache row matching the given image hash. Called fire-and-forget
  from the client when a cache hit occurs, for analytics and future cleanup.

2. Security
- SECURITY DEFINER with search_path = public, granted to anon + authenticated.
- No destructive operations.

3. Notes
- Returns void. If the hash doesn't exist, does nothing (no error).
*/

CREATE OR REPLACE FUNCTION increment_analysis_cache_hit(p_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE analysis_cache SET hit_count = hit_count + 1
  WHERE image_hash = p_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_analysis_cache_hit(text) TO anon, authenticated;
