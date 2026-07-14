-- Phase 1: School schedule import
CREATE TABLE "ScheduleImport" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "createdById"  TEXT NOT NULL,
  "validFrom"    TIMESTAMP(3) NOT NULL,
  "validTo"      TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScheduleImport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "scheduleImportId" TEXT;
ALTER TABLE "Event" ADD CONSTRAINT "Event_scheduleImportId_fkey" FOREIGN KEY ("scheduleImportId") REFERENCES "ScheduleImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 2: External calendar subscriptions
CREATE TABLE "ExternalCalendarSubscription" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "icsUrl"         TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt"     TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalCalendarSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalCalendarSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "externalSourceId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "externalUid"      TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isExternalImport"  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Event" ADD CONSTRAINT "Event_externalSourceId_fkey" FOREIGN KEY ("externalSourceId") REFERENCES "ExternalCalendarSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 3: Geocoded location coordinates
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "locationLat" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "locationLng" DOUBLE PRECISION;

-- Phase 4: Online meeting info
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "meetingProvider" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "meetingUrl"      TEXT;

-- Phase 5: Fridge notes
CREATE TABLE "FridgeNote" (
  "id"          TEXT NOT NULL,
  "authorId"    TEXT NOT NULL,
  "contentHtml" TEXT NOT NULL,
  "color"       TEXT,
  "isPinned"    BOOLEAN NOT NULL DEFAULT false,
  "expiresAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FridgeNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FridgeNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FridgeNoteAttachment" (
  "id"         TEXT NOT NULL,
  "noteId"     TEXT NOT NULL,
  "fileName"   TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL,
  "size"       INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FridgeNoteAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FridgeNoteAttachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "FridgeNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
