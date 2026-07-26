CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "StructureModel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceReference" TEXT,
  "format" TEXT NOT NULL,
  "artifactPath" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "sequenceHash" TEXT,
  "provider" TEXT NOT NULL,
  "providerVersion" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DockingJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "receptorId" TEXT NOT NULL,
  "ligandId" TEXT NOT NULL,
  "engine" TEXT NOT NULL,
  "engineVersion" TEXT,
  "status" TEXT NOT NULL,
  "parametersJson" TEXT NOT NULL,
  "score" REAL,
  "poseArtifactPath" TEXT,
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  CONSTRAINT "DockingJob_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "StructureModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DockingJob_ligandId_fkey" FOREIGN KEY ("ligandId") REFERENCES "StructureModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DockingJob_status_createdAt_idx" ON "DockingJob"("status", "createdAt");
