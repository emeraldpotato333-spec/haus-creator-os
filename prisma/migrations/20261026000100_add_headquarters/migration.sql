-- Additive only. No existing creator data or automation state is altered.
CREATE TABLE "HqRecord" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HqRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HqRecord_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "HqAudit" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "requestJson" JSONB NOT NULL,
    "beforeJson" JSONB NOT NULL,
    "afterJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HqAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HqRecord_updatedAt_idx" ON "HqRecord"("updatedAt");
CREATE INDEX "HqRecord_creatorId_idx" ON "HqRecord"("creatorId");
CREATE UNIQUE INDEX "HqAudit_mutationId_key" ON "HqAudit"("mutationId");
CREATE INDEX "HqAudit_recordId_createdAt_idx" ON "HqAudit"("recordId", "createdAt");
ALTER TABLE "HqAudit" ADD CONSTRAINT "HqAudit_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "HqRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
