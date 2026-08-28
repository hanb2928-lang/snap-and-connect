/*
# Create template_registry table for nano-analysis hybrid template architecture

1. New Table: `template_registry`
   - `id` (uuid, primary key)
   - `category` (text, not null) — product category: beauty, tech, fashion, living, food, baby, sports, home_appliance, kitchen, pet
   - `platform` (text, not null) — target platform: shorts, reels, tiktok, naverBlog, instagram, threads, twitter
   - `hook_duration_sec` (int, default 3) — optimal hook duration in seconds
   - `pacing_seconds` (float, default 1.2) — scene transition pacing
   - `card_style` (text, default 'bold') — visual card style: bold, magazine, minimal, feed
   - `accent_color` (text, default '#2f9dff') — accent hex color for this category
   - `bgm_mood` (text, default 'energetic') — BGM mood preset
   - `sfx_triggers` (jsonb, default '[]') — sound effect trigger points
   - `caption_preset` (text, default 'bold_neon_yellow') — caption visual preset
   - `hook_template` (text) — hook text template with {product} placeholder
   - `hashtag_templates` (jsonb, default '[]') — hashtag templates
   - `transition_type` (text, default 'whoosh') — transition style
   - `is_default` (boolean, default false) — whether this is the fallback template for the platform
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())
   - Unique constraint on (category, platform)

2. Seed Data
   - Inserts template patterns for major category x platform combinations
   - Includes sensible defaults for each platform (is_default = true)

3. Security
   - RLS enabled
   - Public read access (TO anon, authenticated) — templates are shared design patterns, not user data
   - No write access from client — templates are managed server-side

4. Notes
   - The fallback in the edge function already maps sneakers→#2f9dff, lighting→#f59e0b, clothing→#06b3d4
   - This table extends that concept to a full registry with platform-specific pacing and style
   - When no exact category match exists, the client falls back to the platform's is_default row
*/

CREATE TABLE IF NOT EXISTS template_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  platform text NOT NULL,
  hook_duration_sec int NOT NULL DEFAULT 3,
  pacing_seconds float NOT NULL DEFAULT 1.2,
  card_style text NOT NULL DEFAULT 'bold',
  accent_color text NOT NULL DEFAULT '#2f9dff',
  bgm_mood text NOT NULL DEFAULT 'energetic',
  sfx_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  caption_preset text NOT NULL DEFAULT 'bold_neon_yellow',
  hook_template text,
  hashtag_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  transition_type text NOT NULL DEFAULT 'whoosh',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category, platform)
);

ALTER TABLE template_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_templates" ON template_registry;
CREATE POLICY "anon_read_templates" ON template_registry FOR SELECT
  TO anon, authenticated USING (true);

