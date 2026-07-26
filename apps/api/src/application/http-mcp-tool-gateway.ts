import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { z } from 'zod';
import { ZodError } from 'zod';

import { DependencyUnavailableError } from './errors.js';
import {
  type McpCallContext,
  type McpToolGateway,
  type McpToolResult,
  McpToolCallError,
  parseMcpToolEnvelope,
} from './mcp-tool-gateway.js';

export class HttpMcpToolGateway implements McpToolGateway {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = 180_000,
  ) {}

  async assertAvailable(requiredTools: readonly string[] = []): Promise<void> {
    await this.withClient(async (client) => {
      const listed = await client.listTools(undefined, { timeout: this.timeoutMs });
      const available = new Set(listed.tools.map(({ name }) => name));
      const missing = requiredTools.filter((name) => !available.has(name));
      if (missing.length > 0) {
        throw new DependencyUnavailableError(`MCP tools: ${missing.join(', ')}`);
      }
    });
  }

  async call<T>(
    toolName: string,
    input: unknown,
    dataSchema: z.ZodType<T>,
    context: McpCallContext,
  ): Promise<McpToolResult<T>> {
    return this.withClient(async (client) => {
      // The SDK uses the discovered execution metadata to automatically augment and
      // poll tools declared with taskSupport: required.
      await client.listTools(undefined, { timeout: this.timeoutMs });
      const result = await client.callTool(
        {
          name: toolName,
          arguments:
            typeof input === 'object' && input !== null
              ? (input as Record<string, unknown>)
              : { value: input },
          _meta: { requestId: context.requestId, runId: context.runId },
        },
        undefined,
        { timeout: this.timeoutMs, resetTimeoutOnProgress: true },
      );
      if ('toolResult' in result)
        return parseMcpToolEnvelope(toolName, result.toolResult, dataSchema);
      if (result.structuredContent !== undefined) {
        return parseMcpToolEnvelope(toolName, result.structuredContent, dataSchema);
      }
      const text = result.content.find((item) => item.type === 'text');
      if (text?.type === 'text') {
        try {
          return parseMcpToolEnvelope(toolName, JSON.parse(text.text), dataSchema);
        } catch (error) {
          if (error instanceof SyntaxError)
            throw new DependencyUnavailableError('MCP tool payload');
          throw error;
        }
      }
      throw new DependencyUnavailableError('MCP structured tool payload');
    });
  }

  private async withClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ name: 'immunograph-api', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint));
    try {
      await client.connect(transport as never, { timeout: this.timeoutMs });
      return await operation(client);
    } catch (error) {
      if (error instanceof DependencyUnavailableError || error instanceof McpToolCallError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw error;
      }
      throw new DependencyUnavailableError('ImmunoGraph MCP server', { cause: error });
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}
