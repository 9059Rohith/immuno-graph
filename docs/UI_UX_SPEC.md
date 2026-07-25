# UI/UX Specification

## 1. Experience goal

The interface should feel like a focused scientific review workspace, not a chatbot and not a generic admin dashboard. The researcher should always know:

- what is running;
- which evidence is live, cached, fixture-based, missing, or failed;
- how a candidate was scored;
- why a rule changed its category;
- what requires approval;
- what is safe to export.

## 2. Information architecture

```text
Dashboard
  Projects
    Create project
    Recent projects
    Project status
    Recent runs
Open project
  Overview
  Workflow
  Candidates
    Rankings
    Sequence map
    Population coverage
    Shortlist approval
  Evidence
  Reports
  Settings
System
  Diagnostics
  About
```

The Dashboard is the home screen and project portfolio. There is no global Current Run item; run navigation is contextual to an open project. Project Settings owns project analysis configuration, profiles, constraints, fallback policy, and output preferences. System Diagnostics is read-only and owns connectors, runtime health, fixture manifests, loaded profiles, storage health, and build information.

## 3. Visual system

- Tailwind CSS semantic tokens with light and dark themes.
- shadcn/ui primitives for forms, dialogs, table controls, tabs, badges, tooltips, drawers, and alerts.
- Recharts for quantitative charts.
- React Flow for workflow and evidence graphs.
- Monospace only for sequences, hashes, IDs, and raw payload snippets.
- Dense scientific tables remain readable; secondary details move to an expandable row or side panel.

### Status vocabulary

`SYNTHETIC` is labeled **Offline synthetic demonstration** with a flask icon and is always paired with `scientificUse=false` disclosure.

| Status | Label and icon expectation |
|---|---|
| `LIVE` | “Live” + activity icon |
| `CACHED` | “Cached live result” + database/clock icon |
| `FIXTURE` | “Demo fixture” + flask/package icon |
| `FAILED` | “Failed” + error icon |
| `RUNNING` | “Running” + progress indicator |
| `PARTIAL` | “Partial evidence” + warning icon |

Color is supplementary. Every state includes text and icon.

## 4. Global layout

```text
+-------------------------------------------------------------+
| ImmunoGraph | Project / Run breadcrumb | Run quality | Help |
+-------------+-----------------------------------------------+
| Dashboard   | Page title                         [Primary]   |
| Projects    | Context/status banner                          |
| System      | Main content                                  |
|-------------|                                                |
| Project     | Overview / Workflow / Candidates / Evidence   |
|             |                                               |
+-------------+-----------------------------------------------+
```

Desktop: collapsible left navigation, max content width appropriate to tables.  
Tablet: icon navigation and horizontally scrollable tables.  
Mobile: project/configuration/approval supported; complex graphs show a simplified list with an option to open full-screen.

## 5. Screen specifications

### 5.1 Project list

Shows project name, organism/protein, latest run status/quality, last updated, and source mix. Primary action: **New project**.

States:

- empty: brief explanation and create action;
- loading skeleton;
- API unavailable with retry;
- list with cursor pagination.

### 5.2 New project and FASTA upload

Fields:

- project name (required);
- organism (optional);
- protein name (optional);
- description (optional);
- paste/upload FASTA (required).

Immediate client checks improve feedback, but the server result is authoritative. After validation show:

```text
Header
Length
Sequence SHA-256 (abbreviated, copyable)
Validation profile
Warnings
```

Invalid residues are shown with position and surrounding context. Do not silently edit the sequence.

### 5.3 Analysis configuration

Sections:

1. MHC-I: enable, alleles, lengths, methods.
2. MHC-II: enable, alleles, lengths, methods.
3. B-cell: enable GraphBepi fixture mode; show a non-dismissible **Fixture only in MVP** label.
4. Population: selected populations and calculation mode.
5. Execution: fallback policy and demo mode.
6. Profiles: rule/ranking versions, read-only summary of defaults.

Disabled/unsupported connector combinations show a reason. The final step is a configuration review with immutable hash and **Approve and queue** action.

### 5.4 Run overview

Top summary:

- run status and quality;
- elapsed time;
- candidate counts by category/track;
- approval state;
- connector-source matrix.

Connector matrix example:

| Connector | Method | Status | Version | Duration | Note |
|---|---|---|---|---:|---|
| IEDB MHC-I | recommended | LIVE | recorded | 14.2s | — |
| IEDB MHC-II | recommended | CACHED | recorded | 0.1s | exact cache key |
| GraphBepi | graphbepi | FIXTURE | recorded | 0.0s | MVP fixture-only |

A fixture banner remains visible for any fixture-backed run. A synthetic or hybrid run instead shows a prominent non-dismissible banner reading **OFFLINE SYNTHETIC DEMONSTRATION — NOT SCIENTIFIC OUTPUT** and explains that its deterministic values have `scientificUse=false`.

### 5.5 Workflow graph

React Flow node contents:

- stage name;
- state;
- attempt;
- progress;
- duration;
- source status for connector nodes;
- warning/error code.

