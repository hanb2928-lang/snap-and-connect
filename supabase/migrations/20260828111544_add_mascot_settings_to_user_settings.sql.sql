/*
# Add mascot character settings to user_settings

1. Modified Tables
- `user_settings`
  - `mascot_enabled` (boolean, default true): Controls whether the baby character
    mascot appears in UI overlays, progress bars, and video overlays. When false,
    all baby character visuals are hidden — useful for business users who want a
    more professional look.
  - `mascot_style` (text, default 'cute-crawler'): Selects which mascot style to
    display. Currently supported values: 'cute-crawler' (default 3D baby),
    'none' (same as mascot_enabled=false but per-style), 'minimal-dot' (simple
    geometric indicator for ultra-professional look). Future values can be added
    without schema changes.

2. Security
- No new tables. Existing RLS policies on user_settings remain unchanged.
- The new columns inherit the same access policies as the rest of the table.

3. Important Notes
- Both columns are nullable-safe with sensible defaults so existing rows and
  new inserts work without changes to client code.
- mascot_enabled is the master switch; mascot_style is the style selector.
- When mascot_enabled=false, the mascot is hidden regardless of mascot_style.
*/

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS mascot_enabled boolean DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS mascot_style text DEFAULT 'cute-crawler';
