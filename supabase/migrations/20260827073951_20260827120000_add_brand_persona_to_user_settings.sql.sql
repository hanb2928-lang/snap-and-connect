/*
# Add brand persona fields to user_settings

1. Modified Tables
- `user_settings`: adds `brand_persona` (text, nullable) — stores the brand's tone & manner description
  that gets injected into AI copy generation prompts. Example: "친근하고 발랄한 2030 타겟 화장품 브랜드,
  반말 톤, 이모지 적극 활용, 가격 어필보다 감성 어필 우선"
2. Security
- No new tables. Column inherits existing RLS policies on `user_settings`.
3. Notes
- Nullable so existing users are not affected. Frontend will treat null as "no custom persona" (use default prompt).
- No data loss: purely additive ALTER.
*/

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS brand_persona text;
