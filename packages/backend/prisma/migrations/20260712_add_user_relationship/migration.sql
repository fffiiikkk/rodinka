-- Add relationship field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "relationship" VARCHAR(100);
