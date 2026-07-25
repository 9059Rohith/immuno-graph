# Domain Model

## 1. Purpose and authority

This document is the canonical vocabulary and invariant specification for ImmunoGraph. It defines domain entities, value objects, lifecycle states, identities, relationships, and aggregate boundaries.

When another specification uses a domain term, its meaning must match this document. A conflict is a specification defect and blocks implementation until the affected documents are aligned; it must not be resolved silently in code.

This model preserves the product boundary established in `PROJECT_SPEC.md` and `LIMITATIONS.md`: ImmunoGraph performs computational epitope prioritization, not vaccine discovery or experimental validation.

## 2. Domain principles

1. Scientific observations are immutable facts about a particular tool execution.
2. Derived evidence always references the observations and profile versions from which it was calculated.
3. Run lifecycle, run quality, scientific category, and researcher disposition are separate concepts.
4. MHC-I, MHC-II, and B-cell candidates belong to separate scientific tracks.
5. Connector provenance is explicit and cannot be relabeled.
6. Fixtures are deterministic demo/test evidence, not fresh scientific results.
7. An LLM cannot create or mutate any scientific entity in this model.
8. Coordinates are one-based and inclusive at all domain, API, database, and UI boundaries.
9. Every scientific or approval snapshot has a canonical hash.

## 3. Shared scalar value objects

The TypeScript implementation should use branded types inferred from Zod schemas rather than interchangeable strings.

```ts
type Uuid = string;
type Sha256 = string;
type IsoInstant = string;

type ProjectId = Uuid;
type ProteinInputId = Uuid;
type WorkflowRunId = Uuid;
type WorkflowStageId = Uuid;
type CandidateId = Uuid;
type PredictionObservationId = Uuid;
type PredictorExecutionId = Uuid;
type EvidenceSummaryId = Uuid;
type ConstraintOutcomeId = Uuid;
type RankingResultId = Uuid;
type ApprovalId = Uuid;
type ArtifactId = Uuid;
type WorkflowEventId = Uuid;
type AgentDecisionId = Uuid;

type OneBasedPosition = number;
type UnitInterval = number;
type PositiveInteger = number;
```

### Scalar invariants

- UUIDs use one accepted canonical UUID format throughout the repository.
- SHA-256 values are lowercase, 64-character hexadecimal strings.
- `IsoInstant` is a UTC ISO 8601 timestamp.
- `UnitInterval` is finite and in `[0, 1]`.
- Domain numbers must be finite.
- `start <= end` and `length = end - start + 1`.
- Peptide sequences are uppercase and contain only residues allowed by the run's validation profile.

## 4. Canonical enums

### 4.1 Candidate track

```ts
type CandidateType = 'MHCI' | 'MHCII' | 'BCELL';
```

These tracks are never merged into one ranking.

### 4.2 Run lifecycle status

```ts
type RunStatus =
  | 'DRAFT'
  | 'AWAITING_CONFIGURATION_APPROVAL'
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_SHORTLIST_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';
```

`PARTIAL` and `FIXTURE_ONLY` are not run statuses.

### 4.3 Run quality

```ts
type RunQuality = 'COMPLETE' | 'PARTIAL' | 'FIXTURE_ONLY';
```

- `COMPLETE`: all required configured branches produced sufficient valid scientific evidence.
- `PARTIAL`: the workflow completed under policy despite at least one requested branch or required evidence component being unavailable.
- `FIXTURE_ONLY`: every successful prediction observation used by the run came from approved fixtures and no required branch failed.

Failed and cancelled runs have no final `RunQuality`.

### 4.4 Stage status

```ts
type StageStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'SKIPPED';
```

### 4.5 Connector source status

```ts
type SourceStatus = 'LIVE' | 'CACHED' | 'SYNTHETIC' | 'FIXTURE' | 'FAILED';
```

`FAILED` describes a predictor execution. `SYNTHETIC` observations are demonstration records with `scientificUse=false`; they are not scientific evidence. Failed executions produce no observation.

### 4.5.1 Requested and resolved execution modes

```ts
type RequestedExecutionMode = 'AUTO' | 'LIVE' | 'SYNTHETIC' | 'FIXTURE';
type ExecutionMode = 'LIVE' | 'SYNTHETIC' | 'FIXTURE' | 'HYBRID';
```

