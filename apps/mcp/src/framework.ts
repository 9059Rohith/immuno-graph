import { randomUUID } from 'node:crypto';

/* eslint-disable @typescript-eslint/no-explicit-any -- MCP SDK's Express/Zod v3-v4 compatibility types exceed this repository's TypeScript instantiation limit at the transport adapter boundary. */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { z } from 'zod';

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface Logger {
  debug(message: string, meta?: Record<string, JsonValue>): void;
  info(message: string, meta?: Record<string, JsonValue>): void;
  warn(message: string, meta?: Record<string, JsonValue>): void;
  error(message: string, meta?: Record<string, JsonValue>): void;
}
export interface ExecutionContext {
  requestId: string;
  metadata?: Record<string, JsonValue>;
  logger: Logger;
  task?: { throwIfCancelled(): void; updateProgress(message: string): void };
}
export interface ToolOptions {
  name: string;
  description?: string;
  inputSchema: z.ZodTypeAny;
  annotations?: { readOnlyHint?: boolean; idempotentHint?: boolean };
  [key: string]: unknown;
}

const toolMetadata = new WeakMap<object, Map<string | symbol, ToolOptions>>();
export const ControllerDecorator = (): ClassDecorator => () => undefined;
export const Module = (options: unknown): ClassDecorator => {
  void options;
  return () => undefined;
};
export const McpApp = (options: unknown): ClassDecorator => {
  void options;
  return () => undefined;
};
export const ToolDecorator =
  (options: ToolOptions): MethodDecorator =>
  (target, key) => {
    const entries = toolMetadata.get(target) ?? new Map<string | symbol, ToolOptions>();
    entries.set(key, options);
    toolMetadata.set(target, entries);
  };
export const Tool = ToolDecorator;

const logger: Logger = {
  debug: (message, meta) => console.debug(JSON.stringify({ level: 'debug', message, ...meta })),
  info: (message, meta) => console.info(JSON.stringify({ level: 'info', message, ...meta })),
  warn: (message, meta) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })),
  error: (message, meta) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
};

export function buildTools(controller: object) {
  const entries = toolMetadata.get(Object.getPrototypeOf(controller)) ?? new Map();
  return [...entries].map(([key, options]) => {
    const execute = (input: unknown, context: ExecutionContext) => {
      const handler = (
        controller as Record<
          string | symbol,
          ((value: unknown, ctx: ExecutionContext) => unknown) | undefined
        >
      )[key];
      if (handler === undefined) throw new Error(`Missing handler for ${options.name}`);
      return handler.call(controller, input, context);
    };
    return {
      ...options,
      options,
      execute,
      invoke: execute,
      toMcpTool: async () => ({
        name: options.name,
        description: options.description,
        inputSchema: { type: 'object' },
        outputSchema: undefined,
      }),
    };
  });
}

export async function startMcpHttpServer(
  controllers: readonly object[],
  host: string,
  port: number,
): Promise<void> {
  const app: any = createMcpExpressApp({ host });
  app.post('/mcp', async (request: any, response: any) => {
    const server = new McpServer({ name: 'immunograph-mcp', version: '0.1.0' });
    for (const controller of controllers) {
      for (const tool of buildTools(controller)) {
        const config: any = { inputSchema: tool.options.inputSchema };
        if (tool.options.description !== undefined) config.description = tool.options.description;
        if (tool.options.annotations !== undefined) config.annotations = tool.options.annotations;
        (server.registerTool as any)(tool.options.name, config, async (input: unknown) => {
          const result = await tool.invoke(input, { requestId: randomUUID(), logger });
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            structuredContent: result as Record<string, unknown>,
          };
        });
      }
    }
    const transport = new StreamableHTTPServerTransport();
    try {
      await server.connect(transport as any);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      logger.error('mcp.request.failure', { error: String(error) });
      if (!response.headersSent)
        response.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
    } finally {
      await transport.close();
      await server.close();
    }
  });
  app.get('/health', (_request: any, response: any) =>
    response.json({ status: 'ok', service: 'immunograph-mcp' }),
  );
  await new Promise<void>((resolve, reject) => {
    const listener = app.listen(port, host, resolve);
    listener.on('error', reject);
  });
  logger.info('mcp.server.started', { host, port });
}
