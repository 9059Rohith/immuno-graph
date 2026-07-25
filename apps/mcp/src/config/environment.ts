import 'dotenv/config';
import { z } from 'zod';

const mcpEnvironmentSchema = z.object({
  MCP_HOST: z.string().default('127.0.0.1'),
  MCP_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Enable real IEDB live binding predictions. Off by default (safe offline mode). */
  IEDB_LIVE_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  /** Per-request timeout for IEDB HTTP calls (ms). */
  IEDB_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Maximum permitted IEDB response body size (bytes). */
  IEDB_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  /** Override the IEDB MHC-I endpoint (leave unset to use the official URL). */
  IEDB_MHCI_URL: z.string().url().optional(),
  /** Override the IEDB MHC-II endpoint (leave unset to use the official URL). */
  IEDB_MHCII_URL: z.string().url().optional(),
  /** Enable local MHCflurry MHC-I predictions. Off by default unless the CLI/models are installed. */
  MHCFLURRY_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  /** Local MHCflurry command name or absolute path. */
  MHCFLURRY_COMMAND: z.string().min(1).default('mhcflurry'),
  /** Recorded MHCflurry method/model version for provenance. */
  MHCFLURRY_METHOD_VERSION: z.string().min(1).default('2.3.0'),
  /** Per-request timeout for local MHCflurry CLI calls (ms). */
  MHCFLURRY_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  /** Maximum permitted MHCflurry CSV output size (bytes). */
  MHCFLURRY_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
});

export type McpEnvironment = z.infer<typeof mcpEnvironmentSchema>;

export function loadMcpEnvironment(): McpEnvironment {
  return mcpEnvironmentSchema.parse(process.env);
}
