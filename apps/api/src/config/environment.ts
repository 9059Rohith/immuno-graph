import 'dotenv/config';
import { z } from 'zod';

const corsOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  }, 'CORS origins must be exact http(s) origins without paths');

const apiEnvironmentSchema = z.object({
  API_HOST: z.string().default('127.0.0.1'),
  API_LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APPLICATION_VERSION: z.string().min(1).default('0.1.0'),
  ARTIFACT_ROOT: z.string().min(1).default('./artifacts'),
  BUILT_AT: z.string().datetime({ offset: true }).optional(),
  COMMIT_SHA: z.string().min(1).optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(corsOriginSchema).min(1)),
  DATABASE_URL: z.string().min(1).default('file:./immunograph.db'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('true'),
  LLM_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
  MCP_SERVER_URL: z.string().url().default('http://127.0.0.1:3001/mcp'),
  MCP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SPECIFICATION_VERSION: z.string().min(1).default('0.8.0'),
});

export type ParsedApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
export type ApiEnvironment = Omit<
  ParsedApiEnvironment,
  'MCP_SERVER_URL' | 'MCP_REQUEST_TIMEOUT_MS'
> &
  Partial<Pick<ParsedApiEnvironment, 'MCP_SERVER_URL' | 'MCP_REQUEST_TIMEOUT_MS'>>;

export function parseApiEnvironment(input: NodeJS.ProcessEnv): ParsedApiEnvironment {
  return apiEnvironmentSchema.parse(input);
}

export function loadApiEnvironment(): ParsedApiEnvironment {
  return parseApiEnvironment(process.env);
}