-- Seed: platform defaults (is_default = true, category = '_default')
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('_default', 'shorts', 3, 1.2, 'bold', '#2f9dff', 'energetic', '["whoosh_01","pop_03"]'::jsonb, 'bold_neon_yellow', '이거 모르면 손해!', '["#추천","#꿀템","#숏폼"]'::jsonb, 'whoosh', true),
  ('_default', 'reels', 3, 1.5, 'magazine', '#06b3d4', 'chill', '["whoosh_01","pop_02"]'::jsonb, 'clean_white', '스크롤 멈추세요', '["#릴스","#추천","#데일리"]'::jsonb, 'fade', true),
  ('_default', 'tiktok', 2, 1.0, 'bold', '#f59e0b', 'trendy', '["whoosh_02","pop_01","ding_01"]'::jsonb, 'bold_neon_yellow', '이거 진짜 대박', '["#틱톡","#꿀템","#추천"]'::jsonb, 'whoosh', true),
  ('_default', 'naverBlog', 5, 2.0, 'magazine', '#2f9dff', 'calm', '[]'::jsonb, 'clean_white', '후기로 시작하는 이야기', '["#네이버블로그","#후기","#리뷰"]'::jsonb, 'fade', true),
  ('_default', 'instagram', 3, 1.3, 'feed', '#06b3d4', 'chill', '["pop_02"]'::jsonb, 'clean_white', '저장해두면 나중에 꼭 쓰임', '["#인스타","#꿀템","#추천팔로우"]'::jsonb, 'fade', true),
  ('_default', 'threads', 4, 1.8, 'minimal', '#2f9dff', 'calm', '[]'::jsonb, 'minimal_dark', '오늘의 발견', '["#스레드","#추천"]'::jsonb, 'fade', true),
  ('_default', 'twitter', 2, 1.0, 'bold', '#2f9dff', 'energetic', '["whoosh_01"]'::jsonb, 'bold_neon_yellow', '이거 진짜임', '["#꿀템","#추천"]'::jsonb, 'whoosh', true)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: beauty x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('beauty', 'shorts', 2, 1.0, 'bold', '#ec4899', 'trendy', '["pop_03","ding_01"]'::jsonb, 'bold_pink', '이거 바르면 달라져요', '["#뷰티","#스킨케어","#꿀템"]'::jsonb, 'whoosh', false),
  ('beauty', 'reels', 3, 1.3, 'magazine', '#ec4899', 'chill', '["pop_02"]'::jsonb, 'clean_pink', '피부가 달라졌어요', '["#뷰티","#릴스","#스킨케어"]'::jsonb, 'fade', false),
  ('beauty', 'tiktok', 2, 0.8, 'bold', '#ec4899', 'trendy', '["pop_03","ding_01","whoosh_02"]'::jsonb, 'bold_pink', '이거 바르면 각질 정리됨', '["#뷰티틱톡","#스킨케어","#꿀템"]'::jsonb, 'whoosh', false),
  ('beauty', 'instagram', 3, 1.2, 'feed', '#ec4899', 'chill', '["pop_02"]'::jsonb, 'clean_pink', '저장하면 나중에 쓸 수 있어요', '["#뷰티","#스킨케어","#인스타그램"]'::jsonb, 'fade', false),
  ('beauty', 'naverBlog', 5, 2.0, 'magazine', '#ec4899', 'calm', '[]'::jsonb, 'clean_pink', '한 달 사용 후기', '["#뷰티","#스킨케어","#후기"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: tech x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('tech', 'shorts', 3, 1.0, 'bold', '#2f9dff', 'energetic', '["whoosh_01","pop_03","ding_02"]'::jsonb, 'bold_neon_yellow', '이 기능 모르면 못 씁니다', '["#테크","#IT","#꿀템"]'::jsonb, 'whoosh', false),
  ('tech', 'reels', 3, 1.2, 'magazine', '#2f9dff', 'chill', '["whoosh_01","pop_02"]'::jsonb, 'clean_white', '이거 하나면 끝', '["#테크","#릴스","#IT"]'::jsonb, 'fade', false),
  ('tech', 'tiktok', 2, 0.8, 'bold', '#2f9dff', 'trendy', '["whoosh_02","pop_01","ding_02"]'::jsonb, 'bold_neon_yellow', '이거 진짜 미쳤음', '["#테크틱톡","#IT","#꿀템"]'::jsonb, 'whoosh', false),
  ('tech', 'instagram', 3, 1.2, 'feed', '#2f9dff', 'chill', '["pop_02"]'::jsonb, 'clean_white', '저장 필수', '["#테크","#IT","#꿀템"]'::jsonb, 'fade', false),
  ('tech', 'naverBlog', 5, 2.0, 'magazine', '#2f9dff', 'calm', '[]'::jsonb, 'clean_white', '사용기 30일', '["#테크","#IT","#사용기"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: fashion x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('fashion', 'shorts', 3, 1.2, 'bold', '#06b3d4', 'chill', '["whoosh_01","pop_03"]'::jsonb, 'bold_white', '이거 입으면 달라져요', '["#패션","#코디","#꿀템"]'::jsonb, 'whoosh', false),
  ('fashion', 'reels', 3, 1.5, 'magazine', '#06b3d4', 'chill', '["whoosh_01"]'::jsonb, 'clean_white', '코디 완성', '["#패션","#릴스","#코디"]'::jsonb, 'fade', false),
  ('fashion', 'tiktok', 2, 0.8, 'bold', '#06b3d4', 'trendy', '["whoosh_02","pop_03"]'::jsonb, 'bold_white', '이렇게 입으면 끝남', '["#패션틱톡","#코디","#꿀템"]'::jsonb, 'whoosh', false),
  ('fashion', 'instagram', 3, 1.3, 'feed', '#06b3d4', 'chill', '["pop_02"]'::jsonb, 'clean_white', '저장하면 코디 참고할 수 있어요', '["#패션","#코디","#인스타그램"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: food x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('food', 'shorts', 2, 1.0, 'bold', '#f59e0b', 'trendy', '["pop_03","sizzle_01"]'::jsonb, 'bold_warm', '이거 먹어봤어요?', '["#맛집","#먹스타그램","#꿀템"]'::jsonb, 'whoosh', false),
  ('food', 'reels', 3, 1.3, 'magazine', '#f59e0b', 'chill', '["pop_02","sizzle_01"]'::jsonb, 'clean_warm', '이 맛 조합 모르면 손해', '["#맛집","#릴스","#먹스타그램"]'::jsonb, 'fade', false),
  ('food', 'tiktok', 2, 0.8, 'bold', '#f59e0b', 'trendy', '["pop_03","sizzle_01","ding_01"]'::jsonb, 'bold_warm', '이거 진짜 맛있음', '["#먹방","#틱톡","#맛집"]'::jsonb, 'whoosh', false),
  ('food', 'instagram', 3, 1.2, 'feed', '#f59e0b', 'chill', '["pop_02"]'::jsonb, 'clean_warm', '저장하면 나중에 주문할 수 있어요', '["#먹스타그램","#맛집","#인스타"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: living x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('living', 'shorts', 3, 1.2, 'bold', '#10b981', 'calm', '["whoosh_01","pop_03"]'::jsonb, 'bold_green', '집이 이렇게 달라져요', '["#리빙","#인테리어","#꿀템"]'::jsonb, 'whoosh', false),
  ('living', 'reels', 3, 1.5, 'magazine', '#10b981', 'chill', '["whoosh_01"]'::jsonb, 'clean_green', '이거 하나면 집이 달라져요', '["#리빙","#릴스","#인테리어"]'::jsonb, 'fade', false),
  ('living', 'instagram', 3, 1.3, 'feed', '#10b981', 'chill', '["pop_02"]'::jsonb, 'clean_green', '저장하면 나중에 살 수 있어요', '["#리빙","#인테리어","#인스타"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: baby x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('baby', 'shorts', 3, 1.2, 'bold', '#f472b6', 'trendy', '["pop_03","laugh_01"]'::jsonb, 'bold_pink', '우리 아이 최애템', '["#육아","#베이비","#꿀템"]'::jsonb, 'whoosh', false),
  ('baby', 'reels', 3, 1.3, 'magazine', '#f472b6', 'chill', '["pop_02","laugh_01"]'::jsonb, 'clean_pink', '육아템 이거 하나면 끝', '["#육아","#릴스","#베이비"]'::jsonb, 'fade', false),
  ('baby', 'instagram', 3, 1.3, 'feed', '#f472b6', 'chill', '["pop_02"]'::jsonb, 'clean_pink', '저장하면 나중에 참고할 수 있어요', '["#육아","#베이비","#인스타"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: sports x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('sports', 'shorts', 2, 1.0, 'bold', '#f97316', 'energetic', '["whoosh_01","pop_03","hit_01"]'::jsonb, 'bold_orange', '이거 없이 운동 못 해요', '["#스포츠","#운동","#꿀템"]'::jsonb, 'whoosh', false),
  ('sports', 'tiktok', 2, 0.8, 'bold', '#f97316', 'trendy', '["whoosh_02","pop_01","hit_01"]'::jsonb, 'bold_orange', '운동템 진짜 대박', '["#스포츠틱톡","#운동","#꿀템"]'::jsonb, 'whoosh', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: home_appliance x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('home_appliance', 'shorts', 3, 1.2, 'bold', '#8b5cf6', 'energetic', '["whoosh_01","pop_03","ding_02"]'::jsonb, 'bold_purple', '이거 사면 집이 편해져요', '["#가전","#가전제품","#꿀템"]'::jsonb, 'whoosh', false),
  ('home_appliance', 'reels', 3, 1.5, 'magazine', '#8b5cf6', 'chill', '["whoosh_01","pop_02"]'::jsonb, 'clean_purple', '이 가전 하나면 끝', '["#가전","#릴스","#가전제품"]'::jsonb, 'fade', false),
  ('home_appliance', 'naverBlog', 5, 2.0, 'magazine', '#8b5cf6', 'calm', '[]'::jsonb, 'clean_purple', '가전 후기', '["#가전","#가전제품","#후기"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: kitchen x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('kitchen', 'shorts', 2, 1.0, 'bold', '#f59e0b', 'trendy', '["pop_03","sizzle_01"]'::jsonb, 'bold_warm', '이거 없으면 주방이 아쉬워요', '["#주방","#키친","#꿀템"]'::jsonb, 'whoosh', false),
  ('kitchen', 'instagram', 3, 1.2, 'feed', '#f59e0b', 'chill', '["pop_02"]'::jsonb, 'clean_warm', '저장하면 요리할 때 참고할 수 있어요', '["#주방","#키친","#인스타"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;

-- Seed: pet x platforms
INSERT INTO template_registry (category, platform, hook_duration_sec, pacing_seconds, card_style, accent_color, bgm_mood, sfx_triggers, caption_preset, hook_template, hashtag_templates, transition_type, is_default) VALUES
  ('pet', 'shorts', 2, 1.0, 'bold', '#06b3d4', 'trendy', '["pop_03","bark_01"]'::jsonb, 'bold_cyan', '이거 사주면 반려동물이 좋아해요', '["#반려동물","#펫","#꿀템"]'::jsonb, 'whoosh', false),
  ('pet', 'tiktok', 2, 0.8, 'bold', '#06b3d4', 'trendy', '["pop_03","bark_01","ding_01"]'::jsonb, 'bold_cyan', '반려동물 미쳤음', '["#반려동물","#펫","#틱톡"]'::jsonb, 'whoosh', false),
  ('pet', 'instagram', 3, 1.2, 'feed', '#06b3d4', 'chill', '["pop_02"]'::jsonb, 'clean_cyan', '저장하면 나중에 참고할 수 있어요', '["#반려동물","#펫","#인스타"]'::jsonb, 'fade', false)
ON CONFLICT (category, platform) DO NOTHING;
