# Codex Build Log

This log records the evidence-backed hackathon hardening performed on 3 August 2026. It does not claim that Codex authored the full pre-existing repository.

## Inputs reviewed

- the BlockseBlock Codex Track Kit and ChatGPT Codex Hackathon Guide supplied locally by the project owner;
- 365 authored text files in the initial repository audit;
- the existing product, algorithm, API, MCP, security, UI, and test specifications;
- the live working tree, including pre-existing user changes that were preserved and integrated only where the task required them.

## Rubric strategy

The project targets **Track 4 — Domain Agents**. Work was prioritized against the published weights: technical implementation, real-world impact, Codex usage, creativity, and demo completeness. A winning result cannot be guaranteed; the engineering goal is a top-tier, verifiable submission.

## Artifacts created before implementation

- [Hackathon submission design](superpowers/specs/2026-08-03-hackathon-top-tier-submission-design.md)
- [Test-first implementation plan](superpowers/plans/2026-08-03-hackathon-top-tier-submission.md)

## Focused implementation history

| Commit | Evidence |
|---|---|
| `aa6fffe` | Expiring isolated demo workspaces and cleanup |
| `f341027` | Credential-free curated dengue demo factory |
| `030e770` | Vercel/Render deployment boundary and strict CORS |
| `995de92` | Public Judge Mode landing and session-scoped workspace |
| `483d664` | State-aware six-step scientific judge journey |
| `7a9bf6c` | Deterministic trust evaluation and API aggregation |
| `0f2bd17` | Scientific Trust Center UI |
| `08b1b4b` | Complete desktop/mobile judge journey and terminology correction |

## Test-first evidence

The new slices began with failing tests for demo cleanup, demo creation, Judge Mode, journey derivation, trust checks, trust aggregation, Trust Center rendering, documentation integrity, and the complete browser journey. Failures found and corrected during browser execution included:

- a web/API startup race;
- duplicate judge-run creation;
- a duplicate React key;
- an expected optional optimizer represented as a noisy 404;
- a mobile navigation drawer that stayed open after route selection;
- resource contention when four browser projects compiled in parallel.

## Scientific-claim correction

The repository contained fixed logistic/nonlinear weights without a training dataset or validation experiment. Public metadata now calls them a **deterministic dual-head demonstration scorer**, retains `SYNTHETIC` and `scientificUse=false`, and makes no accuracy or biological-validity claim.

## Verification

Exact final commands, counts, screenshots, audit results, deployment checks, known limitations, and release SHA are recorded in the [release verification ledger](superpowers/verification/2026-08-03-hackathon-release.md).
