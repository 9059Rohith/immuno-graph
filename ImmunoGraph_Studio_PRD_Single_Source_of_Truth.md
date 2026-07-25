# ImmunoGraph Studio
## Product Requirements Document — Single Source of Truth

**Status:** Implementation-ready  
**Version:** 1.0.0  
**Track:** HealthTech & Life Sciences  
**Product:** MCP-native, multi-agent vaccine and antiviral candidate-prioritisation platform  
**Audience:** Coding agents, software engineers, ML engineers, bioinformatics researchers, product designers, QA, and hackathon judges

---

# 0. Document Authority

This document is the authoritative specification for ImmunoGraph Studio.

The coding agent and human team must follow these rules:

1. Do not remove, merge away, or silently defer any required feature.
2. Features may be implemented in phases, but the complete scope must remain represented in architecture, schemas, interfaces, backlog, and tests.
3. A language model must never invent scientific values.
4. Every numeric scientific result must come from a versioned tool, deterministic algorithm, trained model, curated source, or researcher input.
5. Every scientific output must preserve provenance.
6. Every workflow must support retry, resumability, validation, observability, approval, and export.
7. The system must distinguish predictions, evidence, inference, researcher decisions, and experimental validation.
8. The product must never represent a computational result as a clinically validated vaccine, antiviral, treatment, or medical recommendation.
9. Conflict resolution priority:
   1. Scientific integrity and safety
   2. This PRD
   3. Typed contracts and schemas
   4. Acceptance criteria
   5. UI convenience
10. Any deviation requires a decision record containing reason, impact, alternatives, approver, date, and migration plan.

---

# 1. Product Definition

## 1.1 Product name

**ImmunoGraph Studio**

## 1.2 Subtitle

**An Auditable Multi-Agent System for Vaccine and Antiviral Candidate Prioritisation**

## 1.3 One-line pitch

> From pathogen sequence to an evidence-backed experimental shortlist using MCP-connected scientific tools, graph-orchestrated agents, deterministic validation, calibrated AI/ML ranking, and human approval.

## 1.4 Product vision

ImmunoGraph Studio converts fragmented immunoinformatics, structural-biology, cheminformatics, and molecular-docking workflows into one reproducible research workspace.

The platform accepts biological inputs, creates a graph execution plan, runs specialised agents in parallel or sequence, validates outputs, ranks candidates, explains every selection and rejection, supports researcher approvals, and exports a complete research package.

It is not a chatbot that guesses scientific answers. It is a scientific orchestration, evidence, reliability, and governance system.

---

# 2. Problem Statement

Early-stage vaccine and antiviral research requires researchers to move manually between:

- epitope predictors,
- HLA-binding tools,
- population-coverage tools,
- sequence databases,
- structure databases and predictors,
- molecular editors and converters,
- compound databases,
- receptor and ligand preparation tools,
- docking engines,
- notebooks,
- spreadsheets,
- and reporting tools.

This causes:

- repeated manual conversion,
- inconsistent parameters,
- hidden version differences,
- missing provenance,
- fragile copy-paste workflows,
- poor reproducibility,
- weak failure handling,
- no unified evidence graph,
- hidden predictor disagreement,
- and reports disconnected from the evidence that produced them.

ImmunoGraph Studio solves this through typed MCP tools, graph-based multi-agent orchestration, deterministic gates, calibrated ranking, human approvals, evidence graphs, and reproducible exports.

---

# 3. Goals and Non-Goals

## 3.1 Required goals

The system must:

1. Accept sequences, identifiers, structures, compounds, and research configurations.
2. Validate all inputs deterministically.
3. Run T-cell, B-cell, population, conservation, structure, compound, and docking analyses.
4. Coordinate specialised agents using sequential and parallel graph execution.
5. Use bounded ReAct loops for tool-driven reasoning.
6. Expose capabilities through typed MCP servers.
7. Build a scientific evidence graph connecting every result to inputs, tools, versions, parameters, and approvals.
8. Rank candidates through deterministic rules, ML, consensus, uncertainty penalties, and configurable weights.
9. Require human approval at critical transitions.
10. Produce scientific visualisations, tables, explanations, raw files, reports, and a ZIP research package.
11. Support caching, retry, failure recovery, replay, resumability, and observability.
12. Include a continuous evaluation harness for tools, agents, models, workflows, and end-to-end behaviour.

## 3.2 Non-goals

The system must not:

- claim clinical validation,
- diagnose a patient,
- prescribe treatment,
- replace wet-lab validation,
- fabricate assay outcomes,
- treat docking scores as proof of efficacy,
- or autonomously approve clinical, animal, or human research.

---

# 4. Complete Product Scope

No feature in this section may be removed.

## 4.1 Vaccine branch

- protein sequence validation,
- peptide generation,
- MHC-I prediction,
- MHC-II prediction,
- linear B-cell prediction,
- structure-aware B-cell prediction,
- predictor consensus,
- HLA association,
- population coverage,
- sequence conservation,
- experimental structure retrieval,
- AlphaFold fallback,
- uploaded structure support,
- structure confidence analysis,
- sequence-to-structure mapping,
- epitope-to-structure mapping,
- surface accessibility,
- deterministic candidate validation,
- calibrated ML prioritisation,
- candidate comparison,
- candidate approval and rejection,
- greedy maximum-coverage construct selection,
- multi-objective genetic-algorithm construct optimisation,
- manual construct editing,
- construct FASTA,
- construct diagram,
- final validation roadmap.

## 4.2 Antiviral branch

- target structure retrieval or upload,
- target-quality assessment,
- pocket definition,
- PubChem compound retrieval,
- CID, SMILES, SDF, and MOL support,
- compound deduplication,
- molecular-descriptor retrieval,
- 2D compound rendering,
- 3D conformer retrieval or generation,
- ligand preparation,
- receptor preparation,
- PDBQT generation,
- docking-box validation,
- AutoDock Vina execution,
- repeated-seed docking,
- pose clustering,
- interaction extraction,
- docking stability analysis,
- deterministic candidate validation,
- calibrated ML prioritisation,
- human approval,
- final validation roadmap.

## 4.3 Combined branch

A project may contain both workflows with:

- shared sequence and structure artifacts,
- shared project configuration,
- shared evidence graph,
- branch-specific ranking,
- common approvals,
- common observability,
- common reporting,
- and one combined export.

## 4.4 Platform scope

- authentication,
- role-based access,
- project management,
- configuration versioning,
- artifact management,
- typed MCP servers,
- multi-agent runtime,
- workflow graph,
- bounded ReAct loops,
- deterministic validators,
- human approval gates,
- graph database,
- relational database,
- object storage,
- context management,
- observability,
- evaluation harness,
- reporting,
- downloads,
- replay,
- audit logs,
- health checks,
- security,
- deployment.

---

# 5. Personas

## 5.1 Bioinformatics researcher

