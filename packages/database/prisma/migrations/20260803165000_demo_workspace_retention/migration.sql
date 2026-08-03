ALTER TABLE "Project" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "demoExpiresAt" DATETIME;

CREATE INDEX "Project_isDemo_demoExpiresAt_idx" ON "Project"("isDemo", "demoExpiresAt");
