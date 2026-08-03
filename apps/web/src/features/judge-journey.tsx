import type { ProjectDetail, RunDetail } from '@immunograph/shared';
import { Check, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';

export type JudgeStepStatus = 'complete' | 'current' | 'upcoming';

export interface JudgeStep {
  id: 'input' | 'configuration' | 'analysis' | 'evidence' | 'approval' | 'report';
  label: string;
  status: JudgeStepStatus;
  to: string;
}

function currentStepIndex(status: RunDetail['status']): number {
  if (status === 'DRAFT' || status === 'AWAITING_CONFIGURATION_APPROVAL') return 1;
  if (
    status === 'QUEUED' ||
    status === 'RUNNING' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  ) {
    return 2;
  }
  if (status === 'AWAITING_SHORTLIST_APPROVAL') return 4;
  return 5;
}

export function deriveJudgeSteps(project: ProjectDetail, run: RunDetail): JudgeStep[] {
  const projectId = project.project.id;
  const current = currentStepIndex(run.status);
  const definitions: Array<Pick<JudgeStep, 'id' | 'label' | 'to'>> = [
    { id: 'input', label: 'Input', to: `/projects/${projectId}` },
    { id: 'configuration', label: 'Configure', to: `/projects/${projectId}/settings` },
    { id: 'analysis', label: 'Run', to: `/runs/${run.id}/workflow` },
    { id: 'evidence', label: 'Evidence', to: `/runs/${run.id}/evidence` },
    { id: 'approval', label: 'Approve', to: `/runs/${run.id}/candidates` },
    { id: 'report', label: 'Report', to: `/runs/${run.id}/reports` },
  ];

  return definitions.map((step, index) => ({
    ...step,
    status: index < current ? 'complete' : index === current ? 'current' : 'upcoming',
  }));
}

export function JudgeJourney({ project, run }: { project: ProjectDetail; run: RunDetail }) {
  const steps = deriveJudgeSteps(project, run);
  return (
    <nav
      aria-label="Judge workflow"
      className="rounded-xl border border-primary/20 bg-card px-3 py-3 shadow-sm md:px-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Judge journey</p>
        <p className="text-xs text-muted-foreground">Follow the evidence to the approval gate</p>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              aria-current={step.status === 'current' ? 'step' : undefined}
              className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                step.status === 'current'
                  ? 'border-primary bg-primary/10 font-semibold text-foreground'
                  : step.status === 'complete'
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-foreground hover:bg-emerald-500/10'
                    : 'border-border text-muted-foreground hover:bg-muted'
              }`}
              to={step.to}
            >
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  step.status === 'complete'
                    ? 'bg-emerald-600 text-white'
                    : step.status === 'current'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                }`}
              >
                {step.status === 'complete' ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span>{step.label}</span>
              {step.status === 'current' ? (
                <Circle className="ml-auto size-2 fill-current" />
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