Needs reproducible analyses, parameter visibility, evidence inspection, candidate comparison, custom HLA/population settings, structural inspection, rejection reasons, and downloadable files.

## 5.2 Pharmaceutical researcher

Needs compound retrieval, target and ligand preparation, repeated docking, stable prioritisation, interaction summaries, and evidence-backed reports.

## 5.3 Principal investigator

Needs approvals, auditability, run comparisons, reproducibility, team oversight, and report exports.

## 5.4 Student researcher

Needs guided workflows, safe defaults, transparent warnings, visual explanations, and reproducibility without manually operating every command-line tool.

## 5.5 Administrator

Needs tool configuration, secrets, model versioning, worker monitoring, rate limits, access control, and system health.

---

# 6. Core Terminology

- **Candidate:** A peptide, construct, compound, or pose under evaluation.
- **Evidence:** A tool-generated or researcher-entered result supporting or contradicting a candidate.
- **Prediction:** A computational estimate from a scientific model.
- **Validation gate:** A deterministic rule that passes, blocks, flags, or escalates.
- **Approval gate:** A workflow pause requiring an authorised researcher.
- **MCP server:** A domain-bounded service exposing typed tools, resources, and prompts.
- **Agent:** A bounded decision component that invokes permitted MCP tools.
- **Workflow graph:** The execution graph containing dependencies, branches, loops, and approvals.
- **Evidence graph:** The persistent scientific graph connecting entities and provenance.
- **Run:** One execution of a configuration.
- **Artifact:** A file or structured output such as FASTA, PDB, CSV, JSON, SDF, PDBQT, image, or report.
- **Abstention:** A deliberate refusal to recommend when evidence is insufficient.
- **Replay:** Re-execution using stored inputs, versions, parameters, and seeds.

---

# 7. End-to-End User Flow

## 7.1 Create project

The researcher:

1. Signs in.
2. Creates a project.
3. Selects Vaccine, Antiviral, or Combined mode.
4. Enters project name, pathogen, protein/target, objective, population, collaborators, and notes.

The system creates:

- project ID,
- evidence graph namespace,
- artifact namespace,
- configuration version,
- audit log,
- and workflow draft.

## 7.2 Add inputs

Supported inputs:

- pasted or uploaded FASTA,
- UniProt ID,
- PDB ID,
- AlphaFold ID,
- uploaded PDB/mmCIF,
- pathogen and protein name,
- PubChem CID,
- SMILES,
- SDF/MOL,
- or a demonstration dataset.

## 7.3 Validate inputs

Validation must detect:

- invalid FASTA,
- illegal residues,
- empty input,
- sequence-type mismatch,
- unsupported length,
- duplicate sequence,
- invalid structure,
- invalid molecule,
- missing identifier,
- parse failure.

The interface displays pass/fail, parsed metadata, checksum, exact error, correction, and validator version.

## 7.4 Configure research workflow

Researcher configures:

- MHC-I,
- MHC-II,
- B-cell analysis,
- HLA alleles,
- target populations,
- predictor set,
- structure preference,
- conservation settings,
- ranking weights,
- candidate limits,
- construct constraints,
- docking target and box,
- compound limit,
- Vina exhaustiveness,
- repeated seeds,
- and approval policy.

Every default must be visible and editable.

## 7.5 Approve configuration

Before execution, the workflow pauses. Approval records user, timestamp, comment, configuration version, and configuration hash.

## 7.6 Plan execution graph

The supervisor generates and stores a typed graph containing nodes, dependencies, parallel groups, retries, gates, fallbacks, termination rules, and output contracts.

## 7.7 Execute scientific workflow

Typical vaccine graph:

```text
validate_input
  -> generate_peptides
    -> [mhci, mhcii, bcell, structure, conservation]
      -> evidence_join
        -> population_coverage
          -> deterministic_validation
            -> ml_ranking
              -> shortlist_approval
                -> construct_optimisation
                  -> construct_review
                    -> final_report
```

Typical antiviral graph:

```text
validate_target
  -> structure_retrieval_or_upload
    -> structure_quality_gate
      -> pocket_selection
        -> compound_retrieval
          -> compound_filtering
            -> [ligand_preparation, receptor_preparation]
              -> docking_box_validation
                -> repeated_docking
                  -> pose_clustering
                    -> interaction_analysis
                      -> deterministic_validation
                        -> ml_ranking
                          -> candidate_approval
                            -> final_report
```

## 7.8 Review candidates

The researcher can:

- approve,
- reject,
- flag,
- add a note,
- compare,
- request another predictor,
- change thresholds,
- rerun a stage,
- or add external evidence.

## 7.9 Final approval and export

Before export, the researcher reviews selected and rejected candidates, incomplete analyses, warnings, versions, parameters, approvals, and limitations.

---

# 8. Functional Requirements

Requirement IDs must appear in issues, commits, tests, and acceptance records.

## 8.1 Authentication and projects

- **FR-AUTH-001:** Authenticated access is required.
- **FR-AUTH-002:** Roles: researcher, approver, owner, administrator.
- **FR-AUTH-003:** Project-level access control is required.
- **FR-AUTH-004:** All mutations and approvals must be audited.
- **FR-PROJ-001:** Create, read, edit, archive, and duplicate projects.
- **FR-PROJ-002:** Support Vaccine, Antiviral, and Combined modes.
- **FR-PROJ-003:** Support collaborators and role-based permissions.
- **FR-PROJ-004:** Preserve configuration history.
- **FR-PROJ-005:** Compare two runs.

## 8.2 Input management

- **FR-IN-001:** Accept FASTA by paste and upload.
- **FR-IN-002:** Accept UniProt, PDB, and AlphaFold IDs.
- **FR-IN-003:** Accept PDB, mmCIF, SDF, MOL, SMILES, and PDBQT where applicable.
- **FR-IN-004:** Hash and version every input.
- **FR-IN-005:** Invalid inputs block execution.
- **FR-IN-006:** Preserve original files.

## 8.3 Sequence and peptide analysis

- **FR-SEQ-001:** Validate protein sequences deterministically.
- **FR-SEQ-002:** Return machine-readable error codes.
- **FR-SEQ-003:** Generate configurable peptide lengths.
- **FR-TCELL-001:** Support MHC-I prediction.
- **FR-TCELL-002:** Support MHC-II prediction.
- **FR-TCELL-003:** Support custom HLA allele sets.
- **FR-TCELL-004:** Store peptide, position, allele, method, version, score, percentile, hashes, parameters, and timestamp.
- **FR-TCELL-005:** Support multi-predictor consensus.
- **FR-BCELL-001:** Support linear B-cell prediction.
- **FR-BCELL-002:** Support structure-aware B-cell prediction.
- **FR-BCELL-003:** Compute predictor agreement.
- **FR-BCELL-004:** Flag low-confidence structural regions.

## 8.4 Population and conservation

