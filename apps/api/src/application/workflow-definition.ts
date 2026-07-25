export interface WorkflowStageDefinition {
  key: string;
  label: string;
  column: number;
  dependencies: readonly string[];
  track?: 'MHCI' | 'MHCII' | 'BCELL';
}

export const WORKFLOW_STAGE_DEFINITIONS: readonly WorkflowStageDefinition[] = [
  { key: 'validate_input', label: 'Validate input', column: 0, dependencies: [] },
  {
    key: 'configuration_approval',
    label: 'Configuration approval',
    column: 0,
    dependencies: ['validate_input'],
  },
  {
    key: 'generate_peptides',
    label: 'Generate peptides',
    column: 0,
    dependencies: ['configuration_approval'],
  },
  {
    key: 'predict_mhci',
    label: 'Predict MHC-I',
    column: 1,
    dependencies: ['generate_peptides'],
    track: 'MHCI',
  },
  {
    key: 'predict_mhcii',
    label: 'Predict MHC-II',
    column: 1,
    dependencies: ['generate_peptides'],
    track: 'MHCII',
  },
  {
    key: 'predict_bcell',
    label: 'Predict B-cell',
    column: 1,
    dependencies: ['generate_peptides'],
    track: 'BCELL',
  },
  {
    key: 'join_evidence',
    label: 'Join evidence',
    column: 2,
    dependencies: ['predict_mhci', 'predict_mhcii', 'predict_bcell'],
  },
  {
    key: 'normalize_scores',
    label: 'Normalize scores',
    column: 2,
    dependencies: ['join_evidence'],
  },
  {
    key: 'compute_consensus',
    label: 'Compute consensus',
    column: 2,
    dependencies: ['normalize_scores'],
  },
  {
    key: 'calculate_candidate_coverage',
    label: 'Population coverage',
    column: 3,
    dependencies: ['compute_consensus'],
  },
  {
    key: 'apply_base_constraints',
    label: 'Base constraints',
    column: 3,
    dependencies: ['calculate_candidate_coverage'],
  },
  {
    key: 'preliminary_scoring',
    label: 'Preliminary scoring',
    column: 3,
    dependencies: ['apply_base_constraints'],
  },
  {
    key: 'resolve_overlaps',
    label: 'Resolve overlaps',
    column: 4,
    dependencies: ['preliminary_scoring'],
  },
  {
    key: 'apply_final_constraints',
    label: 'Final constraints',
    column: 4,
    dependencies: ['resolve_overlaps'],
  },
  {
    key: 'final_ranking',
    label: 'Final ranking',
    column: 4,
    dependencies: ['apply_final_constraints'],
  },
  {
    key: 'optimize_shortlist_coverage',
    label: 'Optimize shortlist',
    column: 5,
    dependencies: ['final_ranking'],
  },
  {
    key: 'shortlist_approval',
    label: 'Shortlist approval',
    column: 5,
    dependencies: ['optimize_shortlist_coverage'],
  },
];

export const WORKFLOW_STAGE_BY_KEY = new Map(
  WORKFLOW_STAGE_DEFINITIONS.map((definition) => [definition.key, definition]),
);