The requested mode is immutable configuration intent. The resolved mode is derived only from persisted successful predictor provenance. `HYBRID` means more than one resolved source class contributed, such as synthetic T-cell evidence plus fixture-only GraphBepi evidence.

### 4.6 Connector health

```ts
type ConnectorHealthStatus =
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'NOT_CONFIGURED';
```

Health is operational availability, not scientific validity.

### 4.7 Fallback policy

```ts
type FallbackPolicy =
  | 'LIVE_ONLY'
  | 'CACHE_THEN_LIVE'
  | 'CACHE_THEN_LIVE_THEN_FIXTURE'
  | 'LIVE_THEN_CACHE_THEN_FIXTURE'
  | 'FIXTURE_ONLY';
```

Semantics:

- `LIVE_ONLY`: call the live connector; failure remains `FAILED`.
- `CACHE_THEN_LIVE`: reuse an exact valid cache entry first; otherwise call live; no fixture.
- `CACHE_THEN_LIVE_THEN_FIXTURE`: exact cache, then live, then exact approved fixture for an eligible failure.
- `LIVE_THEN_CACHE_THEN_FIXTURE`: call live first, then reuse an exact valid cache after eligible live failure, then use an exact approved fixture.
- `FIXTURE_ONLY`: do not call live or cache; require an exact approved fixture.

### 4.8 Scientific decision category

```ts
type DecisionCategory = 'RECOMMENDED' | 'REVIEW' | 'REJECTED';
```

This is produced by deterministic rules and ranking.

### 4.9 Researcher disposition

```ts
type ReviewDisposition = 'PENDING' | 'APPROVED' | 'EXCLUDED';
```

This is a human decision. `REJECTED` candidates cannot become `APPROVED` without a new run/profile and new scientific decision snapshot.

### 4.10 Confidence label

```ts
type EvidenceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_APPLICABLE';
```

Confidence describes evidence completeness/agreement, not efficacy, safety, or experimental confidence.

### 4.11 Rule vocabulary

```ts
type RuleSeverity = 'HARD' | 'SOFT';
type RuleOutcomeStatus = 'PASS' | 'WARN' | 'FAIL' | 'NOT_EVALUATED';
```

### 4.12 Approval vocabulary

```ts
type ApprovalType = 'CONFIGURATION' | 'SHORTLIST';
type ApprovalDecision = 'APPROVED' | 'REJECTED';
```

### 4.13 Scoring phase

```ts
type ScoringPhase = 'PRELIMINARY' | 'FINAL';
```

Preliminary scoring is used only to resolve deterministic overlap dominance. Final scoring occurs after the complete constraint snapshot exists.

### 4.14 Explanation generation mode

```ts
type GenerationMode = 'DETERMINISTIC' | 'LLM' | 'DETERMINISTIC_FALLBACK';
```

## 5. Aggregate boundaries

### Project aggregate

Owns project metadata and protein inputs. It does not own scientific observations directly.

### Workflow run aggregate

Owns one immutable configuration revision, stage lifecycle, observations, derived evidence, decisions, approvals, events, graph records, and artifacts.

### Reference-data aggregate

Owns versioned validation, connector, normalization, rule, ranking, fixture, and population metadata loaded from reviewed files.

### Cache aggregate

Owns reusable outputs originally produced by successful live executions. Fixture outputs never enter this aggregate.

## 6. Core entities

## 6.1 Project

```ts
type Project = {
  id: ProjectId;
  name: string;
  organism?: string;
  proteinName?: string;
  description?: string;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
};
```

Invariants:

- Name is required and 1–120 characters.
- Project metadata contains no clinical or patient data.
- Creating a project and creating a workflow run are separate domain commands.

## 6.2 ProteinInput

```ts
type ProteinInput = {
  id: ProteinInputId;
  projectId: ProjectId;
  originalFasta: string;
  header: string;
  normalizedSequence: string;
  sequenceLength: PositiveInteger;
  sequenceSha256: Sha256;
  validationProfile: ProfileSnapshotRef;
  warnings: ValidationWarning[];
  createdAt: IsoInstant;
};
```

The database record is the canonical source for the original and normalized FASTA in the MVP. Input artifacts are immutable export copies and must carry matching hashes.