- **FR-POP-001:** Calculate estimated HLA population coverage.
- **FR-POP-002:** Support one or more target populations.
- **FR-POP-003:** Label coverage as estimated coverage, not efficacy.
- **FR-POP-004:** Store allele-frequency source/version.
- **FR-POP-005:** Calculate candidate-level marginal contribution.
- **FR-CONS-001:** Support conservation analysis.
- **FR-CONS-002:** Store sequence set and alignment parameters.
- **FR-CONS-003:** Produce candidate-level conservation scores.

## 8.5 Structure analysis

- **FR-STR-001:** Search experimental structures first when configured.
- **FR-STR-002:** Support AlphaFold fallback.
- **FR-STR-003:** Support uploaded structures.
- **FR-STR-004:** Assess structure quality.
- **FR-STR-005:** Assess region-level confidence for predicted structures.
- **FR-STR-006:** Map sequences, epitopes, and pockets to structure coordinates.
- **FR-STR-007:** Detect missing residues and mapping failures.
- **FR-STR-008:** Compute/retrieve surface accessibility.
- **FR-STR-009:** Provide interactive 3D viewing.

## 8.6 Chemistry and compound handling

- **FR-CHEM-001:** Search and retrieve PubChem compounds.
- **FR-CHEM-002:** Accept CID, SMILES, SDF, and MOL.
- **FR-CHEM-003:** Deduplicate compounds.
- **FR-CHEM-004:** Store molecular formula, weight, SMILES, InChIKey, donors, acceptors, rotatable bonds, TPSA, and flags.
- **FR-CHEM-005:** Generate 2D depictions.
- **FR-CHEM-006:** Generate or retrieve 3D conformers.

## 8.7 Preparation and docking

- **FR-PREP-001:** Prepare ligands.
- **FR-PREP-002:** Prepare receptors.
- **FR-PREP-003:** Store every preparation parameter.
- **FR-PREP-004:** Store prepared PDBQT files.
- **FR-PREP-005:** Reject invalid molecules.
- **FR-DOCK-001:** Support AutoDock Vina.
- **FR-DOCK-002:** Validate docking box deterministically.
- **FR-DOCK-003:** Run repeated seeds for every selected compound.
- **FR-DOCK-004:** Store seed, exhaustiveness, box, hashes, Vina version, scores, poses, and logs.
- **FR-DOCK-005:** Calculate score stability.
- **FR-DOCK-006:** Cluster poses.
- **FR-DOCK-007:** Extract interaction summaries.
- **FR-DOCK-008:** Never call a docking score proof of efficacy.

## 8.8 Ranking and optimisation

- **FR-RANK-001:** Deterministic weighted ranking is required.
- **FR-RANK-002:** ML ranking is required.
- **FR-RANK-003:** Store every score component separately.
- **FR-RANK-004:** Display feature-level explanations.
- **FR-RANK-005:** Apply missing-evidence penalties.
- **FR-RANK-006:** Apply disagreement penalties.
- **FR-RANK-007:** Support calibrated probabilities.
- **FR-RANK-008:** Version weight changes and rerank.
- **FR-CONST-001:** Generate multi-epitope constructs.
- **FR-CONST-002:** Implement greedy maximum coverage.
- **FR-CONST-003:** Implement a multi-objective genetic algorithm.
- **FR-CONST-004:** Support length, epitope-count, coverage, redundancy, and safety constraints.
- **FR-CONST-005:** Allow manual editing.
- **FR-CONST-006:** Produce FASTA and a diagram.

## 8.9 Human governance

- **FR-HITL-001:** Approve configuration before execution.
- **FR-HITL-002:** Approve shortlist before construct generation.
- **FR-HITL-003:** Approve compounds before docking unless policy explicitly permits automatic execution.
- **FR-HITL-004:** Approve final export.
- **FR-HITL-005:** Record identity, time, comment, configuration hash, and entities.
- **FR-HITL-006:** Rejection requires a reason.
- **FR-HITL-007:** Upstream changes invalidate affected approvals.

## 8.10 Reporting, export, replay, and evaluation

- **FR-REP-001:** Generate a researcher-readable summary.
- **FR-REP-002:** Separate methods, predictions, gates, ML prioritisation, researcher decisions, limitations, and validation roadmap.
- **FR-REP-003:** Include tool/model versions.
- **FR-REP-004:** Include rejected candidates and reasons.
- **FR-REP-005:** Include research-use-only limitations.
- **FR-EXP-001:** Export a complete ZIP.
- **FR-EXP-002:** Include raw, processed, visual, and trace outputs.
- **FR-EXP-003:** Include a checksum manifest.
- **FR-REPRO-001:** Replay complete runs.
- **FR-REPRO-002:** Replay failed stages.
- **FR-REPRO-003:** Reuse stored versions, parameters, inputs, and seeds where available.
- **FR-REPRO-004:** Label replay exact, best-effort, or non-reproducible.
- **FR-OBS-001:** Display the live workflow graph.
- **FR-OBS-002:** Show queued, running, waiting, retrying, completed, failed, blocked, awaiting approval, cancelled, and abstained states.
- **FR-OBS-003:** Record latency, retries, failures, model usage, context usage, and worker details.
- **FR-EVAL-001:** Include tool-contract tests.
- **FR-EVAL-002:** Include agent tool-selection tests.
- **FR-EVAL-003:** Include workflow recovery tests.
- **FR-EVAL-004:** Include ranking-model evaluation.
- **FR-EVAL-005:** Include scientific regression datasets.
- **FR-EVAL-006:** Generate evaluation reports.

---

# 9. Researcher Interface

## 9.1 Main navigation

- Dashboard
- Projects
- New Project
- Runs
- Approvals
- Evaluation
- Administration
- Help

## 9.2 Project tabs

1. Overview
2. Inputs
3. Workflow
4. Epitope Analysis
5. Population Coverage
6. Protein Structure
7. Vaccine Construct
8. Antiviral Screening
9. Evidence Graph
10. Validation
11. Approvals
12. Workflow Trace
13. Reports
14. Downloads
15. Settings

Tabs may be disabled when not applicable but must remain part of the product.

## 9.3 Required screen behaviour

### Overview

Show objective, mode, latest run, status, candidate counts, warnings, pending approvals, key charts, tool versions, and export state.

### Inputs

Support paste, upload, identifier lookup, validation preview, metadata editing, and input history.

### Workflow

Show graph nodes, edges, parallel groups, active node, retries, approvals, failure routes, elapsed time, and node details.

### Epitope Analysis

Show ranked table, filters, sequence map, HLA heatmap, candidate comparison, evidence panel, approval actions, and export.

### Population Coverage

Show charts, coverage table, allele details, marginal contribution, and methodology notes.

### Protein Structure

Show interactive 3D structure, residue selection, epitope highlighting, pocket highlighting, confidence colours, surface view, mapping, and downloads.

### Vaccine Construct

Show construct alternatives, objective values, sequence, linkers, diagram, manual editor, warnings, approval, and FASTA export.

