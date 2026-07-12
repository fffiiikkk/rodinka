-- Add nickname field to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" VARCHAR(60);
