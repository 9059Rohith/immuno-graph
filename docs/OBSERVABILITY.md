# Observability Specification

## 1. Objectives

Observability must answer:

1. What stage is running or blocked?
2. Which MCP tool and predictor was used?
3. Was evidence live, cached, fixture-based, or failed?
4. How long did it take and how many attempts occurred?
5. Which profile/version produced a decision?
6. Why did a candidate become recommended, review, or rejected?
7. Can the run be replayed?

The MVP uses Pino logs, append-only workflow events, persisted stage/execution records, and in-app visualizations. OpenTelemetry or an external metrics backend is future work, not required.

## 2. Correlation model

Every operation carries:

- `requestId`: one REST/MCP request;
- `runId`: one workflow revision;
- `stageId` and `stageKey`;
- `toolCallId`: one MCP invocation;
- `predictorExecutionId`: one connector/method attempt group;
- `taskId`: NitroStack task when applicable.

The API creates or validates `requestId`. Child calls inherit IDs through explicit context, not global mutable variables.

## 3. Structured logging

Required Pino fields:

```ts
{
  level,
  time,
  service,
  environment,
  requestId,
  runId?,
  stageKey?,
  toolName?,
  connectorId?,
  method?,
  sourceStatus?,
  attempt?,
  durationMs?,
  errorCode?,
  retryable?,
  inputHash?,
  outputHash?
}
```

Message text is concise: `connector call completed`, not serialized payloads.

### Log levels

- `debug`: sanitized routing/cache details and local development diagnostics.
- `info`: lifecycle, tool completion, approval, artifact creation.
- `warn`: retry, fallback, partial evidence, profile warning.
- `error`: terminal stage failure, database failure, invariant violation.
- `fatal`: startup cannot establish required local services/configuration.

## 4. Redaction

Always redact:

- authorization/cookie/API-key headers;
- environment secrets;
- full FASTA body and normalized sequence;
- full external provider response;
- LLM prompt bodies when they contain sequence/evidence details;
- local absolute paths in client-facing responses.

Allowed identifiers include sequence hash, length, header after HTML-safe display escaping, candidate IDs, connector IDs, and bounded score summaries.

## 5. Workflow events

Events are durable user-facing observability and use the schema:

```ts
type WorkflowEvent = {
  id: string;
  sequenceNumber: number;
  runId: string;
  stageId?: string;
  eventType: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

Events contain bounded, client-safe data. They are persisted in the same transaction as the state change they describe.

## 6. Metrics

The API exposes safe JSON metrics at `/api/v1/diagnostics/metrics` for the local UI. It does not expose secrets or full scientific data.

### Workflow

- runs created/completed/failed/cancelled;
- run duration by quality;
- stage duration and failure count;
- workflow completion rate;
- deterministic replay match rate;
- pending approval count/time.

### Connectors/MCP

- calls by tool/connector/method/source status;
- success/failure/rate-limit/timeout count;
- latency distribution summaries;
- retry and recovery count;
- cache hit rate;
- fixture fallback rate;
- schema-validation failure count;
- cancellation count.

### Scientific decision process

- candidate count by track/category;
- hard/soft rule outcome counts by rule ID;
- missing-evidence count;
- agreement distribution summary;
- number and percentage of fixture-backed observations.

Metrics describe system behavior, not scientific efficacy.

## 7. Trace model

The workflow trace is an ordered export of:

1. run/stage transitions;
2. MCP tool calls;
3. connector attempts and source status;
4. input/output hashes;
5. profile versions;
6. approvals;
7. artifact creation.

Do not export hidden chain-of-thought. Agent decisions use reason codes and evidence references.

## 8. Dashboard requirements

### Run operations view

- workflow DAG with state/duration/attempt;
- connector status matrix;
- timeline of warnings/failures/fallbacks;
- approval queue;
- source-mix summary;
- run quality and replay hash status.

### Candidate audit view

- evidence graph;
- raw-to-normalized transformations;
- rule outcomes;
- score components and penalties;
- explanation generation mode.

### Diagnostics view

- service/database/artifact health;
- connector health and last check;
- cache hit/fallback rates;
- recent typed errors;
- profile/fixture versions.

## 9. Health endpoints

- `/health/live`: process event loop responsive; no dependency checks.
- `/health/ready`: database migration current, artifact root writable, and the single local `immunograph-mcp` server reachable.
- `/api/v1/connectors/health`: per-connector operational availability.

External predictor failure does not make the entire API unready because fixture/cached operation may remain available.

## 10. Alerts in MVP

In-app warnings only:

- all requested predictors failed;
- fixture fallback occurred;
- more than 50% of requested evidence is fixture-based;
- cache validation failed;
- profile/fixture hash mismatch;
- database/artifact storage unavailable;
- approval waiting;
- deterministic replay mismatch;
- unexpected exception/invariant violation.

No email/Slack/pager integration is in scope.

## 11. Retention and rotation

- Workflow events: retained with the run.
- Application logs: development default seven days or size-based rotation configured outside domain code.
- Diagnostic raw provider samples: not logged; curated redacted samples live in test data.
- Metrics: calculated from current process and persisted workflow records; no long-term time-series guarantee.

## 12. Acceptance criteria

- A judge can trace a candidate from input hash through predictor method, normalized evidence, rules, rank, and approval.
- Every fixture fallback creates a warning event and visible status.
- A failed connector includes error code, attempt count, and duration without leaking payloads.
- Logs and events share correlation IDs.
- Replay mismatch is visible and blocks “reproducible” labeling.
