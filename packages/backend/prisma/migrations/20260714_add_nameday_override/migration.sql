-- Add admin-controlled nameday override (MM-DD) for each user.
-- When set this takes precedence over the automatic first-name lookup.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nameDayOverride" TEXT;
