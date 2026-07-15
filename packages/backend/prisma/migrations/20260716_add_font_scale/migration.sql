-- Migration: Add fontScale preference to User

ALTER TABLE "User" ADD COLUMN "fontScale" TEXT NOT NULL DEFAULT 'NORMAL';
