-- Add transport direction and supervision coverage to Event
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "transportDirection"          TEXT,
  ADD COLUMN IF NOT EXISTS "transportCoversSupervision"  BOOLEAN;
