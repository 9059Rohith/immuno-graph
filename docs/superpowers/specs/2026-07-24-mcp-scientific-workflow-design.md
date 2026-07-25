# MCP-Orchestrated Scientific Workflow Design

**Status:** Approved for implementation  
**Date:** 2026-07-24  
**Scope:** ImmunoGraph Studio MVP execution core

## Objective

Replace `InlineFixtureWorkflowPort` as the default execution path with a real, separately running
NitroStack MCP workflow. Fastify remains the lifecycle and persistence supervisor; scientific
validation, candidate generation, evidence processing, constraints, ranking, coverage, and report
composition execute through independently discoverable MCP tools. Exact approved fixtures remain a
policy-controlled fallback and GraphBepi remains fixture-only.

The offline synthetic predictor is a software-demonstration capability. It is never represented as
a live scientific predictor, never enters the live-result cache, and always carries
`scientificUse: false` and `validationStatus: DEMONSTRATION_ONLY`.

## Frozen boundaries

- One NitroStack MCP server with Prediction, Evidence, Constraint, and Report tool groups.
- No conservation or toxicity data, algorithms, fields, scoring components, or UI.
- T-cell ranking weights remain binding `0.40`, consensus `0.30`, population coverage `0.20`, and
  completeness `0.10`.
- B-cell ranking weights remain GraphBepi `0.90` and completeness `0.10`.
- GraphBepi remains exact-fixture-only.
- REST paths and existing required request fields remain unchanged.
- Profiles remain immutable files; only their name, version, and SHA-256 are stored in run
  snapshots.
- The UI reads scientific results only through REST/SQLite.

## Architecture

```text
Fastify route
    -> RunService (lifecycle owner)
    -> ScientificWorkflowService (orchestration owner)
    -> HttpMcpToolGateway (MCP protocol client)
    -> independently running NitroStack MCP server
    -> focused MCP tools
    -> pure algorithms or connector capability ports
    -> validated MCP result envelopes
    -> transaction-bound repositories
    -> SQLite
    -> REST read models
    -> React UI
```

The API package does not import scientific functions from `packages/algorithms` and does not import
MCP controllers. `ScientificWorkflowService` depends on `McpToolGateway`, `Repositories`,
`TransactionManager`, `FixtureRegistry`, and a structured logger. Tests may inject an in-memory
gateway; production and end-to-end integration use Streamable HTTP MCP transport.

## Execution intent and observed mode

Run creation adds the optional, backward-compatible field:

```text
requestedExecutionMode = AUTO | LIVE | SYNTHETIC | FIXTURE
```

Existing clients default to `AUTO`. A completed execution persists and returns:

```text
executionMode = LIVE | SYNTHETIC | FIXTURE | HYBRID
```

`HYBRID` is derived when required branches use more than one evidence source. Cached live output is
scientific evidence and contributes to `LIVE`, while each connector row continues to display
`CACHED` explicitly.

### Policy matrix

| Requested mode | Fallback policy | Resolution |
|---|---|---|
| `LIVE` | any non-fixture-only policy | configured live/cache order; fail closed |
| `SYNTHETIC` | any | synthetic tools only; requires `DEMO_MODE=true` |
| `FIXTURE` | fixture-permitting | exact approved fixture only |
| `AUTO` | `LIVE_ONLY` | live only |
| `AUTO` | `CACHE_THEN_LIVE` | cache, then live |
| `AUTO` | `CACHE_THEN_LIVE_THEN_FIXTURE` | cache, live, synthetic when demo mode is enabled, exact fixture |
| `AUTO` | `LIVE_THEN_CACHE_THEN_FIXTURE` | live, cache, synthetic when demo mode is enabled, exact fixture |
| `AUTO` | `FIXTURE_ONLY` | exact approved fixture only |

Only timeout, rate limit, unavailable dependency, and policy-approved connector failure advance to
the next source. Validation failure, unsupported configuration, malformed output, or hash mismatch
fails closed.

## MCP tool sequence

1. `validate_sequence` validates and normalizes FASTA using committed reference data.
2. `generate_candidate_peptides` creates positional MHC-I and MHC-II candidates.
3. Prediction resolution invokes `predict_mhci`/`predict_mhcii`,
   `predict_synthetic_binding`, or the exact-fixture predictor capability according to policy.
4. GraphBepi invokes `predict_bcell` and can return only `FIXTURE` or failure.
5. `normalize_scores` applies registered normalization profiles.
6. `compute_consensus` produces evidence summaries.
7. `calculate_population_coverage` uses a registered live/fixture capability; synthetic mode invokes
   `calculate_synthetic_population_coverage` using the versioned synthetic HLA dataset.
8. `apply_constraint_rules` evaluates base rules, positional duplicates, and overlaps.
9. `rank_candidates` computes preliminary and final rankings from the loaded ranking profile.
10. `optimize_shortlist_coverage` produces deterministic shortlist coverage steps.
11. Report creation invokes `generate_report`; the API stores returned bytes and artifact metadata.

Every tool call is Zod validated and returns the existing success/failure envelope plus provenance.
The API validates the envelope again before persistence.

## Synthetic algorithms

### Binding demonstration predictor

