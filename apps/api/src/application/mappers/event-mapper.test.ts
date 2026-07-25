import { describe, expect, it } from 'vitest';

import { mapEventHistory, mapWorkflowEvent } from './event-mapper.js';

const record = {
  id: 'event-id',
  runId: 'run-id',
  stageId: null,
  sequenceNumber: 1,
  eventType: 'run.status_changed',
  level: 'INFO',
  message: 'Queued',
  payloadJson: '{"status":"QUEUED"}',
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
};

describe('event mapper', () => {
  it('uses decimal sequence IDs and parsed stored payloads', () => {
    expect(mapWorkflowEvent(record)).toEqual({
      id: '1',
      event: 'run.status_changed',
      data: { status: 'QUEUED' },
    });
    expect(mapEventHistory([record], null)).toEqual({
      items: [{ id: '1', event: 'run.status_changed', data: { status: 'QUEUED' } }],
      nextCursor: null,
    });
  });
});
