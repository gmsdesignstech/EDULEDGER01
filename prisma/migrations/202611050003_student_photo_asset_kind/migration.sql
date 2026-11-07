-- Allow student images in the existing private, institution-scoped asset store.
-- Existing logo and signature assets remain valid and are not modified.
ALTER TABLE school_assets DROP CONSTRAINT IF EXISTS school_assets_kind_check;
ALTER TABLE school_assets
  ADD CONSTRAINT school_assets_kind_check
  CHECK (kind IN ('logo', 'signature') OR kind LIKE 'student-photo:%');