Edges show dependency only, not model-generated reasoning. Selecting a node opens stage details and events. Failed retryable nodes expose **Retry**; running nodes expose run-level **Cancel**.

Provide a list view for accessibility and mobile.

### 5.6 Candidate workspace

Separate tabs: **MHC-I**, **MHC-II**, **B-cell**.

Required table columns:

- rank;
- peptide/region;
- coordinates;
- allele where applicable;
- binding/predictor score summary;
- agreement;
- completeness;
- singleton population coverage where applicable;
- final score;
- confidence;
- category;
- source mix.

Filters: category, allele, connector source, score range, warning presence. Search supports peptide text and candidate ID.

Rows are selectable only when eligible for final approval. Rejected rows cannot be approved.

### 5.7 Candidate detail

Use a full page on mobile and side sheet on desktop.

Sections:

1. decision summary;
2. raw observations with method/version/source;
3. normalization transformations;
4. consensus/completeness;
5. singleton and shortlist population-coverage evidence;
6. every constraint outcome;
7. ranking formula with effective weights and penalties;
8. evidence graph neighborhood;
9. deterministic explanation and optional LLM paraphrase label.

Numbers in prose link/highlight the corresponding structured field.

### 5.8 Sequence map

A horizontal, zoomable protein track rendered from validated view data.

Tracks:

- MHC-I recommended/review/rejected;
- MHC-II recommended/review/rejected;
- B-cell regions;

Selecting a segment opens candidate detail. Overlaps are vertically stacked. Provide coordinate input and textual alternative list.

### 5.9 Population coverage

Recharts display projected coverage by selected population and class mode. Show source, method, timestamp, and whether data is live/cached/fixture. Use “estimated population coverage,” never “vaccine efficacy.”

Missing data shows an explanatory empty state and routes affected candidates to review; it does not render zero bars.

### 5.10 Evidence graph

React Flow node types: protein, candidate, observation, tool version, HLA allele, summary, rule, decision, ranking, approval.

Controls:

- filter node type;
- filter candidate;
- depth 1–4;
- fit view;
- switch to accessible relationship table.

The graph explains stored relations only. The frontend cannot invent edges.

### 5.11 Shortlist approval

Shows selected candidates grouped by track, rejected selection attempts, run quality, source mix, warnings, and disclaimer.

Required interaction:

- checkbox acknowledging computational-only status;
- optional note;
- explicit **Approve shortlist** button;
- stale-snapshot conflict returns to the updated candidate view.

### 5.12 Reports

Lists JSON, CSV, evidence graph, and workflow trace artifacts with size, created time, SHA-256 copy action, and download.

Report creation is disabled until shortlist approval.

### 5.13 System diagnostics

Read-only MVP views:

- connector availability and license/configuration status;
- reference/profile versions and approval status;
- fixture manifest entries;
- LLM enabled/disabled;
- database and artifact-path health.

Do not display environment secret values.

### 5.14 Project settings

Project Settings manages configuration for new run revisions in the current project: MHC-I, MHC-II, B-cell fixture mode, populations, requested execution mode (`AUTO`, `LIVE`, `SYNTHETIC`, or `FIXTURE`), fallback policy, immutable profile selections, constraints, and output preferences. It never exposes infrastructure diagnostics.

## 6. Approval UX rules

- Approval cannot be a generic “Continue” button.
- Show the snapshot hash abbreviation and what will become immutable.
- Configuration approval and shortlist approval use different wording/icons.
- Destructive project deletion requires typed confirmation.
- Cancellation warns that completed evidence is retained.

## 7. Content rules

Preferred terms:

- “predicted”
- “computational evidence”
- “recommended for review”
- “estimated coverage”
- “demo fixture”
- “requires experimental validation”

Do not call a candidate “safe,” “effective,” or “validated.”

## 8. Accessibility

- WCAG 2.1 AA contrast.
- Full keyboard operation for forms, tables, dialogs, tabs, and graph alternative views.
- Visible focus indicators.
- Graphs/charts include summaries or tables.
- Icons have accessible labels.
- Live stage updates use a polite ARIA live region; do not announce every progress tick.
- Sequence strings wrap or scroll without clipping.

## 9. Performance

- Candidate tables use server pagination; virtualize only after measurement.
- Graph endpoints return bounded depth and node counts.
- Avoid rendering more than 500 sequence segments without aggregation/zoom.
- SSE events update normalized client state incrementally.
- Charts receive memoized view models; scientific calculations remain server-side.

## 10. UI acceptance scenarios

1. Live MHC-I + cached MHC-II + fixture B-cell statuses remain visible from overview through export.
2. A predictor failure without fixture shows partial evidence and does not render missing values as zero.
3. A candidate with high binding but low agreement is visibly routed to review with rule details.
4. A stale approval snapshot produces a recoverable conflict.
5. An LLM-disabled system still provides complete deterministic explanations.
6. A keyboard-only user can create, configure, monitor, review, approve, and export a run.
