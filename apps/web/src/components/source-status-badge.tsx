import { Activity, Database, FlaskConical, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export type SourceStatus = 'LIVE' | 'CACHED' | 'SYNTHETIC' | 'FIXTURE' | 'FAILED';

const SOURCE_STATUS_PRESENTATION: Record<
  SourceStatus,
  { label: string; icon: LucideIcon; variant: 'live' | 'cached' | 'fixture' | 'failed' }
> = {
  LIVE: { label: 'Live', icon: Activity, variant: 'live' },
  CACHED: { label: 'Cached live result', icon: Database, variant: 'cached' },
  SYNTHETIC: {
    label: 'Offline synthetic demonstration',
    icon: FlaskConical,
    variant: 'fixture',
  },
  FIXTURE: { label: 'Demo fixture', icon: FlaskConical, variant: 'fixture' },
  FAILED: { label: 'Failed', icon: TriangleAlert, variant: 'failed' },
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const presentation = SOURCE_STATUS_PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <Badge variant={presentation.variant}>
      <Icon aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}