## 6.3 Profile snapshot

```ts
type ProfileSnapshotRef = {
  profileId: string;
  profileVersion: string;
  profileSha256: Sha256;
  canonicalJson: string;
  scientificUseApproved: boolean;
};
```

The complete canonical profile is captured with the run. A version string alone is insufficient for reproducibility.

## 6.4 Run configuration

```ts
type RunConfiguration = {
  schemaVersion: string;
  proteinInputId: ProteinInputId;
  mhci: TCellAnalysisConfiguration;
  mhcii: TCellAnalysisConfiguration;
  bcell: BCellAnalysisConfiguration;
  populationCoverage: PopulationCoverageConfiguration;
  fallbackPolicy: FallbackPolicy;
  validationProfile: ProfileSnapshotRef;
  normalizationProfile: ProfileSnapshotRef;
  ruleProfile: ProfileSnapshotRef;
  rankingProfile: ProfileSnapshotRef;
  connectorRegistry: ProfileSnapshotRef;
  outputPreferences: OutputPreferences;
};
```

At least one of `mhci`, `mhcii`, or `bcell` must be enabled.

```ts
type OutputPreferences = {
  formats: Array<'JSON' | 'CSV'>;
  templateVersion: string;
  includeWorkflowTrace: boolean;
  includeEvidenceGraph: boolean;
};
```

Output preferences are included in the immutable run configuration snapshot after configuration approval.

```ts
type TCellAnalysisConfiguration = {
  enabled: boolean;
  alleles: string[];
  peptideLengths: number[];
  methods: ConnectorMethodSelection[];
};

type BCellAnalysisConfiguration = {
  enabled: boolean;
  methods: ConnectorMethodSelection[];
};

type ConnectorMethodSelection = {
  connectorId: string;
  connectorVersion: string;
  method: string;
  methodVersion: string;
  parameters: Record<string, unknown>;
};

type PopulationCoverageConfiguration = {
  enabled: boolean;
  populationIds: string[];
  classMode?: 'CLASS_I' | 'CLASS_II' | 'COMBINED';
  method?: ConnectorMethodSelection;
};
```

MVP B-cell invariants:

- GraphBepi is the only specified MVP B-cell method and is fixture-only.
- An enabled GraphBepi configuration requires a fallback policy that permits fixtures.
- The configuration is invalid if it requests live or cached GraphBepi execution.
- No structure or alignment artifact is accepted by the MVP run configuration.
- Conservation configuration is reserved for Product Phase 2 (post-MVP) and is not part of this schema.

## 6.5 WorkflowRun

```ts
type WorkflowRun = {
  id: WorkflowRunId;
  projectId: ProjectId;
  proteinInputId: ProteinInputId;
  revision: PositiveInteger;
  status: RunStatus;
  quality?: RunQuality;
  configuration: RunConfiguration;
  configurationSha256: Sha256;
  replaySha256?: Sha256;
  failureCode?: string;
  createdAt: IsoInstant;
  startedAt?: IsoInstant;
  completedAt?: IsoInstant;
  updatedAt: IsoInstant;
};
```

Invariants:

- Configuration becomes immutable after configuration approval.
- A configuration edit creates a new run revision.
- `quality` is assigned only to a completed run.
- `replaySha256` is assigned only after final scientific decisions are produced.

## 6.6 WorkflowStage

```ts
type WorkflowStage = {
  id: WorkflowStageId;
  runId: WorkflowRunId;
  stageKey: StageKey;
  attempt: PositiveInteger;
  status: StageStatus;
  dependencyStageKeys: StageKey[];
  inputSha256: Sha256;
  outputSha256?: Sha256;
  progress?: number;
  errorCode?: string;
  retryable?: boolean;
  startedAt?: IsoInstant;
  completedAt?: IsoInstant;
};
```

Canonical stage keys:

```ts
type StageKey =
  | 'validate_input'
  | 'configuration_approval'
  | 'generate_peptides'
  | 'predict_mhci'
  | 'predict_mhcii'
  | 'predict_bcell'
  | 'join_evidence'
  | 'normalize_scores'
  | 'compute_consensus'
  | 'calculate_candidate_coverage'
  | 'apply_base_constraints'
  | 'preliminary_scoring'
  | 'resolve_overlaps'
  | 'apply_final_constraints'
  | 'final_ranking'
  | 'optimize_shortlist_coverage'
  | 'shortlist_approval'
  | 'generate_exports';
```

