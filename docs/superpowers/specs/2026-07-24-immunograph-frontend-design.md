# ImmunoGraph Frontend Design

**Status:** Approved for implementation  
**Date:** 2026-07-24  
**Scope:** React frontend for the ImmunoGraph MVP  
**Source of truth:** `UI_UX_SPEC.md`, `API_SPEC.md`, and the decisions recorded below

## 1. Product intent

The frontend is a focused scientific review workspace. It must communicate provenance, uncertainty, workflow state, rule outcomes, approval boundaries, and export readiness without presenting computational predictions as experimentally validated results.

The interface is not a chatbot, generic admin dashboard, or system-wide analytics product. Its primary journey is:

```text
Open ImmunoGraph
  -> Dashboard
  -> Select or create project
  -> Configure and approve run
  -> Monitor workflow
  -> Review candidates and evidence
  -> Approve shortlist
  -> Generate and download reports
```

## 2. Approved information architecture

The Dashboard is the home screen and project portfolio. It contains no deep analytics.

```text
Dashboard
  Projects
    Create Project
    Recent Projects
    Project Status
    Recent Runs

Open Project
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

There is no global **Current Run** navigation item. Runs belong to projects and appear only after a project is selected.

Project Settings contain project-specific analysis configuration, profiles, constraints, fallback policy, and output preferences. System Diagnostics contains application-wide connectors, runtime health, fixture manifests, loaded profiles, database/artifact health, and application/build information. Neither area exposes or edits the other's concerns.

## 3. Routes

```text
/                                      Dashboard and project portfolio
/projects/new                          Create project and import FASTA
/projects/:projectId                   Project overview
/projects/:projectId/settings          Project analysis settings
/runs/:runId                           Run overview
/runs/:runId/workflow                  Workflow visualization
/runs/:runId/candidates                Candidate rankings
/runs/:runId/evidence                  Evidence explorer
/runs/:runId/reports                   Reports and artifacts
/system/diagnostics                    System diagnostics
/system/about                          Application information
```

Project and run pages retain the project context in breadcrumbs and contextual navigation. Browser URLs must be directly addressable and survive refresh.

Candidate workspace subviews use a stable `view=rankings|sequence|coverage|shortlist` search parameter. Candidate selection uses `candidate=<candidateId>` so a desktop side sheet and its mobile full-page equivalent remain directly addressable without adding an undocumented API route.

## 4. Approved visual direction

The selected direction is **Research Console, revision 2**.

### 4.1 Character

- Professional, trustworthy, scientific, and focused.
- Calm density suitable for tables and evidence review.
- No gradients, glassmorphism, decorative analytics, oversized hero treatment, or AI-demo styling.
- Dashboard visual order: title, restrained summaries, quick actions, project table.

### 4.2 Core palette

- Deep evergreen navigation: `#123C38`.
- Action teal: `#176D62`.
- Mineral canvas: `#F4F7F5`.
- Primary ink: `#17221F`.
- Fixture amber uses a label and icon in addition to color.
- Semantic error, warning, success, cached, and muted values must meet WCAG 2.1 AA contrast in light and dark themes.

### 4.3 Typography and density

- UI typography uses a clear sans-serif system stack.
- Monospace is limited to sequences, hashes, IDs, coordinates where useful, and raw payload snippets.
- Desktop tables are compact but maintain readable row height and clear headers.
- Secondary scientific details move into expandable rows or side sheets.

### 4.4 Status vocabulary

Every status combines text, icon, and supplementary color:

- `LIVE`: **Live** with activity icon.
- `CACHED`: **Cached live result** with database/clock icon.
- `FIXTURE`: **Demo fixture** with flask/package icon.
- `FAILED`: **Failed** with error icon.
- `RUNNING`: **Running** with progress indicator.
- `PARTIAL`: **Partial evidence** with warning icon.

## 5. Global application shell

Desktop uses a collapsible evergreen sidebar, top breadcrumb bar, and context-aware local navigation.

Global sidebar:

```text
Workspace
  Dashboard
  Projects

System
  Diagnostics
  About
```

The sidebar footer shows local API connection status. The Dashboard top bar does not show run quality because there is no active run context.

After opening a project, local navigation exposes:

```text
Project
  Overview
  Workflow
  Candidates
  Evidence
  Reports
  Settings
```

Run quality appears only on run-scoped pages.

## 6. Page behavior

### 6.1 Dashboard

Title: **Research Projects**.

Contents:

- project count;
- recent-run count and active-run summary;
- connector health with health-first wording, such as **Healthy · 2 / 3** and secondary fixture context;
- quick actions: New Project, Upload FASTA, Open Recent, View Diagnostics;
- project list ordered by API results, with organism/protein, latest run state, source mix, and updated time;
- cursor pagination.

The Dashboard never invents portfolio analytics or performs scientific aggregation.

### 6.2 Create project and FASTA import

