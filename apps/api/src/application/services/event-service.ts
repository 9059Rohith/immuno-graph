import type { Repositories, WorkflowEventCreate } from '@immunograph/database';
import type { WorkflowEvent } from '@prisma/client';

import type { WorkflowSseEvent } from '../../services.js';
import { decodeEventCursor } from '../cursor.js';
import { ApplicationError, resourceNotFound } from '../errors.js';
import { EventNotifier } from '../event-notifier.js';
import { mapEventHistory, mapWorkflowEvent } from '../mappers/event-mapper.js';

export interface AppendEventInput {
  runId: string;
  stageId?: string;
  eventType: WorkflowSseEvent['event'];
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data: Record<string, unknown>;
}

type EventRepositories = Pick<Repositories, 'events' | 'runs'>;
type EventWriteRepositories = Pick<Repositories, 'events'>;
const terminalStatuses = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export class EventService {
  constructor(
    private readonly repositories: EventRepositories,
    private readonly notifier: EventNotifier,
  ) {}

  append(repositories: EventWriteRepositories, input: AppendEventInput): Promise<WorkflowEvent> {
    const record: Omit<WorkflowEventCreate, 'sequenceNumber'> = {
      runId: input.runId,
      ...(input.stageId === undefined ? {} : { stageId: input.stageId }),
      eventType: input.eventType,
      level: input.level,
      message: input.message,
      payloadJson: JSON.stringify(input.data),
    };
    return repositories.events.appendNext(record);
  }

  publish(event: WorkflowEvent): void {
    this.notifier.publish(event.runId, event.sequenceNumber);
  }

  async history(input: { runId: string; limit: number; cursor?: string }) {
    if ((await this.repositories.runs.findById(input.runId)) === null)
      throw resourceNotFound('run');
    const afterSequence = input.cursor === undefined ? 0 : decodeEventCursor(input.cursor);
    const page = await this.repositories.events.listPage({
      runId: input.runId,
      afterSequence,
      limit: input.limit,
    });
    return mapEventHistory(page.items, page.nextSequence);
  }

  async *stream(input: {
    runId: string;
    lastEventId?: string;
    signal?: AbortSignal;
  }): AsyncIterable<WorkflowSseEvent> {
    let afterSequence = parseLastEventId(input.lastEventId);
    while (input.signal?.aborted !== true) {
      const page = await this.repositories.events.listPage({
        runId: input.runId,
        afterSequence,
        limit: 500,
      });
      for (const record of page.items) {
        afterSequence = record.sequenceNumber;
        yield mapWorkflowEvent(record);
      }
      const run = await this.repositories.runs.findById(input.runId);
      if (run === null) throw resourceNotFound('run');
      if (terminalStatuses.has(run.status) && page.nextSequence === null) return;
      await this.notifier.wait(input.runId, afterSequence, input.signal);
    }
  }
}

function parseLastEventId(value: string | undefined): number {
  if (value === undefined) return 0;
  if (!/^\d+$/.test(value)) {
    throw new ApplicationError(
      'INVALID_LAST_EVENT_ID',
      400,
      'Last-Event-ID must be a decimal sequence.',
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ApplicationError(
      'INVALID_LAST_EVENT_ID',
      400,
      'Last-Event-ID must be a decimal sequence.',
    );
  }
  return parsed;
}
