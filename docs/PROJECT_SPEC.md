# Product Specification

## 1. Product definition

**Name:** ImmunoGraph  
**MVP type:** Single-researcher computational decision-support workspace  
**Primary user:** Bioinformatics or immunology researcher reviewing predicted epitopes  
**Primary outcome:** A researcher-approved, reproducible epitope shortlist for experimental consideration

## 2. Vision

Make computational epitope prioritization transparent and reproducible by combining authoritative prediction tools, deterministic biological rules, visible provenance, and human approval through MCP-native interfaces.

## 3. Problem statement

Prediction is not the same as prioritization. A protein can yield thousands of candidate peptides across many HLA alleles and methods. Researchers must reconcile incompatible score scales, conflicting predictors, duplicate and overlapping candidates, incomplete population evidence, and transient tool failures. Spreadsheet-based reconciliation obscures provenance and makes results difficult to replay.

## 4. Product principles

1. **Deterministic first.** Use algorithms and explicit rules for validation, normalization, constraint evaluation, categorization, and ranking.
2. **Authoritative prediction.** Scientific values come only from identified predictor outputs or versioned fixtures, never from an LLM.
3. **No hidden fallback.** `LIVE`, `CACHED`, `FIXTURE`, and `FAILED` states are visible in the UI and exports.
4. **No forced answer.** Insufficient or conflicting evidence produces `REVIEW`, `REJECTED`, or run-level `PARTIAL`, not fabricated certainty.
5. **Human control.** Configuration and final shortlist approval are explicit events.
6. **Reproducibility.** Inputs, parameters, versions, hashes, rules, and outputs are persisted.
7. **Track compatibility.** MHC-I, MHC-II, and B-cell candidates are not compared as though their scores represented the same biological quantity.
8. **Hackathon reliability.** GraphBepi is fixture-only in the MVP; conservation is deferred to Product Phase 2 (post-MVP).

## 5. Goals

### G1. Reproducible sequence intake

Validate protein FASTA input, normalize it deterministically, calculate its SHA-256 hash, and preserve the original upload.

### G2. Hybrid predictor execution

Attempt configured live predictors first, reuse exact cached live results when permitted, and use a matching curated fixture only under an explicit fallback policy.

GraphBepi is the deliberate MVP exception: it goes directly to exact fixture resolution and never attempts live or cache execution.

### G3. Evidence harmonization

Map heterogeneous outputs into a common typed evidence model while preserving raw scores, units, direction, allele, peptide, method, and version.

### G4. Deterministic decision layer

Apply versioned constraints and rank candidates using documented formulas without LLM participation.

### G5. Researcher governance

Require configuration confirmation before execution and shortlist approval before final export.

### G6. Explainable outputs

Provide evidence tables, decision reasons, sequence maps, population summaries, evidence graphs, and workflow traces.

### G7. Reliable demo

Complete the three curated fixture cases—COVID spike, influenza, and dengue—without network access while clearly marking them `FIXTURE`.

## 6. Non-goals

- clinical diagnosis or treatment recommendations;
- claims of vaccine efficacy, safety, immunogenicity, or experimental validation;
- autonomous target selection;
- vaccine construct assembly;
- docking, compound screening, molecular dynamics, or protein folding;
- training a new biological model in the MVP;
- live or cached GraphBepi execution;
- conservation calculation, alignment ingestion, or conservation-based ranking in the MVP;
- general-purpose literature review;
- multi-user authentication, authorization, or tenancy;
- silently scraping scientific web interfaces where no supported programmatic route exists.

## 7. User stories

### US-01 Create a project

As a researcher, I can name a project, identify the organism/protein, and upload a FASTA sequence so that one analysis has a stable identity.

**Acceptance criteria**

- A project and draft workflow run are persisted.
- The original input and normalized sequence are both retained.
- Invalid input produces a field-level error and no prediction begins.

### US-02 Configure analysis

As a researcher, I can select MHC-I, MHC-II, B-cell, HLA alleles, target population, predictor methods, thresholds, and fallback policy.

**Acceptance criteria**

- Unsupported allele/method combinations are rejected before execution.
- The exact configuration is shown for confirmation.
- Confirmation creates an immutable configuration snapshot.

### US-03 Run hybrid prediction

As a researcher, I can start a workflow that tries live connectors and degrades according to policy.

**Acceptance criteria**

- Predictor branches execute in parallel when independent.
- Each branch ends in `LIVE`, `CACHED`, `FIXTURE`, or `FAILED`.
- The UI never displays a fixture result as a live result.
- A branch may not fall back to a fixture unless sequence hash and fixture profile match.
- GraphBepi always returns `FIXTURE` for an exact approved fixture or `FAILED`; it never returns `LIVE` or `CACHED` in the MVP.

### US-04 Inspect evidence

As a researcher, I can inspect raw and normalized predictor evidence for each candidate.

**Acceptance criteria**

- Raw scores are never overwritten.
- Normalization method and orientation are displayed.
- Missing evidence is visible.

### US-05 Review deterministic decisions

As a researcher, I can see why each candidate is `RECOMMENDED`, `REVIEW`, or `REJECTED`.

