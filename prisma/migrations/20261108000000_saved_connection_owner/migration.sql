-- Existing rows get an empty owner, so no browser can see them.
ALTER TABLE "SavedConnection" ADD COLUMN "ownerId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "SavedConnection_ownerId_idx" ON "SavedConnection"("ownerId");
