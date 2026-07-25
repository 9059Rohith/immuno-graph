import { ConstraintController } from './constraint/constraint.controller.js';
import { EvidenceController } from './evidence/evidence.controller.js';
import { PredictionController } from './prediction/prediction.controller.js';
import { ReportController } from './report/report.controller.js';

export const TOOL_GROUPS = [
  {
    name: 'Prediction Tools',
    controller: new PredictionController() as unknown as Record<string, unknown>,
  },
  {
    name: 'Evidence Tools',
    controller: new EvidenceController() as unknown as Record<string, unknown>,
  },
  {
    name: 'Constraint Tools',
    controller: new ConstraintController() as unknown as Record<string, unknown>,
  },
  {
    name: 'Report Tools',
    controller: new ReportController() as unknown as Record<string, unknown>,
  },
] as const;
