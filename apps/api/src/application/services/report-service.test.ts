import { describe, expect, it } from 'vitest';

import { UnavailableReportGenerationPort } from '../ports.js';
import { ReportService } from './report-service.js';

const runId = '00000000-0000-4000-8000-000000000001';

describe('ReportService', () => {
  it('requires shortlist approval before invoking report generation', async () => {
    const repositories = {
      runs: { findById: async () => ({ id: runId }) },
      approvals: { findLatest: async () => null },
    };
    const service = new ReportService(
      repositories as never,
      new UnavailableReportGenerationPort(),
      { open: async () => null } as never,
    );
    await expect(
      service.createReport(
        {
          runId,
          formats: ['JSON'],
          templateVersion: 'v1',
          includeWorkflowTrace: false,
          includeEvidenceGraph: false,
        },
        { requestId: 'request-id' },
      ),
    ).rejects.toMatchObject({ code: 'REPORT_REQUIRES_APPROVAL', statusCode: 422 });
  });

  it('lists only safe artifact metadata', async () => {
    const repositories = {
      runs: { findById: async () => ({ id: runId }) },
      artifacts: { listByRun: async () => [] },
    };
    const service = new ReportService(
      repositories as never,
      new UnavailableReportGenerationPort(),
      { open: async () => null } as never,
    );
    await expect(service.listArtifacts(runId)).resolves.toEqual({ items: [] });
  });
});