Disabled scientific branches are `SKIPPED`.

## 6.7 Candidate

```ts
type Candidate = {
  id: CandidateId;
  runId: WorkflowRunId;
  candidateKey: Sha256;
  candidateType: CandidateType;
  sequence: string;
  start: OneBasedPosition;
  end: OneBasedPosition;
  length: PositiveInteger;
  allele?: string;
  createdAt: IsoInstant;
};
```

Candidate identity:

```text
T cell: sha256(proteinHash | candidateType | start | end | sequence | allele)
B cell: sha256(proteinHash | BCELL | start | end | sequence | regionProfile)
```

The same peptide at different positions represents different candidates. Multiple predictors observing the same positional candidate create multiple observations, not duplicate candidates. Exact duplicate candidate records use the full candidate key, including coordinates.

## 6.8 PredictorExecution

```ts
type PredictorExecution = {
  id: PredictorExecutionId;
  runId: WorkflowRunId;
  stageId: WorkflowStageId;
  connector: ConnectorMethodSelection;
  sourceStatus: SourceStatus;
  parametersSha256: Sha256;
  inputSha256: Sha256;
  outputSha256?: Sha256;
  cacheKey?: Sha256;
  fixtureId?: string;
  attemptCount: PositiveInteger;
  errorCode?: string;
  startedAt: IsoInstant;
  completedAt?: IsoInstant;
};
```

Invariants:

- `CACHED` requires `cacheKey`.
- `FIXTURE` requires `fixtureId`.
- `FAILED` requires `errorCode` and produces no observations.
- Attempt count includes the first call.

## 6.9 PredictionObservation

```ts
type PredictionObservation = {
  id: PredictionObservationId;
  runId: WorkflowRunId;
  candidateId: CandidateId;
  predictorExecutionId: PredictorExecutionId;
  sourceStatus: Exclude<SourceStatus, 'FAILED'>;
  rawScores: Record<string, number | string | null>;
  units: Record<string, string>;
  inputSha256: Sha256;
  outputSha256: Sha256;
  observedAt: IsoInstant;
  supersedesId?: PredictionObservationId;
};
```

Observations are append-only. Corrections create a new observation with `supersedesId`.

## 6.10 NormalizedObservation

```ts
type NormalizedObservation = {
  id: Uuid;
  runId: WorkflowRunId;
  candidateId: CandidateId;
  predictionObservationId: PredictionObservationId;
  field: string;
  rawValue: number;
  normalizedValue: UnitInterval;
  normalizationProfile: ProfileSnapshotRef;
  transformation: Record<string, unknown>;
  createdAt: IsoInstant;
};
```

A normalized value never replaces the raw observation.

## 6.11 EvidenceSummary

```ts
type EvidenceSummary = {
  id: EvidenceSummaryId;
  runId: WorkflowRunId;
  candidateId: CandidateId;
  snapshotSha256: Sha256;
  bindingQuality?: UnitInterval;
  predictorMean?: UnitInterval;
  variance?: UnitInterval;
  agreement?: UnitInterval;
  completeness: UnitInterval;
  consensus?: UnitInterval;
  confidence: EvidenceConfidence;
  sourceMix: SourceMix;
  details: Record<string, unknown>;
  createdAt: IsoInstant;
};

type SourceMix = {
  live: number;
  cached: number;
  fixture: number;
  failedExecutions: number;
};
```

Set-level population coverage is not an intrinsic candidate observation and is represented separately.

## 6.12 ConstraintOutcome

```ts
type ConstraintOutcome = {
  id: ConstraintOutcomeId;
  runId: WorkflowRunId;
  candidateId: CandidateId;
  snapshotSha256: Sha256;
  ruleId: string;
  ruleVersion: string;
  severity: RuleSeverity;
  outcome: RuleOutcomeStatus;
  evidenceRefs: string[];
  relatedCandidateId?: CandidateId;
  message: string;
  createdAt: IsoInstant;
};
```

Rule messages explain an already-computed outcome and cannot change it.