### Antiviral Screening

Show compound cards, 2D structures, descriptors, preparation state, ranked docking, repeated scores, pose stability, 3D pose, 2D interaction map, comparison, and approvals.

### Evidence Graph

Show an interactive graph, node and edge filters, provenance, versions, approvals, and path explanations.

### Validation

Show passed gates, warnings, blocked items, abstentions, conflicts, missing evidence, and rerun actions.

### Reports and Downloads

Show report versions, package manifest, individual files, checksums, export history, and regeneration.

---

# 10. Required Outputs

## 10.1 Text outputs

- run summary,
- methods summary,
- candidate explanation,
- rejection explanation,
- uncertainty summary,
- conflict summary,
- final research summary,
- experimental-validation roadmap,
- limitations.

## 10.2 Tables

- raw epitope predictions,
- ranked and rejected epitopes,
- HLA-binding matrix,
- population coverage,
- structure-quality summary,
- compounds,
- docking runs,
- pose stability,
- construct alternatives,
- tool/model versions,
- approvals,
- workflow events.

## 10.3 Visualisations

- linear epitope map,
- HLA heatmap,
- population-coverage chart,
- confidence distribution,
- predictor-agreement chart,
- interactive protein structure,
- structure-confidence map,
- vaccine-construct diagram,
- 2D chemical structure,
- 3D conformer,
- docking pose,
- 2D interaction diagram,
- docking-score distribution,
- pose-cluster plot,
- evidence graph,
- workflow graph,
- feature-importance chart,
- calibration plot,
- evaluation dashboard.

## 10.4 File types

FASTA, CSV, JSON, JSONL, PDB, mmCIF, SDF, MOL, PDBQT, PNG, SVG, HTML, PDF, and ZIP.

---

# 11. Export Package

```text
ImmunoGraph_<project_id>_<run_id>.zip
├── manifest.json
├── README.txt
├── final_report.pdf
├── executive_summary.txt
├── limitations.txt
├── methods/
│   ├── workflow_config.json
│   ├── ranking_config.json
│   ├── tool_versions.json
│   ├── model_versions.json
│   ├── environment.json
│   └── seeds.json
├── inputs/
│   ├── input_sequence.fasta
│   ├── input_structure.*
│   ├── input_compounds.*
│   └── input_metadata.json
├── epitopes/
│   ├── all_predictions.csv
│   ├── ranked_candidates.csv
│   ├── rejected_candidates.csv
│   ├── selected_epitopes.fasta
│   └── epitope_evidence.json
├── population/
│   ├── coverage.csv
│   ├── allele_frequencies.csv
│   └── marginal_contribution.csv
├── structures/
│   ├── target_structure.pdb
│   ├── structure_metadata.json
│   ├── confidence.json
│   └── mapping.json
├── constructs/
│   ├── construct_candidates.csv
│   ├── selected_construct.fasta
│   ├── selected_construct.json
│   └── optimisation_trace.json
├── compounds/
│   ├── compounds.csv
│   ├── selected_compounds.sdf
│   ├── descriptors.csv
│   └── compound_provenance.json
├── docking/
│   ├── receptor.pdbqt
│   ├── ligands/
│   ├── poses/
│   ├── docking_runs.csv
│   ├── pose_clusters.csv
│   ├── interactions.json
│   └── vina_logs/
├── graphs/
│   ├── evidence_graph.json
│   ├── evidence_graph.graphml
│   └── workflow_graph.json
├── trace/
│   ├── workflow_events.jsonl
│   ├── tool_calls.jsonl
│   ├── approvals.json
│   ├── errors.json
│   └── replay_metadata.json
└── visualisations/
    ├── epitope_map.png
    ├── hla_heatmap.png
    ├── population_coverage.png
    ├── predictor_agreement.png
    ├── protein_structure.html
    ├── structure_confidence.png
    ├── vaccine_construct.svg
    ├── docking_pose.html
    ├── interaction_diagram.svg
    ├── evidence_graph.html
    ├── workflow_graph.svg
    ├── feature_importance.png
    └── calibration_plot.png
```

---

# 12. System Architecture

```text
Web Application
    |
API Gateway / Backend
    |
Application Services
    |
Workflow Orchestrator
    |
Agent Runtime
    |
MCP Client Layer
    |
+----------------------+----------------------+----------------------+
| Immunoinformatics MCP| Protein Structure MCP| Chemistry/Docking MCP|
+----------------------+----------------------+----------------------+
                         |
                 Evidence/Governance MCP
                         |
                 Data and Artifact Layer
```

## 12.1 Default technology choices

### Frontend

- React or Next.js
- TypeScript
- TanStack Query
- graph visualisation library
- Mol* or equivalent structure viewer
- charting library
- WebSocket or server-sent events

### Backend

- Python FastAPI for scientific/orchestration services
- TypeScript where NitroStack SDK integration requires it
- Pydantic and Zod schemas
- asynchronous workers

### Storage

- PostgreSQL for relational state
- Neo4j or another property graph for scientific evidence
- S3-compatible object storage for artifacts
- Redis for caching, locks, and coordination

### Observability

- structured logs
- distributed traces
- metrics
- error monitoring
- per-run trace viewer

### Deployment

- containers
- separate CPU/GPU workers
- sandboxed scientific execution
- development, test, staging, and production environments

---

# 13. MCP Architecture

## 13.1 MCP design rules

MCP servers are organised by domain, not by page or one-per-agent.

Every MCP tool requires:

- unique name,
- semantic version,
- typed input/output schemas,
- typed errors,
- timeout,
- retry classification,
- idempotency rule,
- provenance fields,
- access policy,
- validation rule,
- observability tags.

## 13.2 Immunoinformatics MCP

### Tools

- `validate_protein_sequence`
- `generate_candidate_peptides`
- `predict_mhci_epitopes`
- `predict_mhcii_epitopes`
- `predict_bcell_linear`
- `predict_bcell_structure_aware`
- `calculate_predictor_consensus`
- `calculate_epitope_conservancy`
- `calculate_population_coverage`
- `detect_overlapping_epitopes`
- `map_epitope_to_sequence`
- `get_immunoinformatics_provenance`

### Resources

- `sequence://{sequence_id}`
- `peptide-set://{set_id}`
- `epitope-result://{result_id}`
- `population-config://{config_id}`

### Prompts

- `plan_epitope_screening`
- `review_epitope_conflicts`
- `explain_candidate_selection`

## 13.3 Protein Structure MCP

### Tools

- `search_pdb_structures`
- `fetch_pdb_structure`
- `fetch_alphafold_structure`
- `register_uploaded_structure`
- `assess_structure_quality`
- `assess_structure_confidence`
- `map_sequence_to_structure`
- `map_epitopes_to_structure`
- `calculate_surface_accessibility`
- `identify_binding_pockets`
- `validate_binding_pocket`
- `flag_low_confidence_regions`
- `render_structure_snapshot`
- `get_structure_provenance`