**Acceptance criteria**

- Every rule outcome includes a rule ID, version, evidence, and message.
- Hard-rule failures cannot be overridden by an LLM.
- Ranking components sum to the displayed final score within rounding tolerance.

### US-06 Approve and export

As a researcher, I can approve selected candidates and export a reproducibility package.

**Acceptance criteria**

- Approval records the candidate set, timestamp, and optional note.
- Export is blocked until approval.
- CSV and JSON are mandatory; PDF is a post-MVP enhancement unless a deterministic renderer is implemented and tested.

## 8. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Parse one protein FASTA record per MVP run. | Must |
| FR-002 | Reject empty, nucleotide-like, multi-record, or invalid-alphabet input. | Must |
| FR-003 | Generate configurable MHC-I 8–11-mers and MHC-II 13–25-mers. | Must |
| FR-004 | Invoke configured predictor connectors through the Prediction tools in the single NitroStack MCP server. | Must |
| FR-005 | Cache successful live results using a deterministic cache key. | Must |
| FR-006 | Load only exact-match, schema-valid, approved fixtures. | Must |
| FR-007 | Normalize each predictor using a registered score profile. | Must |
| FR-008 | Calculate consensus and disagreement only among comparable evidence. | Must |
| FR-009 | Calculate or retrieve estimated population coverage with source metadata. | Must |
| FR-010 | Apply versioned duplicate, length, binding, evidence, disagreement, population-coverage, and overlap rules. | Must |
| FR-011 | Rank within candidate tracks using configurable versioned profiles. | Must |
| FR-012 | Maintain an evidence graph and append-only workflow events. | Must |
| FR-013 | Require researcher confirmation and final approval. | Must |
| FR-014 | Generate ranked/review/rejected tables and JSON/CSV exports. | Must |
| FR-015 | Show sequence map, connector status, constraint summary, workflow graph, and evidence graph. | Must |
| FR-016 | Generate optional LLM explanations only from validated structured evidence. | Should |
| FR-017 | Allow deterministic re-execution from the same snapshot. | Should |

## 9. Run states

```text
DRAFT
  -> AWAITING_CONFIGURATION_APPROVAL
  -> QUEUED
  -> RUNNING
  -> AWAITING_SHORTLIST_APPROVAL
  -> COMPLETED

Any active state may transition to FAILED or CANCELLED.
A successfully completed run may carry `runQuality: PARTIAL` when at least one requested branch failed but the configured minimum evidence requirements still passed.
```

`PARTIAL` is a completion quality flag, not a substitute for a terminal state. A completed export carries `runQuality: COMPLETE | PARTIAL | FIXTURE_ONLY`.

## 10. Candidate states

- `RECOMMENDED`: passed all hard rules and exceeds the configured recommendation threshold.
- `REVIEW`: not hard-rejected but contains uncertainty, missing optional evidence, or a score between review and recommendation thresholds.
- `REJECTED`: failed one or more hard rules or is dominated by a selected overlapping candidate.
- `APPROVED`: researcher explicitly included it in the final shortlist.
- `EXCLUDED`: researcher explicitly omitted a non-rejected candidate.

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | Pure algorithm modules produce byte-equivalent canonical JSON for the same inputs and configuration. |
| NFR-002 | Every public API and MCP input/output is validated by Zod. |
| NFR-003 | The UI shows workflow changes within two seconds of receiving an event. |
| NFR-004 | No log contains full FASTA, secrets, or unrestricted external response bodies. |
| NFR-005 | Fixture-only demo completes within 60 seconds on a standard development laptop, excluding initial install/build. |
| NFR-006 | Unit coverage target is 90% for `packages/algorithms` and 80% for other domain packages. |
| NFR-007 | A failed connector does not corrupt completed branch results. |
| NFR-008 | All timestamps are UTC ISO 8601; persisted IDs are UUIDs. |
| NFR-009 | The system supports cancellation at connector and orchestration boundaries. |
| NFR-010 | Accessibility targets WCAG 2.1 AA for core UI flows. |

## 12. MVP success criteria

A judge can:

1. upload a curated dengue FASTA;
2. approve an analysis configuration;
3. observe parallel predictor branches;
4. see each connector labeled `LIVE`, `CACHED`, `FIXTURE`, or `FAILED`;
5. inspect normalization, constraint, and ranking components;
6. understand why a strong-binding but conflicting candidate is held for review;
7. approve a shortlist;
8. download JSON and CSV artifacts containing complete provenance;
9. repeat the fixture run and obtain the same ranked result.

## 13. Open scientific configuration items

These are data-governance tasks, not product ambiguity:

- validate the exact MHCflurry CLI/model installation route available in the deployment runtime;
- register supported IEDB methods and versions at implementation time;
- curate and approve exact GraphBepi fixtures for each supported demo input; live GraphBepi integration is a Product Phase 2 decision;
- approve the source/version of population-frequency data before any non-demo scientific use;
- have a qualified domain reviewer approve default thresholds and fixture expectations.

Until approved, affected live connectors remain disabled. GraphBepi remains fixture-only for the entire MVP regardless of runtime availability.
