# Data Specification

## 1. Data policy

Store only data required for deterministic execution, validation, reproducibility, and a reliable demonstration. Do not mirror entire scientific databases.

Locally stored data falls into four classes:

1. small versioned reference data;
2. immutable curated fixtures;
3. runtime records and live-result cache in SQLite;
4. generated artifacts.

Source-backed public facts remain distinguishable from synthetic demo values. Restricted,
license-unclear, sensitive, or unavailable values are not copied or inferred: a schema-compatible
synthetic replacement may be committed only when it is labeled `sourceKind: "SYNTHETIC"` and
`scientificUse: false`. Synthetic data is for validation, tests, and deterministic demonstrations
only; it is not research evidence.

## 2. Directory layout

```text
data/
  README.md
  profiles/
    biological-constraints.mvp-v1.0.json
    ranking.mvp-v1.0.json
  reference/
    amino-acids.v1.json
    hla-alleles.<source-version>.json
    normalization-profiles.v1.json
    connector-registry.v1.json
  fixtures/
    manifest.v1.json
    covid-spike/
      input.fasta
      case.json
      expected-candidates.json
      expected-report.json
    influenza/
      input.fasta
      case.json
      expected-candidates.json
      expected-report.json
    dengue/
      input.fasta
      case.json
      expected-candidates.json
      expected-report.json
  schemas/
    fixture-case.schema.json
    prediction-observation.schema.json
    reference-manifest.schema.json
  generated/               gitignored exports for local development
```

Runtime cache belongs in SQLite, not `data/fixtures`.

## 3. Reference datasets

### 3.1 Amino-acid dictionary

```ts
type AminoAcidRecord = {
  oneLetter: string;
  threeLetter: string;
  name: string;
  standard: boolean;
  allowedInStrictProfile: boolean;
};
```

Requirements:

- exactly one record per supported character;
- uppercase keys;
- version and SHA-256 in the reference manifest;
- ambiguous and non-standard residues explicitly represented even when disallowed.

### 3.2 HLA allele registry

The initial local registry is for input validation and method compatibility. Population-frequency values may be included only when their source, geographic/ethnic population definition, unit, collection date/version, and license are documented.

```ts
type HlaAlleleRecord = {
  allele: string;
  mhcClass: 'I' | 'II';
  locus: string;
  aliases: string[];
  supportedBy: Array<{
    connectorId: string;
    method: string;
    methodVersion: string;
    peptideLengths: number[];
  }>;
  populationFrequencies?: Array<{
    populationId: string;
    value: number;
    frequencyType: 'GENOTYPIC' | 'ALLELIC';
    sourceId: string;
  }>;
};
```

Never infer missing frequencies. Synthetic aggregate frequencies use synthetic population IDs, a
local source URN, `sourceKind: "SYNTHETIC"`, and `scientificUse: false`; they are demo inputs, not
measured population estimates. The IEDB population-coverage connector remains the preferred
calculation source for live runs.

### 3.3 Biological constraint profile

Immutable workflow profiles are stored under `data/profiles/`, validated when loaded, canonicalized according to section 8, and hashed with SHA-256. Only `{ name, version, hash }` metadata is persisted in a run's immutable `configurationJson` snapshot. Profile definitions are never persisted in SQLite.

```json
{
  "name": "biological-constraints",
  "version": "mvp-v1.0",
  "scientificUse": false,
  "mhci": { "peptideLengths": [8, 9, 10, 11] },
  "mhcii": { "peptideLengths": [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
  "binding": { "percentileRankMaximum": 2.0 },
  "agreement": { "reviewBelow": 0.6 },
  "overlap": { "containmentMaximum": 0.8 },
  "populationCoverage": { "enabled": true }
}
```

The committed default is labeled `scientificUse: false` until a qualified reviewer approves it. Production-like runs must display this status.
This biological-constraint file is also the MVP's default rule profile; no separate rule-profile persistence model or duplicate profile file is introduced.

### 3.4 Normalization registry

Each `(connector, method, version, field)` maps to:

- raw field name and unit;
- direction (`LOWER_BETTER` or `HIGHER_BETTER`);
- normalization type and parameters;
- valid raw domain;
- source documentation link;
- registry version.

Unregistered outputs remain raw evidence and cannot enter ranking.

### 3.5 Ranking profiles

Store candidate-track-specific component weights, penalties, category thresholds, and required evidence. Weights must sum to `1.0` within a tolerance of `1e-9` after disabled-component redistribution.

The frozen `mvp-v1.0` T-cell weights are binding `0.40`, consensus `0.30`, singleton population coverage `0.20`, and completeness `0.10`. The frozen B-cell weights are normalized GraphBepi fixture score `0.90` and completeness `0.10`. Conservation is not a valid MVP component. Weight customization is disabled for MVP v1.0.

### 3.6 Synthetic demo proteins

The local reference bundle includes five manifest-verified artificial protein sequences. Three are
the inputs for approved exact-match replay cases; two are input-validation examples only. All five
declare `sourceKind: SYNTHETIC` and `scientificUse: false` and are not pathogen reference sequences.
Prediction requests for the two input-only examples must fail closed because no matching scientific
fixture exists.

## 4. Fixture specification

Fixtures are curated synthetic test/demo evidence, not a cache and not a scientific database.
Their protein sequences and scores must not be described as pathogen reference data or as provider
predictions. They preserve provider-compatible schemas solely to exercise the offline workflow.

