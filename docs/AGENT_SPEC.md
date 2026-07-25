# Multi-Agent Specification

## 1. Definition

An ImmunoGraph agent is a bounded workflow role with:

- one responsibility;
- a typed input and output;
- an MCP tool allowlist;
- a retry/abstention policy;
- no permission to mutate scientific evidence outside its stage.

Agents do not exchange free-form chat. They exchange validated state references. The supervisor owns the execution graph and lifecycle.

## 2. Supervisor

### Responsibility

Evaluate workflow readiness, start eligible stages, coordinate parallel branches, pause for approval, propagate cancellation, and calculate run quality.

### Inputs

- immutable run configuration;
- stage dependency/status records;
- connector registry/health;
- approval records.

### Outputs

- state transitions;
- stage commands;
- workflow events;
- terminal run status and quality.

### Allowed actions

- call stage agents;
- start independent prediction branches concurrently;
- retry a retryable connector stage within policy;
- pause at approval nodes;
- cancel outstanding work.

### Forbidden actions

- create or change predictor values;
- skip the constraint stage before ranking;
- approve on behalf of the researcher;
- turn `FAILED` into negative evidence;
- select a non-matching fixture.

The supervisor is deterministic application code, not an LLM.

## 3. Bounded action loop

Only the Prediction Agent and optional Report Agent need a route/retry loop. The loop records concise decisions, not hidden model reasoning.

```text
PLAN: choose one allowed next action from policy and current state
ACT: call one typed MCP tool
OBSERVE: receive structured success/failure
VERIFY: validate schema, provenance, and stage invariants
DECIDE: continue, retry, use eligible fallback, request approval, or abstain
```

Limits:

- maximum three attempts per connector execution, including the first attempt;
- maximum one fixture selection after eligible live/cache failure;
- no recursive agent spawning;
- no unbounded tool discovery;
- no action outside the allowlist;
- LLM is not required for the loop.

Persisted decision record:

```ts
type AgentDecision = {
  agent: AgentName;
  stageKey: string;
  action: string;
  reasonCode: string;
  evidenceRefs: string[];
  attempt: number;
  createdAt: string;
};
```

## 4. Validation Agent

### Responsibility

Validate and normalize the uploaded protein sequence.

### MCP allowlist

- `validate_sequence`
- `generate_candidate_peptides` after configuration approval

### Input

Protein input ID and validation profile.

### Output

Normalized sequence metadata, sequence hash, warnings, or typed validation failure.

### Forbidden

- correcting residues;
- translating nucleotide input;
- selecting HLA alleles;
- calling predictors;
- using an LLM.

### Failure

Validation failure stops the workflow before configuration approval. It is not retryable unless the input changes, which creates a new protein input.

## 5. Prediction Agent

### Responsibility

Execute configured MHC-I, MHC-II, and B-cell branches through the hybrid connector resolver.

### MCP allowlist

- `predict_mhci`
- `predict_mhcii`
- `predict_bcell`
- MCP connector-registry resource

### Input

Protein reference, candidates, approved run configuration, fallback policy, connector registry.

### Output

Raw immutable observations and one provenance status per requested connector/method.

### Routing policy

1. Ask the tool to resolve the configured cache/live/fixture policy.
2. Retry only a retryable transient live failure.
3. Accept `FIXTURE` only when the tool reports an exact approved match.
4. Return `FAILED` when no valid route exists.

### Forbidden

- parsing provider responses outside connector code;
- changing raw scores;
- calculating consensus or rank;
- fabricating missing rows;
- using an LLM.

## 6. Evidence Agent

### Responsibility

Normalize compatible evidence and calculate evidence summaries.

### MCP allowlist

- `normalize_scores`
- `compute_consensus`
- `calculate_population_coverage`

### Input

Validated observation references plus profile versions.

### Output

Normalized observations, consensus, agreement, completeness, and population-coverage evidence.

