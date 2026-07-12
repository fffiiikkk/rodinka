-- Add external coverage fields to Availability
ALTER TABLE "Availability" ADD COLUMN "isExternal"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Availability" ADD COLUMN "externalName" VARCHAR(100);
ALTER TABLE "Availability" ADD COLUMN "externalRole" VARCHAR(100);
