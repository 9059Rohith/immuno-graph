-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organism" TEXT,
    "proteinName" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProteinInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "originalFasta" TEXT NOT NULL,
    "header" TEXT NOT NULL,
    "normalizedSequence" TEXT NOT NULL,
    "sequenceLength" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "validationProfileVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProteinInput_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "proteinInputId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "quality" TEXT,
    "configurationJson" TEXT NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "ruleProfileVersion" TEXT NOT NULL,
    "rankingProfileVersion" TEXT NOT NULL,
    "replayHash" TEXT,
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowRun_proteinInputId_fkey" FOREIGN KEY ("proteinInputId") REFERENCES "ProteinInput" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dependencyKeysJson" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "progress" REAL,
    "errorCode" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowStage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stageId" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkflowEvent_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictorExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "connectorVersion" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL,
    "parametersJson" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT,
    "cacheKey" TEXT,
    "fixtureId" TEXT,
    "attemptCount" INTEGER NOT NULL,
    "errorCode" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "PredictorExecution_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictorExecution_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateKey" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "peptide" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,
    "allele" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Candidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PredictionObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "predictorExecutionId" TEXT NOT NULL,
    "rawScoresJson" TEXT NOT NULL,
    "unitsJson" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    CONSTRAINT "PredictionObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionObservation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionObservation_predictorExecutionId_fkey" FOREIGN KEY ("predictorExecutionId") REFERENCES "PredictorExecution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PredictionObservation_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "PredictionObservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NormalizedObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "predictionObservationId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "rawValue" REAL NOT NULL,
    "normalizedValue" REAL NOT NULL,
    "profileVersion" TEXT NOT NULL,
    "transformationJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NormalizedObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NormalizedObservation_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NormalizedObservation_predictionObservationId_fkey" FOREIGN KEY ("predictionObservationId") REFERENCES "PredictionObservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "bindingQuality" REAL,
    "weightedMean" REAL,
    "variance" REAL,
    "agreement" REAL,
    "completeness" REAL NOT NULL,
    "consensus" REAL,
    "detailsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceSummary_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EvidenceSummary_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConstraintOutcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "evidenceRefsJson" TEXT NOT NULL,
    "relatedCandidateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstraintOutcome_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstraintOutcome_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstraintOutcome_relatedCandidateId_fkey" FOREIGN KEY ("relatedCandidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankingResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "profileVersion" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "componentScoresJson" TEXT NOT NULL,
    "penaltiesJson" TEXT NOT NULL,
    "finalScore" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankingResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RankingResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PopulationCoverageResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "populationId" TEXT NOT NULL,
    "classMode" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "candidateIdsJson" TEXT NOT NULL,
    "projectedCoverage" REAL NOT NULL,
    "averageHits" REAL,
    "pc90" REAL,
    "provenanceJson" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PopulationCoverageResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortlistOptimizationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "eligibleCandidateIdsJson" TEXT NOT NULL,
    "finalCoverageResultId" TEXT NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortlistOptimizationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortlistOptimizationResult_finalCoverageResultId_fkey" FOREIGN KEY ("finalCoverageResultId") REFERENCES "PopulationCoverageResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShortlistSelectionStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shortlistOptimizationResultId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "selectedCandidateId" TEXT NOT NULL,
    "marginalCoverageGain" REAL NOT NULL,
    "cumulativeCoverage" REAL NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortlistSelectionStep_shortlistOptimizationResultId_fkey" FOREIGN KEY ("shortlistOptimizationResultId") REFERENCES "ShortlistOptimizationResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShortlistSelectionStep_selectedCandidateId_fkey" FOREIGN KEY ("selectedCandidateId") REFERENCES "Candidate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "selectionJson" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "templateVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Artifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "propertiesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GraphNode_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "propertiesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GraphEdge_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GraphEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "GraphNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GraphEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "GraphNode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CacheEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "connectorVersion" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "ProteinInput_sha256_idx" ON "ProteinInput"("sha256");

-- CreateIndex
CREATE INDEX "ProteinInput_projectId_sha256_idx" ON "ProteinInput"("projectId", "sha256");

-- CreateIndex
CREATE INDEX "WorkflowRun_status_createdAt_idx" ON "WorkflowRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_proteinInputId_idx" ON "WorkflowRun"("proteinInputId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_projectId_revision_key" ON "WorkflowRun"("projectId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStage_runId_stageKey_attempt_key" ON "WorkflowStage"("runId", "stageKey", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_runId_sequenceNumber_key" ON "WorkflowEvent"("runId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "Candidate_runId_candidateType_idx" ON "Candidate"("runId", "candidateType");

-- CreateIndex
CREATE INDEX "Candidate_runId_start_end_idx" ON "Candidate"("runId", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_runId_candidateKey_key" ON "Candidate"("runId", "candidateKey");

-- CreateIndex
CREATE UNIQUE INDEX "NormalizedObservation_predictionObservationId_field_profileVersion_key" ON "NormalizedObservation"("predictionObservationId", "field", "profileVersion");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSummary_candidateId_snapshotHash_key" ON "EvidenceSummary"("candidateId", "snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "ConstraintOutcome_candidateId_snapshotHash_ruleId_ruleVersion_key" ON "ConstraintOutcome"("candidateId", "snapshotHash", "ruleId", "ruleVersion");

-- CreateIndex
CREATE INDEX "RankingResult_runId_track_category_rank_idx" ON "RankingResult"("runId", "track", "category", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "RankingResult_candidateId_snapshotHash_profileVersion_key" ON "RankingResult"("candidateId", "snapshotHash", "profileVersion");

-- CreateIndex
CREATE INDEX "PopulationCoverageResult_runId_populationId_purpose_idx" ON "PopulationCoverageResult"("runId", "populationId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistOptimizationResult_runId_track_snapshotHash_key" ON "ShortlistOptimizationResult"("runId", "track", "snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShortlistSelectionStep_shortlistOptimizationResultId_step_key" ON "ShortlistSelectionStep"("shortlistOptimizationResultId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "GraphNode_runId_nodeType_entityId_key" ON "GraphNode"("runId", "nodeType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "GraphEdge_runId_edgeType_sourceNodeId_targetNodeId_key" ON "GraphEdge"("runId", "edgeType", "sourceNodeId", "targetNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "CacheEntry_cacheKey_key" ON "CacheEntry"("cacheKey");

-- CreateIndex
CREATE INDEX "CacheEntry_connectorId_idx" ON "CacheEntry"("connectorId");

-- CreateIndex
CREATE INDEX "CacheEntry_expiresAt_idx" ON "CacheEntry"("expiresAt");
