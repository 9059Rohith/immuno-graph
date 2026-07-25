import { basename } from 'node:path';

import { artifactListSchema, reportJobSchema } from '@immunograph/shared';

interface ArtifactRecord {
  id: string;
  runId: string;
  type: string;
  format: string;
  relativePath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  templateVersion: string | null;
  createdAt: Date;
}

export function mapArtifactList(records: readonly ArtifactRecord[]) {
  return artifactListSchema.parse({
    items: records.map((record) => ({
      id: record.id,
      type: record.type,
      filename: basename(record.relativePath),
      mediaType: record.mimeType,
      sizeBytes: record.byteSize,
      sha256: record.sha256,
      createdAt: record.createdAt.toISOString(),
    })),
  });
}

export function mapReportJob(value: unknown) {
  return reportJobSchema.parse(value);
}
