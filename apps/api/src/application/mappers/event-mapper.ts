import type { WorkflowEvent } from '@prisma/client';

import type { WorkflowSseEvent } from '../../services.js';
import { encodeEventCursor } from '../cursor.js';
import { eventHistorySchema, type EventHistory } from '../response-schemas.js';

const eventTypes = new Set<WorkflowSseEvent['event']>([
  'run.status_changed',
  'stage.status_changed',
  'stage.progress',
  'connector.status_changed',
  'approval.required',
  'candidate.summary_ready',
  'artifact.created',
  'run.warning',
]);

export function mapWorkflowEvent(record: WorkflowEvent): WorkflowSseEvent {
  if (!eventTypes.has(record.eventType as WorkflowSseEvent['event'])) {
    throw new Error(`Unsupported workflow event type: ${record.eventType}`);
  }
  const data: unknown = JSON.parse(record.payloadJson);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Workflow event payload must be an object');
  }
  return {
    id: String(record.sequenceNumber),
    event: record.eventType as WorkflowSseEvent['event'],
    data: data as Record<string, unknown>,
  };
}

export function mapEventHistory(
  records: readonly WorkflowEvent[],
  nextSequence: number | null,
): EventHistory {
  return eventHistorySchema.parse({
    items: records.map(mapWorkflowEvent),
    nextCursor: nextSequence === null ? null : encodeEventCursor(nextSequence),
  });
}