### Resources

- `structure://{structure_id}`
- `structure-map://{mapping_id}`
- `pocket://{pocket_id}`
- `confidence://{confidence_id}`

### Prompts

- `select_best_structure`
- `review_low_confidence_mapping`
- `explain_structure_gate`

## 13.4 Chemistry and Docking MCP

### Tools

- `search_pubchem_compounds`
- `fetch_compound_properties`
- `fetch_compound_2d_structure`
- `fetch_compound_3d_structure`
- `register_uploaded_compound`
- `deduplicate_compounds`
- `convert_molecular_format`
- `generate_3d_conformer`
- `prepare_ligand`
- `prepare_receptor`
- `validate_docking_box`
- `run_vina_docking`
- `repeat_docking_with_seeds`
- `cluster_docking_poses`
- `extract_binding_interactions`
- `compare_docking_runs`
- `render_compound_2d`
- `render_docking_pose`
- `get_docking_provenance`

### Resources

- `compound://{compound_id}`
- `ligand://{ligand_id}`
- `receptor://{receptor_id}`
- `docking-run://{run_id}`
- `pose://{pose_id}`

### Prompts

- `plan_compound_screen`
- `review_docking_instability`
- `explain_compound_ranking`

## 13.5 Evidence and Governance MCP

### Tools

- `create_project_evidence_graph`
- `create_workflow_run`
- `store_scientific_evidence`
- `store_candidate`
- `link_evidence`
- `rank_epitope_candidates`
- `rank_antiviral_candidates`
- `compare_candidates`
- `explain_candidate_ranking`
- `record_human_approval`
- `reject_candidate`
- `flag_candidate`
- `get_candidate_provenance`
- `get_workflow_trace`
- `replay_workflow`
- `replay_stage`
- `export_validation_package`
- `generate_research_report`
- `generate_experimental_validation_roadmap`

### Resources

- `project://{project_id}`
- `run://{run_id}`
- `candidate://{candidate_id}`
- `evidence://{evidence_id}`
- `approval://{approval_id}`
- `artifact://{artifact_id}`
- `trace://{trace_id}`

### Prompts

- `plan_research_workflow`
- `review_candidate_evidence`
- `explain_rejected_candidate`
- `summarise_run`
- `generate_validation_roadmap`

## 13.6 Orchestrator MCP

### Tools

- `start_vaccine_discovery`
- `start_antiviral_screening`
- `start_combined_analysis`
- `get_workflow_status`
- `get_workflow_graph`
- `get_pending_approvals`
- `approve_workflow_stage`
- `reject_workflow_stage`
- `resume_workflow`
- `cancel_workflow`
- `retry_failed_node`
- `replay_failed_stage`
- `export_research_package`

---

# 14. Common MCP Contracts

## 14.1 Request envelope

```json
{
  "request_id": "uuid",
  "project_id": "uuid",
  "workflow_run_id": "uuid",
  "actor": {"type": "user|agent|system", "id": "string"},
  "tool_version": "semver",
  "input": {},
  "context_refs": [],
  "idempotency_key": "string",
  "requested_at": "ISO-8601"
}
```

## 14.2 Response envelope

```json
{
  "request_id": "uuid",
  "tool_name": "string",
  "tool_version": "semver",
  "status": "success|partial|failed|abstained",
  "output": {},
  "warnings": [],
  "errors": [],
  "provenance": {
    "input_hashes": [],
    "output_hashes": [],
    "external_services": [],
    "model_versions": [],
    "parameters": {},
    "started_at": "ISO-8601",
    "completed_at": "ISO-8601",
    "duration_ms": 0,
    "worker_id": "string"
  }
}
```

## 14.3 Error envelope

```json
{
  "code": "TOOL_TIMEOUT|INVALID_INPUT|SCHEMA_MISMATCH|EXTERNAL_SERVICE_FAILURE|SCIENTIFIC_GATE_FAILED|UNSUPPORTED_OPERATION",
  "message": "Human-readable message",
  "retryable": true,
  "details": {},
  "suggested_action": "string"
}
```

No scientific numeric output may omit unit, method, source, version, parameters, and entity reference.

---

# 15. Agent Architecture

Every agent must define role, allowed tools, forbidden actions, input/output schemas, maximum iterations, context budget, retry policy, abstention conditions, and evaluation dataset.

## 15.1 Supervisor Agent

Plans graphs, assigns tasks, handles dependencies and failures, requests approvals, and terminates safely. It cannot invent scientific scores.

## 15.2 Intake and Policy Agent

Validates objective, mode, policy, and configuration completeness, then prepares the approval summary.

## 15.3 T-Cell Agent

Runs MHC-I/MHC-II tools, validates schemas, manages HLA settings, and stores evidence.

## 15.4 B-Cell Agent

Runs linear and structure-aware prediction, computes agreement, and flags conflicts.

## 15.5 Population Agent

Validates population configuration, calculates coverage and marginal contribution, and stores frequency provenance.

## 15.6 Structure Agent

Selects structures, evaluates quality, maps sequences and candidates, calculates accessibility, and flags low-confidence regions.

## 15.7 Compound Intelligence Agent

Retrieves, deduplicates, validates, and queues compounds.

## 15.8 Docking Agent

Prepares inputs, validates boxes, runs repeated docking, clusters poses, extracts interactions, and flags instability.

## 15.9 Ranking Agent

Requests deterministic and ML scores, preserves components, and never overrides failed hard gates.

## 15.10 Verifier/Critic Agent

Checks schemas, provenance, unsupported claims, predictor disagreement, approval compliance, and decides pass/retry/reject/abstain.

## 15.11 Reporting Agent

Generates explanations and reports only from stored evidence. It cannot create new scientific facts.

---

# 16. Bounded ReAct Loop

```text
1. PLAN    Select one permitted next action.
2. ACT     Invoke one typed MCP tool.
3. OBSERVE Receive structured output and provenance.
4. VERIFY  Apply schema and scientific checks.
5. DECIDE  Continue, retry, route, request approval, reject, or abstain.
```

Default limits:

- ordinary agent: 3 iterations,
- supervisor: 5,
- verifier: 3,
- reporting: 2.

The platform must prevent infinite loops, identical repeated calls without changed input, recursive spawning, hidden tool calls, and unbounded context growth. Every iteration is logged.

---

# 17. Workflow Graph Semantics

## 17.1 Node types

- deterministic function,
- MCP call,
- agent step,
- data join,
- validation gate,
- approval gate,
- branch,
- loop,
- export,
- terminal success,
- terminal failure,
- terminal abstention.

## 17.2 Edge types

- success,
- partial,
- failure,
- retry,
- approval granted,
- approval rejected,
- condition true,
- condition false,
- timeout,
- abstention.

## 17.3 Join definition

Each join declares required parents, optional parents, timeout, partial policy, missing-evidence penalty, and escalation route.

