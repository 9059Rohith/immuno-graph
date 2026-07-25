import { APPROVALS_MODULE } from './approvals/index.js';
import { EVENTS_MODULE } from './events/index.js';
import { EXPORTS_MODULE } from './exports/index.js';
import { PROJECTS_MODULE } from './projects/index.js';
import { RUNS_MODULE } from './runs/index.js';

export const API_SCAFFOLD = {
  modules: [PROJECTS_MODULE, RUNS_MODULE, APPROVALS_MODULE, EXPORTS_MODULE, EVENTS_MODULE],
  routesRegistered: 29,
} as const;