The form captures project name, organism, protein name, description, and pasted/uploaded FASTA. Client checks improve feedback only; the API result is authoritative.

Validated metadata displays header, length, abbreviated copyable SHA-256, profile, and warnings. Invalid residues show position and context. The frontend never edits sequence content silently.

### 6.3 Project overview

Displays project and protein metadata, recent run revisions, current approval state, and the new-analysis action. Destructive deletion requires typed confirmation and the expected project name.

### 6.4 Project settings and configuration approval

Sections cover MHC-I, MHC-II, B-cell fixture mode, populations, execution/fallback policy, profiles, constraints, and output preferences.

GraphBepi always displays a non-dismissible **Fixture only in MVP** label. Unsupported combinations show the API-provided reason. The review step shows the immutable configuration hash and uses the explicit action **Approve and queue**.

### 6.5 Run overview

Displays run status and quality, elapsed time, candidate counts by track/category, approval requirements, and connector-source matrix. A fixture banner remains visible for fixture-backed runs.

Connector rows show connector, method, source status, version, duration, and note. Run updates are announced through a polite ARIA live region without announcing every progress tick.

### 6.6 Workflow visualization

React Flow renders API-provided workflow nodes and dependency edges. Nodes show stage, state, attempt, progress, duration, source status, and warning/error code.

Selecting a node opens details and events. Retry appears only when the API marks the stage retryable. Cancel is a run-level action and warns that completed evidence is retained.

An accessible stage list provides equivalent information and actions. It is the primary mobile representation, with an option to open the graph full-screen.

### 6.7 Candidate rankings

Separate MHC-I, MHC-II, and B-cell tabs are never merged.

The server-paginated table includes rank, peptide/region, coordinates, allele, score summary, agreement, completeness, singleton estimated coverage where applicable, final score, confidence, category, and source mix.

Filters cover category, allele, connector source, score range, and warning presence. Search supports peptide text and candidate ID. Rejected candidates cannot be selected for approval.

Candidate detail uses a side sheet on desktop and a full page on mobile. It contains decision summary, raw and normalized observations, transformations, consensus/completeness, coverage evidence, every constraint outcome, ranking components, evidence neighborhood, deterministic explanation, and optional LLM generation label.

### 6.8 Sequence map

The candidate workspace provides a horizontal, zoomable protein track using the API's versioned `sequence-map` visualization view model. Separate tracks show MHC-I and MHC-II recommended/review/rejected candidates and B-cell regions. Overlaps are stacked rather than merged.

Selecting a segment opens candidate detail. Coordinate input and a textual candidate list provide equivalent navigation. The UI renders no more than 500 segments at once unless the server-provided view model already supplies aggregation or zoom data.

### 6.9 Population coverage

Recharts renders API-provided coverage view models by population and class mode. The presentation always says **estimated population coverage**, never vaccine efficacy, and shows source, method, timestamp, and live/cached/fixture provenance.

Missing evidence produces an unavailable/empty state with its API-provided reason and never a zero bar. A table next to the chart exposes the same values and provenance.

### 6.10 Shortlist approval

The candidate workspace groups selected candidates by track and shows rejected selection attempts, run quality, source mix, warnings, the ranking snapshot hash, and the computational-only disclaimer.

Approval requires a computational-only acknowledgement, optional note, and explicit **Approve shortlist** action. A stale `RANKING_CHANGED` response refreshes the snapshot and returns the researcher to the updated candidates view. Rejected candidates are never submitted as approved candidates.

### 6.11 Evidence explorer

React Flow displays only API-provided graph nodes and edges. Controls filter node type, candidate, and depth 1-4. Fit view is available.

An accessible relationship table is always available and is the default on small screens. The frontend never derives or invents graph edges.

### 6.12 Reports

Report generation remains disabled until the API reports shortlist approval. The page lists JSON, CSV, evidence graph, and workflow trace artifacts with size, creation time, SHA-256 copy action, and download.

Provenance, run quality, and computational-only disclaimer remain visible before report creation and export.

### 6.13 System diagnostics

Read-only views show connector descriptors and health, runtime health, fixture manifests, loaded profile versions and approval state, database/artifact availability, LLM enabled/disabled status, and application/build information. Secret values are never displayed.

## 7. Responsive behavior

- Desktop: persistent collapsible sidebar, contextual local navigation, dense tables, graphs, and side sheets.
- Tablet: icon sidebar, horizontally scrollable tables, reduced nonessential metadata, full keyboard support.
- Mobile: navigation drawer, full-page detail, project/configuration/approval support, stacked summaries, and list alternatives for complex graphs.
- Sequence and hash values wrap or scroll without clipping.
- Complex graph views may open full-screen but never replace their accessible list/table alternative.

## 8. Data architecture

The UI consumes the REST API exclusively through `VITE_API_BASE_URL`. It contains no embedded scientific fixtures, mock scientific fallbacks, ranking logic, coverage calculations, or workflow decisions.