## 17.4 Checkpointing

Checkpoint before and after external calls, before and after approvals, before long-running docking, after ranking, and before export.

---

# 18. Context Management

Four context layers are required:

1. **Run state:** objective, configuration, active node, completed nodes, approvals, candidates, warnings.
2. **Agent-local context:** minimum evidence needed by one agent.
3. **Evidence graph:** persistent structured scientific relationships.
4. **Artifact store:** raw and large files.

Rules:

- Never place complete PDB, SDF, PDBQT, or huge tables in an LLM prompt.
- Use artifact references and compact summaries.
- Every context item must have a source.
- Clear or compact agent-local context after completion.
- Summaries never replace raw evidence.
- Compression must preserve IDs, scores, warnings, and provenance links.

---

# 19. Evidence Graph

## 19.1 Required nodes

Project, WorkflowRun, User, Approval, Pathogen, Protein, Sequence, Peptide, EpitopeCandidate, HLAAllele, Population, Prediction, Predictor, Tool, ToolVersion, Structure, StructureRegion, BindingPocket, Compound, MolecularDescriptor, Ligand, Receptor, DockingRun, DockingPose, Interaction, Construct, EvidenceSource, ValidationGate, Artifact, Report, Model, ModelVersion, Configuration.

## 19.2 Required edges

`HAS_RUN`, `USES_CONFIGURATION`, `HAS_SEQUENCE`, `DERIVED_FROM`, `PREDICTED_BY`, `PRODUCED_BY`, `BINDS_TO`, `OBSERVED_IN`, `COVERS`, `MAPPED_TO`, `REPRESENTS`, `HAS_REGION`, `LOCATED_IN`, `HAS_CONFIDENCE`, `DOCKED_TO`, `PRODUCED_POSE`, `INTERACTS_WITH`, `SUPPORTED_BY`, `CONTRADICTED_BY`, `PASSED_GATE`, `FAILED_GATE`, `APPROVED_BY`, `REJECTED_BY`, `EXPORTED_AS`, `USES_TOOL_VERSION`, `USES_MODEL_VERSION`.

Every final candidate must trace to source input, producing tools, versions, parameters, run, evidence, gates, ranking components, decision, and approvals.

---

# 20. Relational Data Model

Minimum tables:

- users,
- roles,
- projects,
- project_members,
- project_configs,
- workflow_runs,
- workflow_nodes,
- workflow_edges,
- workflow_events,
- approvals,
- artifacts,
- sequences,
- structures,
- compounds,
- epitope_candidates,
- docking_runs,
- docking_poses,
- constructs,
- predictions,
- ranking_runs,
- ranking_components,
- validation_results,
- tool_definitions,
- tool_versions,
- model_definitions,
- model_versions,
- evaluation_runs,
- audit_events,
- exports.

Every mutable scientific record must contain ID, project ID, run ID, timestamps, creator, source, version, hash, status, and supersedes ID when versioned.

---

# 21. AI/ML and Algorithms

## 21.1 External scientific models/tools

- NetMHCpan or equivalent MHC predictor,
- IEDB-supported methods,
- GraphBepi or equivalent structure-aware B-cell predictor,
- AlphaFold structures,
- AutoDock Vina,
- cheminformatics descriptor calculations,
- optional protein-language-model embeddings.

These are versioned tools, not ground truth.

## 21.2 Team-built consensus epitope ranker

Default: XGBoost or LightGBM.

Candidate features:

- MHC-I percentile,
- MHC-II percentile,
- predicted affinity,
- B-cell score,
- predictor count,
- predictor agreement,
- population coverage,
- marginal coverage,
- conservation,
- accessibility,
- structure confidence,
- antigenicity prediction,
- toxicity/allergenicity flags,
- peptide length,
- missing evidence,
- conflict score.

Output: calibrated prioritisation probability, never experimental truth.

## 21.3 Calibration

Support Platt scaling and isotonic regression. Report Brier score, expected calibration error, and reliability curve.

## 21.4 Predictor disagreement

```text
disagreement =
    weighted_variance(normalised_predictor_scores)
  + missing_evidence_penalty
  + conflicting_classification_penalty
  + structure_conflict_penalty
```

Store every component.

## 21.5 Multi-objective genetic algorithm

Objectives:

- maximise population coverage,
- maximise confidence,
- maximise conservation,
- maximise HLA diversity,
- balance MHC-I/MHC-II,
- minimise length,
- minimise redundancy,
- minimise safety flags,
- minimise low-confidence content.

Support seeded reproducibility, population size, generations, elitism, mutation, crossover, constraint repair, and weighted/Pareto modes.

## 21.6 Greedy baseline

Select the epitope with the highest additional weighted population coverage per cost until constraints are met. Compare greedy and genetic results.

## 21.7 Docking-pose clustering

Support DBSCAN and hierarchical clustering using pose RMSD. Produce cluster membership, largest-cluster fraction, representative pose, outliers, and stability score.

## 21.8 Optional anomaly detection

Isolation Forest may flag abnormal results but may not directly reject candidates.

---

# 22. Ranking Formulas

## 22.1 Vaccine priority

```text
vaccine_priority =
    w1 * predictor_consensus
  + w2 * normalised_hla_binding
  + w3 * population_coverage
  + w4 * conservation
  + w5 * structural_accessibility
  + w6 * structure_confidence
  + w7 * calibrated_ml_probability
  - w8 * missing_evidence_penalty
  - w9 * conflict_penalty
  - w10 * safety_flag_penalty
```

Hard-gate failures override ranking.

## 22.2 Antiviral priority

```text
antiviral_priority =
    w1 * normalised_mean_docking_score
  + w2 * pose_cluster_consistency
  + w3 * repeated_run_stability
  + w4 * interaction_consistency
  + w5 * structure_quality
  + w6 * compound_evidence_quality
  + w7 * calibrated_ml_probability
  - w8 * descriptor_alert_penalty
  - w9 * unstable_pose_penalty
  - w10 * missing_evidence_penalty
```

A single best docking score must never determine final rank.

---

# 23. Scientific Gates and Abstention

## 23.1 Hard gates

- invalid FASTA,
- invalid HLA identifier,
- structure parse failure,
- sequence mapping failure,
- missing receptor,
- invalid docking box,
- preparation failure,
- non-finite score,
- missing provenance,
- schema mismatch,
- missing approval,
- unsupported version.

Hard-gate failure blocks progression.

## 23.2 Soft gates

- predictor disagreement,
- low population contribution,
- low structure confidence,
- high docking variance,
- low pose consistency,
- missing optional evidence,
- anomaly flag.

Soft gates flag, penalise, or request review.

## 23.3 Abstention conditions

The system abstains when required tools repeatedly fail, evidence is insufficient, contradictions exceed threshold, structural mapping is unreliable, provenance is incomplete, approval is denied, or a conclusion would require unsupported inference.

---

# 24. Human Approval Policy

Required checkpoints:

