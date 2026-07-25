import { z } from 'zod';

const metaSchema = z
  .object({
    requestId: z.string().min(1),
    runId: z.string().min(1),
    toolName: z.string().min(1),
    toolVersion: z.string().min(1),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    outputHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .passthrough();

const toolErrorSchema = z
  .object({
    code: z.string().min(1),
    category: z.enum([
      'VALIDATION',
      'SCIENTIFIC',
      'CONNECTOR',
      'TIMEOUT',
      'RATE_LIMIT',
      'INTERNAL',
    ]),
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export interface McpCallContext {
  requestId: string;
  runId: string;
}

export interface McpToolResult<T> {
  data: T;
  meta: z.infer<typeof metaSchema>;
}

export class McpToolCallError extends Error {
  constructor(
    readonly toolName: string,
    readonly code: string,
    readonly category: z.infer<typeof toolErrorSchema>['category'],
    message: string,
    readonly retryable: boolean,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'McpToolCallError';
  }
}

export interface McpToolGateway {
  assertAvailable(requiredTools?: readonly string[]): Promise<void>;
  call<T>(
    toolName: string,
    input: unknown,
    dataSchema: z.ZodType<T>,
    context: McpCallContext,
  ): Promise<McpToolResult<T>>;
}

export function parseMcpToolEnvelope<T>(
  toolName: string,
  value: unknown,
  dataSchema: z.ZodType<T>,
): McpToolResult<T> {
  const success = z
    .object({ ok: z.literal(true), data: dataSchema, meta: metaSchema })
    .passthrough()
    .safeParse(value);
  if (success.success) {
    return {
      data: dataSchema.parse(success.data.data),
      meta: metaSchema.parse(success.data.meta),
    };
  }
  const failure = z
    .object({
      ok: z.literal(false),
      error: toolErrorSchema,
      meta: metaSchema.partial().passthrough(),
    })
    .passthrough()
    .parse(value);
  if (!failure.ok) {
    throw new McpToolCallError(
      toolName,
      failure.error.code,
      failure.error.category,
      failure.error.message,
      failure.error.retryable,
      failure.error.details,
    );
  }
  throw new Error('Unreachable MCP envelope state.');
}