## 6.13 RankingResult

```ts
type RankingResult = {
  id: RankingResultId;
  runId: WorkflowRunId;
  candidateId: CandidateId;
  snapshotSha256: Sha256;
  profile: ProfileSnapshotRef;
  phase: ScoringPhase;
  track: CandidateType;
  componentScores: Record<string, number>;
  effectiveWeights: Record<string, number>;
  penalties: Record<string, number>;
  finalScore: UnitInterval;
  category: DecisionCategory;
  confidence: EvidenceConfidence;
  trackRank?: PositiveInteger;
  categoryRank?: PositiveInteger;
  createdAt: IsoInstant;
};
```

Preliminary ranking results have no final category, track rank, or category rank in storage; implementations may use a dedicated preliminary score type to enforce this more strictly. Final ranking occurs after overlap outcomes are complete.

## 6.14 Population coverage and shortlist selection

Population coverage is a property of an epitope/HLA set, not proof of individual candidate quality. A singleton set may provide the independent `candidateCoverage` ranking component for one T-cell candidate; it must be stored as a `PopulationCoverageResult` with `purpose = CANDIDATE_RANKING`.

```ts
type PopulationCoverageResult = {
  id: Uuid;
  runId: WorkflowRunId;
  populationId: string;
  classMode: 'CLASS_I' | 'CLASS_II' | 'COMBINED';
  candidateIds: CandidateId[];
  purpose: 'CANDIDATE_RANKING' | 'SHORTLIST_OPTIMIZATION' | 'FINAL_SHORTLIST';
  projectedCoverage: UnitInterval;
  averageHits?: number;
  pc90?: number;
  provenance: ConnectorProvenance;
  snapshotSha256: Sha256;
};

type ShortlistSelectionStep = {
  step: PositiveInteger;
  selectedCandidateId: CandidateId;
  marginalCoverageGain: number;
  cumulativeCoverage: UnitInterval;
  reasonCode: string;
};

type ShortlistOptimizationResult = {
  id: Uuid;
  runId: WorkflowRunId;
  track: 'MHCI' | 'MHCII';
  eligibleCandidateIds: CandidateId[];
  steps: ShortlistSelectionStep[];
  finalCoverage: PopulationCoverageResult;
  algorithmId: string;
  algorithmVersion: string;
  snapshotSha256: Sha256;
};
```

The deterministic sequence is:

1. calculate singleton coverage for each eligible T-cell candidate independently of any shortlist;
2. calculate individual scientific eligibility and final candidate ranking using the singleton result, without relying on an undefined final shortlist;
3. run deterministic coverage-aware shortlist optimization over eligible ranked candidates;
4. present both candidate rank and selection order;
5. calculate/report set-level population coverage for the proposed shortlist;
6. require researcher approval.

B-cell candidates do not participate in HLA population-coverage optimization.

## 6.15 Approval

```ts
type Approval = {
  id: ApprovalId;
  runId: WorkflowRunId;
  type: ApprovalType;
  decision: ApprovalDecision;
  snapshotSha256: Sha256;
  approvedCandidateIds: CandidateId[];
  excludedCandidateIds: CandidateId[];
  note?: string;
  createdAt: IsoInstant;
};
```

Configuration approval uses the configuration hash and has empty candidate lists. Shortlist approval uses the final ranking/selection snapshot. Approvals are append-only.

## 6.16 Candidate review projection

```ts
type CandidateReview = {
  candidateId: CandidateId;
  category: DecisionCategory;
  disposition: ReviewDisposition;
  rankingResultId: RankingResultId;
  approvalId?: ApprovalId;
};
```

This is a read model, not a separately mutable scientific entity.

## 6.17 Artifact

```ts
type Artifact = {
  id: ArtifactId;
  runId: WorkflowRunId;
  type: ArtifactType;
  format: string;
  relativePath: string;
  mimeType: string;
  byteSize: number;
  sha256: Sha256;
  templateVersion?: string;
  createdAt: IsoInstant;
};

type ArtifactType =
  | 'INPUT_COPY'
  | 'CANDIDATE_EXPORT'
  | 'REJECTED_CANDIDATE_EXPORT'
  | 'RUN_EXPORT'
  | 'EVIDENCE_GRAPH_EXPORT'
  | 'WORKFLOW_TRACE_EXPORT'
  | 'VISUALIZATION_MODEL'
  | 'REPORT';
```