1. Research configuration.
2. Candidate shortlist before construct generation.
3. Target and compounds before docking.
4. Threshold changes that alter accepted candidates.
5. Final export.
6. Any override of a validation warning.

Approvals expire when affected inputs, tools, models, configurations, seeds, candidates, or artifacts change.

---

# 25. Observability

## 25.1 MCP telemetry

Capture request ID, tool, version, project, run, node, timestamps, duration, status, retries, error code, hashes, dependency, worker, and cache state.

## 25.2 Agent telemetry

Capture agent, iteration, action, selected tool, validation result, next decision, context size, and termination reason.

## 25.3 Workflow telemetry

Capture graph version, node states, critical path, parallel speed-up, duration, approval wait, failures, and retry recovery.

## 25.4 Dashboard metrics

- workflow completion,
- tool-call success,
- schema pass rate,
- retry success,
- abstention rate,
- unsupported-claim rate,
- average context,
- cost,
- deterministic replay,
- approval compliance,
- rejection distribution.

---

# 26. Evaluation Harness

## 26.1 MCP tool tests

- valid input,
- invalid input,
- timeout,
- external failure,
- schema regression,
- provenance completeness,
- idempotency.

## 26.2 Agent metrics

- correct tool selection,
- invalid/unnecessary calls,
- ReAct iterations,
- recovery,
- escalation,
- abstention,
- unsupported-claim rate.

## 26.3 Ranking metrics

- ROC-AUC,
- PR-AUC,
- F1,
- precision@K,
- recall@K,
- Brier score,
- calibration error,
- ranking stability,
- feature importance,
- subgroup performance.

## 26.4 Construct metrics

Coverage, count, length, HLA diversity, redundancy, runtime, reproducibility, and genetic-vs-greedy comparison.

## 26.5 Docking metrics

Mean score, score standard deviation, pose-cluster consistency, representative-pose stability, repeated-run reproducibility, and benchmark behaviour where available.

## 26.6 Workflow scenarios

Normal success, temporary failure, repeated schema failure, low-confidence structure, disagreement, approval rejection, approval resume, cached replay, exact replay, and abstention.

---

# 27. Security and Scientific Safety

## 27.1 Application security

- authenticated access,
- role-based authorisation,
- encrypted secrets,
- no API keys in logs,
- signed artifact links,
- upload validation,
- size limits,
- sandboxed tools,
- network controls,
- rate limiting,
- audit logs.

## 27.2 Scientific safety

- research-use-only notice,
- no clinical claims,
- explicit limitations,
- approval before export,
- uncertainty display,
- no fabricated measurements,
- no silent fallback,
- no silent replacement of missing data.

## 27.3 Privacy

Support project isolation, configurable retention, deletion, export history, access logs, and optional private deployment.

---

# 28. Non-Functional Requirements

## Reliability

Workflow state survives restarts, long tasks resume, duplicates are idempotent, failures do not corrupt state, and approvals are durable.

## Performance targets for standard demonstration datasets

- local UI state: under 300 ms,
- ordinary API read: under 2 s,
- workflow status propagation: under 3 s,
- cached result retrieval: under 5 s,
- export assembly: under 60 s.

Scientific execution time is workload-dependent and must be displayed honestly.

## Scalability

Horizontal workers, CPU/GPU queues, per-project concurrency, backpressure, and queue visibility.

## Maintainability

Typed schemas, modular services, migrations, automated tests, generated docs, clear repository structure, and no scientific logic only in the frontend.

## Accessibility

Keyboard support, readable contrast, labels, non-colour status indicators, and downloadable data for charts.

---

# 29. Error Handling

Every error must include stable code, explanation, retryability, affected stage, affected entities, recommended action, and trace link.

Required categories:

- user input,
- validation,
- external service,
- local tool execution,
- worker failure,
- timeout,
- approval,
- schema,
- storage,
- graph execution,
- export.

The UI must never show only “Something went wrong.”

---

# 30. Caching, Reuse, and Versioning

Cache keys must include input hash, tool version, parameters, model version, and environment signature. Cache provenance and reuse must be visible.

Version:

- workflow graphs,
- MCP tools,
- schemas,
- scientific tools,
- models,
- ranking settings,
- project configurations,
- reports,
- exports.

A version change affecting scientific output invalidates exact replay unless the earlier version remains available.

---

# 31. Deployment

Minimum services:

- frontend,
- API,
- orchestrator,
- immunoinformatics MCP,
- structure MCP,
- chemistry/docking MCP,
- evidence/governance MCP,
- workers,
- PostgreSQL,
- graph database,
- Redis,
- object storage,
- observability stack.

Worker pools:

- `general-cpu`
- `bioinformatics-cpu`
- `docking-cpu`
- `gpu-optional`
- `reporting`
- `export`

Secrets must never be committed.

---

# 32. Repository Structure

```text
immunograph-studio/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── services/
│   ├── orchestrator/
│   ├── mcp-immunoinformatics/
│   ├── mcp-structure/
│   ├── mcp-chemistry-docking/
│   └── mcp-evidence-governance/
├── packages/
│   ├── contracts/
│   ├── schemas/
│   ├── scientific-validation/
│   ├── ranking/
│   ├── workflow-types/
│   ├── observability/
│   └── ui-components/
├── ml/
│   ├── datasets/
│   ├── training/
│   ├── calibration/
│   ├── evaluation/
│   └── registry/
├── infra/
│   ├── docker/
│   ├── compose/
│   ├── kubernetes/
│   └── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── workflow/
│   ├── scientific-regression/
│   └── e2e/
├── docs/
│   ├── decisions/
│   ├── schemas/
│   ├── runbooks/
│   └── user-guides/
├── demo/
│   ├── datasets/
│   ├── scripts/
│   └── expected-outputs/
└── README.md
```

---

# 33. Minimum API Surface

## Projects

- `POST /projects`
- `GET /projects`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `POST /projects/{id}/duplicate`

## Inputs

- `POST /projects/{id}/sequences`
- `POST /projects/{id}/structures`
- `POST /projects/{id}/compounds`
- `POST /projects/{id}/validate-inputs`

## Workflows

- `POST /projects/{id}/runs`
- `GET /runs/{id}`
- `GET /runs/{id}/graph`
- `GET /runs/{id}/events`
- `POST /runs/{id}/cancel`
- `POST /runs/{id}/retry-node`
- `POST /runs/{id}/replay`

## Candidates

- `GET /runs/{id}/epitopes`
- `GET /runs/{id}/compounds`
- `GET /candidates/{id}`
- `POST /candidates/{id}/approve`
- `POST /candidates/{id}/reject`
- `POST /candidates/{id}/flag`
- `POST /candidates/compare`

## Approvals

- `GET /approvals`
- `GET /approvals/{id}`
- `POST /approvals/{id}/approve`
- `POST /approvals/{id}/reject`
- `POST /approvals/{id}/request-changes`

