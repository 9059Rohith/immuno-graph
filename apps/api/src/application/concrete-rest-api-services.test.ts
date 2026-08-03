import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import type { ApiOperation } from '../services.js';
import {
  ConcreteRestApiServices,
  type FocusedApplicationServices,
} from './concrete-rest-api-services.js';

const operations: ReadonlyArray<[ApiOperation, keyof FocusedApplicationServices, string]> = [
  ['demo.start', 'demo', 'start'],
  ['projects.create', 'projects', 'create'],
  ['projects.list', 'projects', 'list'],
  ['projects.get', 'projects', 'get'],
  ['projects.delete', 'projects', 'delete'],
  ['runs.create', 'runs', 'create'],
  ['runs.get', 'runs', 'get'],
  ['runs.approveConfiguration', 'runs', 'approveConfiguration'],
  ['runs.start', 'runs', 'start'],
  ['runs.cancel', 'runs', 'cancel'],
  ['runs.retryStage', 'runs', 'retryStage'],
  ['events.history', 'events', 'history'],
  ['candidates.list', 'candidates', 'list'],
  ['candidates.get', 'candidates', 'get'],
  ['candidates.compare', 'candidates', 'compare'],
  ['coverage.get', 'candidates', 'coverage'],
  ['coverage.getShortlistOptimization', 'candidates', 'shortlistOptimization'],
  ['runs.approveShortlist', 'runs', 'approveShortlist'],
  ['graphs.evidence', 'evidence', 'evidence'],
  ['graphs.workflow', 'evidence', 'workflow'],
  ['visualizations.get', 'evidence', 'visualization'],
  ['connectors.list', 'diagnostics', 'connectors'],
  ['connectors.health', 'diagnostics', 'connectorHealth'],
  ['explanations.generate', 'reports', 'explanation'],
  ['reports.create', 'reports', 'createReport'],
  ['artifacts.list', 'reports', 'listArtifacts'],
  ['settings.profiles', 'diagnostics', 'profiles'],
  ['settings.runtime', 'diagnostics', 'runtime'],
];

function fixture() {
  const calls = new Map<string, ReturnType<typeof vi.fn>>();
  const group = (name: string, methods: readonly string[]) =>
    Object.fromEntries(
      methods.map((method) => {
        const spy = vi.fn().mockResolvedValue(`${name}.${method}`);
        calls.set(`${name}.${method}`, spy);
        return [method, spy];
      }),
    );
  const services = {
    demo: group('demo', ['start']),
    projects: group('projects', ['create', 'list', 'get', 'delete']),
    runs: group('runs', [
      'create',
      'get',
      'approveConfiguration',
      'start',
      'cancel',
      'retryStage',
      'approveShortlist',
    ]),
    events: {
      ...group('events', ['history']),
      stream: vi.fn(() =>
        (async function* () {
          yield { id: '1', event: 'run.warning', data: {} };
        })(),
      ),
    },
    candidates: group('candidates', [
      'list',
      'get',
      'compare',
      'coverage',
      'shortlistOptimization',
    ]),
    evidence: group('evidence', ['evidence', 'workflow', 'visualization']),
    reports: {
      ...group('reports', ['explanation', 'createReport', 'listArtifacts']),
      downloadArtifact: vi.fn().mockResolvedValue({
        stream: Readable.from('artifact'),
        filename: 'report.json',
        mediaType: 'application/json',
      }),
    },
    diagnostics: group('diagnostics', ['connectors', 'connectorHealth', 'profiles', 'runtime']),
  } as unknown as FocusedApplicationServices;
  return { dispatcher: new ConcreteRestApiServices(services), services, calls };
}

describe('ConcreteRestApiServices', () => {
  it.each(operations)('dispatches %s exactly once', async (operation, groupName, method) => {
    const { dispatcher, calls } = fixture();
    const input = { projectId: 'project', runId: 'run', artifactId: 'artifact' };
    const context = { requestId: 'request' };

    await expect(dispatcher.execute(operation, input, context)).resolves.toBe(
      `${String(groupName)}.${method}`,
    );

    expect(calls.get(`${String(groupName)}.${method}`)).toHaveBeenCalledTimes(1);
    expect([...calls.values()].reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(1);
  });

  it('delegates event streaming only to EventService', async () => {
    const { dispatcher, services, calls } = fixture();
    const input = { runId: 'run', lastEventId: '4' };

    const events = [];
    for await (const event of dispatcher.streamRunEvents(input)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(services.events.stream).toHaveBeenCalledWith(input);
    expect([...calls.values()].reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(0);
  });

  it('delegates artifact download only to ReportService', async () => {
    const { dispatcher, services, calls } = fixture();

    await dispatcher.downloadArtifact({ artifactId: 'artifact' });

    expect(services.reports.downloadArtifact).toHaveBeenCalledWith('artifact');
    expect([...calls.values()].reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(0);
  });
});