Artifact paths are application-generated and must resolve beneath the artifact root.

## 6.18 WorkflowEvent

```ts
type WorkflowEvent = {
  id: WorkflowEventId;
  runId: WorkflowRunId;
  stageId?: WorkflowStageId;
  sequenceNumber: PositiveInteger;
  eventType: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  payload: Record<string, unknown>;
  createdAt: IsoInstant;
};
```

Events are append-only and sequence numbers are unique within a run.

## 6.19 AgentDecision

```ts
type AgentDecision = {
  id: AgentDecisionId;
  runId: WorkflowRunId;
  stageId: WorkflowStageId;
  agent: AgentName;
  action: string;
  reasonCode: string;
  evidenceRefs: string[];
  attempt: PositiveInteger;
  createdAt: IsoInstant;
};

type AgentName =
  | 'SUPERVISOR'
  | 'VALIDATION_AGENT'
  | 'PREDICTION_AGENT'
  | 'EVIDENCE_AGENT'
  | 'CONSTRAINT_AGENT'
  | 'RANKING_AGENT'
  | 'REPORT_AGENT';
```

This records bounded action decisions, not hidden chain-of-thought.

## 6.20 IdempotencyRecord

```ts
type IdempotencyRecord = {
  id: Uuid;
  scope: string;
  idempotencyKey: string;
  requestSha256: Sha256;
  responseStatus: number;
  responseJson?: string;
  resourceId?: Uuid;
  createdAt: IsoInstant;
  expiresAt: IsoInstant;
};
```

The same `(scope, idempotencyKey)` with a different request hash is a conflict.

## 6.21 Connector provenance

```ts
type ConnectorProvenance = {
  connectorId: string;
  connectorVersion: string;
  method: string;
  methodVersion: string;
  sourceStatus: Exclude<SourceStatus, 'FAILED'>;
  sourceUri?: string;
  cacheKey?: Sha256;
  fixtureId?: string;
  parameters: Record<string, unknown>;
};
```

## 7. B-cell region harmonization model

B-cell connectors may return residue scores, explicit segments, or both. Before consensus, each method must map its output into method-specific `PredictedRegion` records:

```ts
type PredictedRegion = {
  methodObservationId: PredictionObservationId;
  start: OneBasedPosition;
  end: OneBasedPosition;
  sequence: string;
  regionScore: UnitInterval;
  segmentationProfile: ProfileSnapshotRef;
};
```

Cross-method region harmonization requires a versioned algorithm profile defining:

- residue-to-segment threshold;
- minimum and maximum segment length;
- gap-merging distance;
- interval matching measure;
- matching threshold;
- canonical-region boundary rule;
- treatment of unmatched regions.

Until that profile is approved, multi-method B-cell consensus is disabled. One registered B-cell method may still produce an independently ranked B-cell track if the ranking profile explicitly permits single-method evidence and displays the resulting limitation.

## 8. Evidence graph model

Canonical node types:

```ts
type GraphNodeType =
  | 'PROTEIN'
  | 'CANDIDATE'
  | 'PREDICTION_OBSERVATION'
  | 'TOOL_VERSION'
  | 'HLA_ALLELE'
  | 'EVIDENCE_SUMMARY'
  | 'CONSTRAINT_RULE'
  | 'DECISION'
  | 'RANKING_RESULT'
  | 'COVERAGE_RESULT'
  | 'APPROVAL'
  | 'ARTIFACT';
```

Canonical edge types:

```ts
type GraphEdgeType =
  | 'HAS_CANDIDATE'
  | 'OBSERVED_BY'
  | 'PRODUCED_BY'
  | 'RESTRICTED_TO'
  | 'HAS_SUMMARY'
  | 'EVALUATED_BY'
  | 'PRODUCED_DECISION'
  | 'RANKED_AS'
  | 'INCLUDED_IN_COVERAGE_SET'
  | 'REVIEWED_IN'
  | 'DUPLICATE_OF'
  | 'OVERLAPS_WITH'
  | 'SUPERSEDES'
  | 'EXPORTED_AS';
```

