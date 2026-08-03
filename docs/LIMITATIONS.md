# Limitations and Responsible-Use Boundary

## Mandatory disclaimer

ImmunoGraph provides computational decision support. It does not discover, validate, prescribe, or recommend a vaccine or medical intervention. All outputs require independent review by qualified researchers and experimental validation.

The public hackathon deployment contains demonstration data only, provides best-effort 24-hour workspace retention, and is not suitable for confidential, patient, clinical, or proprietary inputs.

## Scientific limitations

1. **Prediction is not validation.** MHC binding, B-cell epitope, and population-coverage outputs are computational estimates.
2. **Tools can disagree.** Consensus reduces but does not eliminate model bias or shared training-data bias.
3. **B-cell and T-cell outputs differ.** Their scores and biological meanings are not directly interchangeable. The MVP ranks them in separate tracks.
4. **Population coverage is estimated.** Results depend on allele-frequency sources, population definitions, locus assumptions, and the epitope/HLA associations supplied.
5. **Overlap pruning is heuristic.** Removing a highly overlapping peptide improves shortlist diversity but does not establish biological redundancy.
6. **Fixtures are synthetic, not fresh evidence.** Demo proteins, predictor-shaped outputs,
   population values, and expected rankings exist only for deterministic demos and tests. They
   must retain `SYNTHETIC`, `FIXTURE`, and `scientificUse: false` provenance in every surface and
   export and must not be interpreted as pathogen or research data.
7. **GraphBepi is fixture-only.** MVP B-cell results do not demonstrate a live GraphBepi integration and are limited to curated inputs with exact fixture matches.
8. **Synthetic prediction is demonstration-only.** The deterministic offline binding and population-coverage tools exercise orchestration and reproducibility, not biological validity. Their outputs always carry `scientificUse=false` and must never be used for research conclusions or clinical decisions.
9. **Cached results can age.** Cache reuse is valid only for an exact method/version/parameter key and within the configured retention policy.
10. **External availability is uncontrolled.** APIs, web services, executables, methods, licenses, and quotas may change.
11. **Explanations inherit evidence limits.** LLM-generated text can summarize recorded evidence but adds no scientific confidence.
12. **Fixed scorer coefficients are not trained evidence.** The deterministic dual-head demonstration scorer has no documented training dataset or validation experiment and cannot support an accuracy or biological-validity claim.

## MVP limitations

- One local researcher; no accounts, sharing, roles, or collaboration.
- One protein FASTA record per workflow.
- No batch projects.
- No de novo protein structure prediction.
- The optional 3D structure and docking labs are experimental extensions outside the validated epitope workflow; their demonstration output is not shortlist evidence.
- No vaccine construct optimization.
- No wet-lab protocol execution.
- No automated literature evidence synthesis.
- No model training or continuous learning.
- No conservation calculation, alignment ingestion, conservation constraint, or conservation-weighted ranking.
- No clinical or patient data.
- JSON and CSV are required exports. PDF is optional until a deterministic implementation exists.

## Safety restrictions

- The LLM cannot invoke unregistered scientific tools.
- The LLM cannot generate or edit prediction values, constraint outcomes, rankings, approvals, or provenance.
- A hard-rejected candidate cannot be promoted by an explanation request.
- A `FAILED` branch cannot be represented as negative scientific evidence.
- A fixture result cannot be represented as live or cached.
- Synthetic data cannot be represented as measured, provider-produced, experimentally validated,
  clinically relevant, or suitable for research interpretation.
- An export cannot omit the computational-only disclaimer.

## Interpretation rules

Use these phrases:

- “computationally prioritized candidate”
- “predicted binding”
- “estimated population coverage”
- “requires experimental validation”
- “insufficient or conflicting evidence”

Do not use these phrases as product claims:

- “validated vaccine candidate”
- “effective vaccine”
- “safe epitope”
- “clinically proven”
- “guaranteed immune response”

## Known implementation risks

| Risk | Consequence | Control |
|---|---|---|
| Predictor method/version changes | Non-comparable results | Registry-based adapters and cache-key versioning |
| MHCflurry runtime/model missing | Local MHC-I live execution unavailable | Keep `MHCFLURRY_ENABLED=false` until the CLI and models are installed and verified in the runtime |
| GraphBepi fixture overgeneralization | Results applied beyond curated demo inputs | Exact input/profile matching, fixture-only status, fail closed on mismatch |
| Overly permissive fallback | Demo evidence confused with live evidence | Exact hash matching and `FIXTURE` label |
| Poor default thresholds | Misleading categorization | Versioned config plus domain review |
| LLM embellishment | Unsupported scientific claims | Structured prompt, sentence-level claim checks, deterministic fallback text |
| SQLite write contention | Delayed workflow events | Short transactions, WAL mode, single-process write owner |

## Future work is not current capability

Potential later additions—conservation, batch processing, imported structures, live GraphBepi integration, vaccine construct design, docking, collaborative review, and learned ranking—must be proposed through new architecture decisions and must not be described as existing MVP features.