### 4.1 Fixture identity

```ts
type FixtureManifestEntry = {
  fixtureId: string;
  fixtureVersion: string;
  casePath: string;
  proteinSha256: string;
  supportedRunProfile: string;
  connectorMethods: Array<{
    connectorId: string;
    connectorVersion: string;
    method: string;
    methodVersion: string;
    parametersHash: string;
  }>;
  createdAt: string;
  reviewedBy: string;
  reviewStatus: 'DRAFT' | 'APPROVED';
  sourceNotes: string;
  contentSha256: string;
};
```

Only `APPROVED` fixtures may be selected automatically.

Every MVP demo fixture must include a GraphBepi prediction payload when its supported run profile enables B-cell analysis. GraphBepi fixture observations use source status `FIXTURE`; they are never copied into the live-result cache.

### 4.2 Fixture case

Each `case.json` contains:

```ts
type FixtureCase = {
  schemaVersion: '1.0';
  fixtureId: string;
  input: {
    fastaFile: string;
    proteinSha256: string;
    projectMetadata: { proteinName: string; organism: string };
  };
  runConfiguration: RunConfiguration;
  predictorExecutions: FixturePredictorExecution[];
  expected: {
    generatedPeptideHash: string;
    candidateCountsByTrack: Record<string, number>;
    recommendedCandidateKeys: string[];
    reviewCandidateKeys: string[];
    rejectedCandidateKeys: string[];
    rankingReplayHash: string;
    reportSnapshotPath: string;
  };
};
```

Every fixture predictor execution includes the raw provider-shaped sample, parsed canonical
observations, method/version/parameters, and the reason it is safe to use for the demo. Synthetic
payloads declare `sourceKind: "SYNTHETIC"` and `scientificUse: false`; canonical observations use
`sourceStatus: "FIXTURE"`. No predictor score may be attributed to a live provider.

### 4.3 Fixture matching

A fixture matches only when all values are equal:

- normalized protein SHA-256;
- candidate track;
- connector and method version;
- HLA allele set;
- peptide-length set;
- scientific parameters hash;
- output schema version;
- approved run profile.

No fuzzy fixture matching is allowed.

## 5. Live-result cache

The cache is stored in `CacheEntry` records in SQLite.

Cache value requirements:

- canonical parsed output, never just an opaque provider body;
- optional redacted raw response artifact for debugging;
- connector/method versions;
- cache key from [ALGORITHM_SPEC.md](ALGORITHM_SPEC.md);
- creation and expiration timestamps;
- validation schema version;
- output hash;
- status of the original execution, which must have been `LIVE`.

Only successful, schema-valid live results enter the reusable cache. Fixture results never populate the live cache.

## 6. Prediction observation schema

```ts
type PredictionObservation = {
  observationId: string;
  runId: string;
  candidateKey: string;
  candidateType: 'MHCI' | 'MHCII' | 'BCELL';
  peptide?: string;
  start: number;
  end: number;
  allele?: string;
  rawScores: Record<string, number | string | null>;
  units: Record<string, string>;
  provenance: ConnectorProvenance;
  observedAt: string;
  inputHash: string;
  outputHash: string;
};
```

Provider-specific rows are converted to this schema by connector parsers. Raw field names remain available under `rawScores`.

## 7. Artifact layout

```text
artifacts/{runId}/
  input/
    original.fasta
    normalized.fasta
  exports/
    candidates.csv
    rejected-candidates.csv
    run.json
    evidence-graph.json
    workflow-trace.json
  visualizations/
    sequence-map.json
    population-coverage.json
    workflow-graph.json
    evidence-graph.json
```

Visualization files are view-model JSON. The web application renders them through Recharts or React Flow. Optional raster/PDF rendering is a later capability.

## 8. Canonical JSON

Hashes use UTF-8 JSON with:

- object keys sorted recursively;
- arrays sorted only where the domain declares order irrelevant;
- no insignificant whitespace;
- UTC ISO 8601 timestamps;
- finite numbers only;
- omitted optional values rather than `undefined`.

## 9. Dataset provenance manifest

Every committed reference file has a manifest entry:

```ts
type ReferenceManifestEntry = {
  id: string;
  version: string;
  path: string;
  sha256: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  license: string;
  transformationScript?: string;
  transformationVersion?: string;
  reviewedBy: string;
  notes?: string;
};
```

Generated or manually edited scientific data without a manifest entry fails CI validation.

## 10. Data not stored locally

- entire IEDB database;
- entire AlphaFold or PDB archives;
- predictor training data or binaries that are not explicitly redistributable for this project;
- PubChem;
- a scientific-paper corpus;
- patient or clinical records.

## 11. Retention

- Projects and approved runs: retained until researcher deletes the local workspace.
- Live cache: default 30 days, additionally invalidated by connector/method/profile version change.
- Failed raw connector bodies: not retained by default.
- Pino logs: rotate/limit by local configuration; default seven days in development.
- Temporary files: deleted after stage completion or cancellation.

Deletion is a local destructive operation and must require explicit UI confirmation.

## 12. Data acceptance checklist

- Schema-valid.
- Hash matches manifest.
- Source and license recorded.
- Coordinates verified as one-based inclusive at boundaries.
- Numeric directions and units documented.
- Fixture clearly labeled and approved.
- Expected replay hash passes.
- No private, clinical, or secret data included.
