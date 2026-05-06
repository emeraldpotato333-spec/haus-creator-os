ALTER TABLE "Creator"
ADD COLUMN "exactStep" TEXT;

CREATE INDEX "Creator_exactStep_idx" ON "Creator"("exactStep");