Only registered edge types may be persisted. LLM output cannot create graph nodes or edges.

## 9. Run state transitions

```text
DRAFT
  -> AWAITING_CONFIGURATION_APPROVAL
  -> QUEUED
  -> RUNNING
  -> AWAITING_SHORTLIST_APPROVAL
  -> COMPLETED
```

Rules:

- `DRAFT -> AWAITING_CONFIGURATION_APPROVAL` requires a schema-valid normalized configuration.
- Configuration approval bound to `configurationSha256` causes `AWAITING_CONFIGURATION_APPROVAL -> QUEUED`.
- Starting the approved run causes `QUEUED -> RUNNING`.
- Successful final ranking/shortlist optimization causes `RUNNING -> AWAITING_SHORTLIST_APPROVAL`.
- Shortlist approval bound to the current snapshot causes `AWAITING_SHORTLIST_APPROVAL -> COMPLETED` after required exports can be generated or queued according to the API contract.
- Any nonterminal execution state may become `FAILED` after an unrecoverable required-stage failure.
- `QUEUED`, `RUNNING`, or an approval-wait state may become `CANCELLED` through an explicit cancellation command.
- Terminal runs do not return to a nonterminal state.

## 10. Stage ordering for scientific decisions

To avoid a circular dependency between overlap resolution and ranking, the canonical scientific stage order is:

```text
raw observations
  -> normalization
  -> consensus/evidence summaries
  -> singleton population coverage for T-cell candidates
  -> base constraints excluding overlap dominance
  -> preliminary scoring
  -> duplicate and overlap resolution
  -> final constraint snapshot
  -> final track-specific ranking
  -> coverage-aware shortlist optimization for T-cell tracks
  -> researcher approval
```

No final ranking is valid without a final constraint snapshot. Preliminary scores are not presented as final researcher recommendations.

## 11. Snapshot and replay boundaries

The following canonical hashes are required:

- `configurationSha256`
- observation snapshot hash
- evidence snapshot hash
- base-constraint snapshot hash
- preliminary-scoring snapshot hash
- final-constraint snapshot hash
- final-ranking snapshot hash
- shortlist-optimization snapshot hash when enabled
- approval snapshot hash
- replay hash

Timestamps, generated UUIDs, request IDs, and execution durations are excluded from deterministic scientific replay hashes.

## 12. Cross-entity invariants

1. All referenced entities belong to the same run unless the reference is an approved global profile or connector descriptor.
2. A candidate's peptide must equal the corresponding slice of the run's normalized protein sequence.
3. An observation's candidate type and allele semantics must match its predictor method.
4. A failed predictor execution has no observations.
5. A normalized observation references exactly one raw numeric field.
6. A constraint outcome references the evidence snapshot it evaluated.
7. A final ranking references the final constraint snapshot.
8. A rejected candidate cannot have `ReviewDisposition = APPROVED`.
9. Shortlist approval references the current final ranking/optimization snapshot.
10. Fixture use never changes a scientific score solely because it is a fixture; it changes provenance and run-quality presentation.
11. Population coverage is reported as estimated set-level evidence, never vaccine efficacy.
12. An LLM explanation references an immutable decision snapshot and cannot modify it.
13. A GraphBepi predictor execution has source status `FIXTURE` or `FAILED`; it can never have `LIVE` or `CACHED` in the MVP.
14. Conservation values, configuration, rules, stages, and artifacts are invalid in the MVP schema.

## 13. Required persistence additions

`DATABASE_SCHEMA.md` must be aligned before implementation to persist:

- complete profile snapshots and hashes;
- scoring phase or separate preliminary/final scoring records;
- `trackRank` and `categoryRank`;
- set-level population coverage and shortlist-optimization steps;
- `AgentDecision`;
- `IdempotencyRecord`;
- B-cell predicted-region harmonization when enabled;
- explicit researcher disposition projection or its derivation contract.

## 14. Required API additions

`API_SPEC.md` must be aligned before implementation to define:

- `Idempotency-Key` behavior;
- separate run status, run quality, decision category, and researcher disposition fields;
- preliminary/final ranking fields only where appropriate;
- shortlist optimization and population-coverage result endpoints/view models;
- canonical error-code mapping across REST and MCP.
