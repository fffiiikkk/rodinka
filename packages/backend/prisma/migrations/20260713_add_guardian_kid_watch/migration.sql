-- CreateTable: Guardian-kid watch assignments (implicit many-to-many)
-- A guardian can be assigned to watch specific kids in the kids timeline.
-- If no rows exist for a guardian, they see all kids (unfiltered default).
CREATE TABLE IF NOT EXISTS "_GuardianKids" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_GuardianKids_AB_unique" ON "_GuardianKids"("A", "B");
CREATE INDEX IF NOT EXISTS "_GuardianKids_B_index" ON "_GuardianKids"("B");

-- AddForeignKey
ALTER TABLE "_GuardianKids" ADD CONSTRAINT "_GuardianKids_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GuardianKids" ADD CONSTRAINT "_GuardianKids_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