### Forbidden

- mixing MHC-I, MHC-II, and B-cell evidence groups;
- normalizing an unregistered method;
- replacing missing population-coverage values;
- applying constraints or ranking;
- using an LLM.

### Failure

An unregistered required score is a stage failure. Missing optional evidence is persisted as `NOT_EVALUATED` and handled by constraints/ranking.

## 7. Constraint Agent

### Responsibility

Evaluate every applicable biological rule and resolve exact duplicates/overlap dominance.

### MCP allowlist

- `detect_overlapping_epitopes`
- `remove_duplicate_candidates`
- `validate_thresholds`
- `categorize_candidates`
- `apply_constraint_rules`

### Input

Candidate and evidence snapshot plus rule profile.

### Output

Ordered rule outcomes and eligibility status.

### Forbidden

- editing the rule profile during a run;
- ignoring a hard failure;
- ranking across tracks;
- using prose or LLM judgment to waive a rule.

### Failure

Any internal rule-engine error blocks ranking. A normal rule failure rejects only the affected candidate.

## 8. Ranking Agent

### Responsibility

Create stable track-specific rankings from eligible candidates and constraint outcomes, then optimize T-cell shortlist coverage after final ranking.

### MCP allowlist

- `rank_candidates`
- `optimize_shortlist_coverage`

### Input

Evidence snapshot, applicable constraint snapshot, ranking profile, and—only for shortlist optimization—the final ranking snapshot and approved population settings.

### Output

Component scores, penalties, final scores, categories, confidence labels, ranks, coverage-aware shortlist selection steps, and replay hash.

### Forbidden

- ranking candidates before constraints;
- merging tracks;
- changing weights implicitly;
- promoting hard-rejected candidates;
- using an LLM.

## 9. Report Agent

### Responsibility

Produce views, exports, and grounded explanations from approved immutable data.

### MCP allowlist

- `generate_report`
- `export_candidates`
- `visualize_results`
- `explain_candidate`
- `export_workflow_trace`

### Input

Run snapshot, candidate decisions, approvals, and template/prompt versions.

### Output

Artifacts and explanations.

### LLM allowance

This is the only agent allowed to call an LLM, and only for:

- paraphrasing a deterministic candidate explanation;
- summarizing an approved run;
- answering from supplied evidence graph facts.

If the LLM is unavailable or fails validation, use deterministic templates.

### Forbidden

- calling scientific predictors;
- modifying evidence/rank/category/approval;
- adding unsupported claims or experimental recommendations;
- exposing chain-of-thought;
- exporting before shortlist approval.

## 10. Context management

Agents receive references and bounded summaries, not the entire workspace.

| Context layer | Content |
|---|---|
| Run state | IDs, objective, profile versions, stage status, approvals |
| Agent input | Only records needed for the current stage |
| Evidence store | Structured observations, rules, rankings, graph edges |
| Artifact store | FASTA, exports, large raw/visualization data |

Full sequences and large predictor outputs are passed as resource/artifact references when the MCP tool can resolve them locally.

## 11. Human approval protocol

### Configuration approval

Pauses after validation and configuration normalization. Approval is bound to `configurationHash`.

### Shortlist approval

Pauses after ranking. Approval is bound to `rankingSnapshotHash` and selected candidate IDs.

Agents cannot infer approval from a message, button hover, elapsed time, or previous run.

## 12. Agent evaluation

Measure:

- correct MCP tool selection;
- invalid/forbidden tool-call rate;
- retry-policy compliance;
- fallback-policy compliance;
- source-status accuracy;
- unsupported scientific claim rate;
- correct abstention/partial-run rate;
- approval compliance;
- average attempts per connector;
- deterministic replay rate.

Required targets for the fixture suite:

- forbidden tool calls: 0;
- provenance mislabeling: 0;
- approval bypass: 0;
- replay match: 100%;
- unsupported numeric claims in explanations: 0.