## Reports and exports

- `POST /runs/{id}/reports`
- `GET /reports/{id}`
- `POST /runs/{id}/exports`
- `GET /exports/{id}`
- `GET /exports/{id}/manifest`

## Evaluation

- `POST /evaluation/runs`
- `GET /evaluation/runs/{id}`
- `GET /evaluation/metrics`

Live updates use WebSocket or server-sent events.

---

# 34. Demo Scenarios

## Successful vaccine workflow

Upload sequence, validate, approve, display parallel agents, rank, inspect evidence, approve shortlist, create construct, and export.

## Failure recovery

Simulate predictor timeout, retry, use permitted fallback or cached result, preserve trace, and continue with warning.

## Scientific abstention

Use low-confidence structure plus predictor disagreement; verifier blocks promotion and returns insufficient evidence.

## Human approval

Pause before docking, edit compounds, approve, resume, and show trace continuity.

## Docking stability

Dock five compounds over repeated seeds; rank a stable compound above a single-run outlier.

## Replay

Replay using original inputs, parameters, versions, and seeds; compare outputs and label replay status.

---

# 35. Acceptance Criteria

The product is accepted only when:

1. Researchers can complete Vaccine and Antiviral workflows.
2. All required MCP servers and tools exist.
3. Sequential and parallel graph execution works.
4. ReAct loops are bounded and observable.
5. Deterministic gates block invalid work.
6. Human approvals pause and resume execution.
7. Ranking stores every component.
8. Evidence graph traces every final candidate.
9. Required visualisations are generated.
10. Full export package is produced.
11. Failed stages can retry or replay.
12. Evaluation harness produces metrics.
13. LLMs do not fabricate scientific values.
14. Reports include limitations and research-use-only language.
15. Genetic and greedy construct algorithms both work.
16. Repeated docking, clustering, and interaction extraction work.
17. Observability shows every call, retry, warning, approval, and provenance link.

---

# 36. Testing Strategy

## Unit

Validators, normalisers, scoring, penalties, ranking, graph transitions, approval invalidation, checksums, and manifests.

## Contract

Every MCP input/output/error schema.

## Integration

API-orchestrator, orchestrator-MCP, MCP-external tool, persistence, graph database, object storage, queues, and export.

## End-to-end

Complete Vaccine, Antiviral, Combined, failure, rejection, replay, and export scenarios.

## Scientific regression

Fixed inputs with expected lengths, count ranges, mappings, errors, deterministic scoring, and stability ranges. Do not assert exact nondeterministic outputs unless versions and seeds are pinned.

---

# 37. Delivery Order Without Feature Reduction

## Phase 1 — Foundation

Repository, auth, projects, schemas, PostgreSQL, object storage, audit logs, base UI, MCP contract framework.

## Phase 2 — Orchestration

Persistent graph, parallelism, retries, approvals, live events, supervisor, ReAct loop.

## Phase 3 — Immunoinformatics

Validation, peptides, MHC-I, MHC-II, B-cell, population, conservation, candidates.

## Phase 4 — Structure

PDB, AlphaFold, uploads, quality, mapping, accessibility, 3D viewer, confidence gate.

## Phase 5 — Ranking and Evidence

Deterministic ranking, graph, XGBoost/LightGBM, calibration, disagreement, verifier.

## Phase 6 — Construct Design

Greedy, genetic algorithm, constraints, editor, FASTA, diagrams.

## Phase 7 — Chemistry and Docking

PubChem, compounds, conversion, preparation, Vina, seeds, clustering, interactions, visualisations.

## Phase 8 — Reporting and Export

Reports, limitations, validation roadmap, ZIP, manifest, downloads.

## Phase 9 — Observability and Evaluation

Trace dashboard, metrics, tool/agent/model/workflow evaluation, replay testing.

## Phase 10 — Hardening

Security, rate limits, load tests, failure injection, deployment, demo datasets, documentation.

---

# 38. Coding Agent Rules

The coding agent must:

1. Read this PRD before each major task.
2. Reference requirement IDs in code changes.
3. Define schemas before business logic.
4. Add tests with implementation.
5. Never bypass gates for convenience.
6. Never place mock scientific values in production paths.
7. Label demo fixtures clearly.
8. Use feature flags for rollout, not scope deletion.
9. Preserve raw outputs.
10. Preserve provenance.
11. Keep large artifacts outside LLM context.
12. Keep agents bounded and tool-driven.
13. Treat model output as untrusted until validated.
14. Return explicit errors instead of guessing.
15. Record architectural decisions.
16. Keep scientific logic server-side.
17. Version MCP contracts.
18. Make workflows resumable.
19. Generate charts from stored structured data.
20. Ensure every report statement links to evidence.

---

# 39. Default Configuration

```yaml
project:
  mode: combined
  research_use_only: true

workflow:
  max_agent_iterations: 3
  max_supervisor_iterations: 5
  retries:
    external_api: 2
    local_tool: 1
  require_configuration_approval: true
  require_shortlist_approval: true
  require_docking_approval: true
  require_export_approval: true

vaccine:
  mhci_enabled: true
  mhcii_enabled: true
  bcell_enabled: true
  structure_enabled: true
  conservation_enabled: true
  population_coverage_enabled: true
  construct_optimisation:
    greedy: true
    genetic_algorithm: true

antiviral:
  compound_source: pubchem
  compound_limit: 20
  repeated_docking_seeds: [11, 29, 47]
  vina_exhaustiveness: 16
  pose_clustering: dbscan

ranking:
  deterministic_enabled: true
  ml_enabled: true
  calibration_enabled: true
  disagreement_penalty_enabled: true
  missing_evidence_penalty_enabled: true

observability:
  traces: true
  metrics: true
  structured_logs: true
  live_workflow_graph: true

export:
  include_raw_outputs: true
  include_visualisations: true
  include_trace: true
  include_manifest: true
```

---

# 40. Definition of Done

A feature is done only when:

- requirement ID is linked,
- schema exists,
- implementation exists,
- unit and contract tests pass,
- integration works,
- errors are handled,
- provenance is stored,
- observability exists,
- UI state exists where relevant,
- documentation is updated,
- acceptance criteria pass.

The product is done only when the full scope in this PRD is implemented, tested, observable, reproducible, and exportable.

---

# 41. Final Product Promise

ImmunoGraph Studio must provide:

- validated scientific inputs,
- graph-based multi-agent execution,
- typed MCP calls,
- parallel and sequential workflows,
- bounded ReAct reasoning,
- deterministic scientific gates,
- calibrated AI/ML ranking,
- evidence and provenance graphs,
- human approvals,
- transparent uncertainty,
- scientific tables and visualisations,
- vaccine construct proposals,
- antiviral docking analysis,
- observability,
- replay,
- evaluation,
- and a complete research package.

Core principle:

> The system must not always produce an answer. It must produce an answer only when the available computational evidence passes the required scientific, technical, and human-governance checks.
