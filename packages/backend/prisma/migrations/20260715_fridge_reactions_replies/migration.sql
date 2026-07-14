-- Migration: Add FridgeNoteReaction and FridgeNoteReply

CREATE TABLE "FridgeNoteReaction" (
    "id"        TEXT         NOT NULL,
    "noteId"    TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "emoji"     TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FridgeNoteReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FridgeNoteReaction_noteId_userId_emoji_key"
    ON "FridgeNoteReaction"("noteId", "userId", "emoji");

ALTER TABLE "FridgeNoteReaction"
    ADD CONSTRAINT "FridgeNoteReaction_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "FridgeNote"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FridgeNoteReaction"
    ADD CONSTRAINT "FridgeNoteReaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────

CREATE TABLE "FridgeNoteReply" (
    "id"        TEXT         NOT NULL,
    "noteId"    TEXT         NOT NULL,
    "authorId"  TEXT         NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FridgeNoteReply_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FridgeNoteReply"
    ADD CONSTRAINT "FridgeNoteReply_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "FridgeNote"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FridgeNoteReply"
    ADD CONSTRAINT "FridgeNoteReply_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
