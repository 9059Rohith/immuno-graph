import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const isoInstantSchema = z.string().datetime({ offset: true });
export const sourceStatusSchema = z.enum(['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED']);
export const requestedExecutionModeSchema = z.enum(['AUTO', 'LIVE', 'SYNTHETIC', 'FIXTURE']);
export const executionModeSchema = z.enum(['LIVE', 'SYNTHETIC', 'FIXTURE', 'HYBRID']);
export const runStatusSchema = z.enum([
  'DRAFT',
  'AWAITING_CONFIGURATION_APPROVAL',
  'QUEUED',
  'RUNNING',
  'AWAITING_SHORTLIST_APPROVAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export const runQualitySchema = z.enum(['COMPLETE', 'PARTIAL', 'FIXTURE_ONLY']);
export const trackSchema = z.enum(['MHCI', 'MHCII', 'BCELL']);
export const categorySchema = z.enum(['RECOMMENDED', 'REVIEW', 'REJECTED']);
export const healthSchema = z.enum(['AVAILABLE', 'DEGRADED', 'UNAVAILABLE']);

export const apiErrorEnvelopeSchema = z
  .object({
    requestId: uuidSchema,
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean(),
        fieldErrors: z.record(z.array(z.string())).optional(),
      })
      .strict(),
  })
  .strict();

export const envelopeSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ requestId: uuidSchema, data }).strict();

export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type RequestedExecutionMode = z.infer<typeof requestedExecutionModeSchema>;
export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunQuality = z.infer<typeof runQualitySchema>;
export type Track = z.infer<typeof trackSchema>;
export type CandidateCategory = z.infer<typeof categorySchema>;
