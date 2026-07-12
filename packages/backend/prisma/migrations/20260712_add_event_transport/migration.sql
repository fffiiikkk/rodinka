-- Add transport responsibility fields to Event
ALTER TABLE "Event" ADD COLUMN "transportUserId"       TEXT;
ALTER TABLE "Event" ADD COLUMN "transportExternalName" VARCHAR(100);
ALTER TABLE "Event" ADD COLUMN "transportNote"         VARCHAR(300);

ALTER TABLE "Event" ADD CONSTRAINT "Event_transportUserId_fkey"
  FOREIGN KEY ("transportUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
