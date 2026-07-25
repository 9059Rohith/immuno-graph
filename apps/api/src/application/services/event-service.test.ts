import { describe, expect, it } from 'vitest';

import { EventNotifier } from '../event-notifier.js';
import { EventService } from './event-service.js';

const baseEvent = {
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

function dependencies(status = 'RUNNING') {
  const events = [baseEvent];
  return {
    records: events,
    repositories: {
      events: {
        appendNext: async (input: Record<string, unknown>) => {
          const record = { ...baseEvent, ...input, sequenceNumber: events.length + 1 };
          events.push(record as typeof baseEvent);
          return record as typeof baseEvent;
        },
        listPage: async (input: { afterSequence: number; limit: number }) => ({
          items: events
            .filter((event) => event.sequenceNumber > input.afterSequence)
            .slice(0, input.limit),
          nextSequence: null,
        }),
      },
      runs: { findById: async () => ({ id: 'run-id', status }) },
    },
  };
}

describe('EventService', () => {
  it('persists through the event repository and publishes only when requested', async () => {
    const { repositories } = dependencies();
    const notifier = new EventNotifier();
    const service = new EventService(repositories as never, notifier);
    const event = await service.append(repositories as never, {
      runId: 'run-id',
      eventType: 'run.status_changed',
      level: 'INFO',
      message: 'Running',
      data: { status: 'RUNNING' },
    });
    expect(event.sequenceNumber).toBe(2);
    service.publish(event);
  });

  it('replays history strictly after the opaque cursor', async () => {
    const { repositories } = dependencies('COMPLETED');
    const service = new EventService(repositories as never, new EventNotifier());
    const history = await service.history({ runId: 'run-id', limit: 10 });
    expect(history.items.map(({ id }) => id)).toEqual(['1']);
  });

  it('stops a waiting stream when the client aborts', async () => {
    const { repositories } = dependencies();
    const service = new EventService(repositories as never, new EventNotifier());
    const controller = new AbortController();
    const stream = service.stream({
      runId: 'run-id',
      lastEventId: '1',
      signal: controller.signal,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const next = iterator.next();
    controller.abort();
    await expect(next).resolves.toEqual({ done: true, value: undefined });
  });

  it('closes after replaying all events for a terminal run', async () => {
    const { repositories } = dependencies('COMPLETED');
    const service = new EventService(repositories as never, new EventNotifier());
    const events = [];
    for await (const event of service.stream({ runId: 'run-id' })) events.push(event);
    expect(events).toHaveLength(1);
  });
});