`predict_synthetic_binding` accepts the same protein/candidate/allele/method information required
by live prediction. It generates one deterministic score seed from canonical JSON containing the
protein SHA-256, candidate identity, allele, method, tool version, and dataset version. Candidates
are ordered by this seed within each allele/method group. Percentile rank is calculated from the
stable ordinal and group size; normalized binding quality is `1 - percentileRank / 100`.

This is deliberately a deterministic demonstration model, not a binding model. Provenance always
contains:

```json
{
  "predictionSource": "SYNTHETIC",
  "scientificUse": false,
  "validationStatus": "DEMONSTRATION_ONLY",
  "algorithm": "DeterministicSyntheticBindingPredictor",
  "algorithmVersion": "1.0.0"
}
```

### Synthetic population coverage

Synthetic coverage uses only frequency records explicitly marked `SYNTHETIC` and
`scientificUse: false`. For each unique allele with frequency `f`, carrier probability is
`1 - (1 - f)^2`. Set coverage is `1 - product(1 - carrierProbability)`. Inputs are sorted and
deduplicated before evaluation. Missing population/allele values return unavailable evidence rather
than zero. Provenance includes the reference bundle version and hash.

## Ranking, constraints, and confidence

Ranking weights are read from the selected immutable ranking profile and passed to the MCP ranking
tool. The tool contract rejects missing weights, non-unit totals, or component/profile mismatches.
Changing a new versioned profile changes results without application-code edits.

Constraint inputs are built from the selected biological-constraint profile. Each outcome includes
rule ID/version, severity, outcome, message, and evidence references. Fixture exact matching is
provenance, not a biological constraint.

The numeric confidence field is no longer fixed. It is the deterministic weighted evidence score
computed by the ranking tool from the approved profile components after constraint gating and
penalties. The public confidence label continues to follow `ALGORITHM_SPEC.md`: completeness,
agreement, warnings, and hard-rejection status determine `HIGH`, `MEDIUM`, `LOW`, or
`NOT_APPLICABLE`. Confidence describes recorded evidence quality, not efficacy.

## Provenance and disclosures

Every prediction, evidence summary, coverage result, ranking snapshot, graph node, report, and
export can be traced to:

- workflow/run ID and request ID;
- execution mode and prediction source;
- scientific-use flag and validation status;
- MCP tool name/version;
- algorithm name/version;
- connector/method/version where applicable;
- dataset/profile name, version, and SHA-256;
- input/output hash;
- start/completion timestamps.

Synthetic mode displays the non-dismissible text:

> OFFLINE SYNTHETIC DEMONSTRATION — Generated using the deterministic offline demonstration
> predictor. These scores demonstrate workflow orchestration and are not validated biological
> binding predictions.

Reports include the longer approved scientific-use disclaimer. Fixture and hybrid modes receive
equally explicit labels. Styling never relies on color alone.

## Persistence and transactions

`WorkflowRun` gains nullable `requestedExecutionMode` and `executionMode` columns with a migration;
existing rows are preserved. `PredictorExecution.sourceStatus` accepts `SYNTHETIC`. Provenance stays
in canonical JSON fields already owned by observations, summaries, coverage, graph records, and
artifacts; no profile-definition tables are added.

External MCP calls never occur inside a SQLite transaction. Each stage follows:

1. persist `RUNNING` stage/event;
2. call MCP with immutable hashed input;
3. validate output;
4. transactionally persist output, provenance, `SUCCEEDED` stage, and event;
5. on error, transactionally persist failure and apply the policy resolver.

The final ranking snapshot and run transition are atomic. Stable candidate identity remains
`proteinHash | candidateType | start | end | peptide | allele`.

## Error handling and idempotency

The gateway maps MCP transport, tool-envelope, timeout, rate-limit, scientific, validation, and
internal failures into typed application errors. Only explicitly eligible failures can fall back.
Every tool input has a canonical SHA-256. Repeated execution with the same run, stage, attempt, and
input hash reuses an already persisted successful stage rather than duplicating append-only rows.

## Logging

Structured logs and persisted events cover validation, source resolution, every MCP tool start and
finish, fallback reason, persistence completion, and run transition. Required fields include
request ID, run ID, stage key, tool name/version, source, input/output hashes, duration, and error
code. Logs never include full FASTA sequences or secrets.

## Testing

- Pure algorithm tests cover synthetic prediction, synthetic coverage, profile-driven ranking,
  confidence, edge cases, and determinism.
- MCP contract tests prove discoverability, validation, provenance, and identical-output hashes.
- Gateway integration tests use the real NitroStack HTTP MCP server.
- Workflow integration tests prove `LIVE`, `SYNTHETIC`, `FIXTURE`, and `HYBRID`, eligible fallback,
  fail-closed behavior, persistence, and replay determinism.
- REST integration tests prove existing endpoints remain compatible and expose additive mode data.
- Frontend tests prove synthetic/fixture/hybrid disclosures cannot be omitted or mislabeled.
- End-to-end verification runs typecheck, lint, formatting, all tests, production build, migration,
  seed, and a real API-to-MCP synthetic workflow.

## Non-goals

- Claiming the synthetic predictor is biologically validated.
- Adding conservation, toxicity, docking, structure prediction, or vaccine efficacy.
- Implementing a live GraphBepi runtime.
- Letting the REST layer call scientific algorithms directly.
- Storing immutable profile definitions in SQLite.
- Fuzzy fixture matching or fixture results in the live cache.