### 8.1 Layers

```text
Page
  -> query/mutation hook
  -> API service function
  -> centralized API client
  -> /api/v1

API response
  -> validated/typed transport value
  -> display-only view-model adapter
  -> presentational component
```

React Query owns server-state caching, loading/error state, retries, pagination, mutation status, and targeted invalidation. Query keys are centralized for projects, runs, candidates, graphs, artifacts, profiles, and diagnostics.

Display adapters may format dates, abbreviate hashes, attach presentation labels/icons, and construct chart/graph view models from API-provided values. They may not calculate scientific results, alter categories, infer eligibility, create graph edges, or substitute missing evidence with zero.

### 8.2 SSE

A run-events service owns the EventSource lifecycle. Events update normalized React Query state incrementally. Reconnection is transport-level. Components receive already-normalized state and do not interpret workflow or scientific meaning.

## 9. UI state model

Every page supports:

1. loading skeleton;
2. actionable error with retry;
3. explanatory empty state;
4. data state.

Partial evidence is a valid data state with persistent warnings and source-status labels. It is never shown as zero and is not collapsed into a generic error.

Error handling distinguishes:

- API unavailable;
- request validation errors;
- stale configuration or ranking snapshot conflicts;
- missing or partial evidence;
- artifact/report availability;
- unexpected failures.

Stale approval conflicts refresh and route the user back to the changed configuration or candidate snapshot.

## 10. Component system

shadcn/ui primitives provide buttons, inputs, forms, alerts, dialogs, tables, tabs, badges, tooltips, drawers, side sheets, checkboxes, skeletons, and confirmation dialogs.

Reusable application components include:

- `AppShell` and responsive navigation;
- `PageHeader` and breadcrumbs;
- `StatusBadge` and `SourceStatusBadge`;
- `PageState`, `EmptyState`, and `ErrorState`;
- `MetricSummary`;
- `ProjectTable` and `CandidateTable`;
- `ConnectorMatrix`;
- `WorkflowGraph` and `WorkflowList`;
- `EvidenceGraph` and `RelationshipTable`;
- `CoverageChart` and accessible coverage table;
- `CandidateDetail`;
- `ApprovalPanel`;
- `ArtifactList`;
- `HashValue` and copy action.

Recharts renders quantitative charts from memoized API view models. Every chart includes an adjacent textual or tabular summary.

## 11. Accessibility

- WCAG 2.1 AA contrast in both themes.
- Visible keyboard focus for every interactive control.
- Semantic landmarks, headings, table captions, row/column headers, and form labels.
- Full keyboard operation for navigation, forms, tabs, dialogs, tables, sheets, and alternative graph views.
- Focus restoration after dialogs and sheets.
- Text plus icon for all statuses; icons have accessible names or are hidden when decorative.
- Polite live region for meaningful run/stage changes.
- Graph and chart information remains available without color, pointer input, or canvas interaction.

## 12. Testing and verification

Tests cover:

- route rendering and direct URL entry;
- loading, error, empty, partial, and data states;
- API-only behavior with no scientific mock fallback;
- provenance visibility across overview, candidate detail, and reports;
- React Query mutation invalidation;
- stale approval conflict recovery;
- keyboard navigation and focus restoration;
- graph/chart accessible alternatives;
- mobile navigation and responsive page composition;
- LLM-disabled deterministic explanation behavior.

Completion requires:

- frontend typecheck passes;
- lint passes;
- component/integration tests pass;
- production Vite build passes;
- browser console has no errors;
- desktop, tablet, and mobile views match the approved Research Console revision 2;
- accepted concept and final screenshots pass direct visual comparison.

## 13. API contract prerequisites

The current REST contract does not expose enough data to implement four approved UI requirements accurately. The frontend must not approximate these across cursor-paginated results or invent unsupported persistence:

1. Dashboard all-project totals and recent/active-run totals need server-provided portfolio summary values. `GET /projects` currently guarantees only a cursor-paginated list.
2. Candidate search by peptide/ID and warning-presence filtering need documented server query parameters. `GET /runs/:runId/candidates` currently documents neither.
3. Project-level persistence for output preferences is not represented in the run-creation or settings contracts.
4. System Diagnostics requires fixture-manifest and application/build information that `GET /settings/runtime` and `GET /settings/profiles` do not currently guarantee.

Before implementation, each prerequisite must be resolved by either extending `API_SPEC.md` and the API implementation or explicitly narrowing the corresponding UI requirement. The frontend will not add private endpoints, scrape unspecified response fields, or silently replace an all-project value with a current-page count.

## 14. Out of scope

- Scientific calculations in the browser.
- Mock scientific results when the API is unavailable.
- System-wide analytics dashboard.
- Editing infrastructure diagnostics from project settings.
- Editing project analysis configuration from System Diagnostics.
- Invented evidence relationships or AI-generated scientific images.
- Conservation scoring or visualization in MVP v1.
