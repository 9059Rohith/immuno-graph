import type { z } from 'zod';

import {
  connectorHealthListSchema,
  connectorListSchema,
  outputPreferencesSchema,
} from '@immunograph/shared';

import { DependencyUnavailableError } from './errors.js';

export interface WorkflowExecutionPort {
  assertAvailable(): Promise<void>;
  start(command: { runId: string; requestId: string }): Promise<void>;
  cancel(command: { runId: string; requestId: string }): Promise<void>;
  retry(command: {
    runId: string;
    stageKey: string;
    attempt: number;
    requestId: string;
  }): Promise<void>;
}

export interface ReportGenerationCommand {
  runId: string;
  requestId: string;
  options: z.infer<typeof outputPreferencesSchema>;
}

export interface ReportGenerationPort {
  assertAvailable(): Promise<void>;
  generate(command: ReportGenerationCommand): Promise<{ artifactJobId: string; status: 'QUEUED' }>;
}

export interface ConnectorDiagnosticsPort {
  list(): Promise<z.infer<typeof connectorListSchema>['items']>;
  health(): Promise<z.infer<typeof connectorHealthListSchema>['items']>;
}

export class UnavailableWorkflowExecutionPort implements WorkflowExecutionPort {
  private unavailable(): never {
    throw new DependencyUnavailableError('workflow execution');
  }
  assertAvailable(): Promise<void> {
    return Promise.reject(new DependencyUnavailableError('workflow execution'));
  }
  start(): Promise<void> {
    return Promise.reject(this.unavailable());
  }
  cancel(): Promise<void> {
    return Promise.reject(this.unavailable());
  }
  retry(): Promise<void> {
    return Promise.reject(this.unavailable());
  }
}

export class UnavailableReportGenerationPort implements ReportGenerationPort {
  private unavailable(): never {
    throw new DependencyUnavailableError('report generation');
  }
  assertAvailable(): Promise<void> {
    return Promise.reject(new DependencyUnavailableError('report generation'));
  }
  generate(): Promise<{ artifactJobId: string; status: 'QUEUED' }> {
    return Promise.reject(this.unavailable());
  }
}

export class EmptyConnectorDiagnosticsPort implements ConnectorDiagnosticsPort {
  list(): Promise<[]> {
    return Promise.resolve([]);
  }
  health(): Promise<[]> {
    return Promise.resolve([]);
  }
}
