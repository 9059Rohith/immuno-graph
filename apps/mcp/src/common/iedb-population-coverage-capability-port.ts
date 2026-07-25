import type { CapabilityPort } from './capability-port.js';
import { ToolExecutionError } from './executor.js';

interface PopulationCoverageInput {
  runId: string;
  associations: Array<{ candidateId: string; allele: string }>;
  populationIds: string[];
  classMode: 'CLASS_I' | 'CLASS_II' | 'COMBINED';
  fallbackPolicy: string;
}

export interface IedbPopulationCoverageCapabilityOptions {
  enabled: boolean;
  url?: string;
  request?: typeof fetch;
  timeoutMs?: number;
  maximumResponseBytes?: number;
}

interface ProviderCoverageJson {
  projectedCoverage?: unknown;
  coverage?: unknown;
  averageHits?: unknown;
  average_hits?: unknown;
  pc90?: unknown;
  pc90Coverage?: unknown;
  pc90_coverage?: unknown;
  metrics?: unknown;
}

const CONNECTOR_ID = 'iedb-population-coverage';
const CONNECTOR_VERSION = 'configurable-http-v1';
const METHOD = 'iedb-population-coverage';
const METHOD_VERSION = 'v1';

export class IedbPopulationCoverageCapabilityPort implements CapabilityPort {
  private readonly request: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maximumResponseBytes: number;

  constructor(private readonly options: IedbPopulationCoverageCapabilityOptions) {
    this.request = options.request ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maximumResponseBytes = options.maximumResponseBytes ?? 10 * 1024 * 1024;
  }

  get liveEnabled(): boolean {
    return this.options.enabled && this.options.url !== undefined;
  }

  async invoke(capability: string, input: unknown): Promise<unknown> {
    if (capability !== 'calculate_population_coverage') {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_CAPABILITY_UNSUPPORTED',
        'CONNECTOR',
        `IEDB population coverage does not implement ${capability}.`,
      );
    }
    if (!this.options.enabled) {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_NOT_CONFIGURED',
        'CONNECTOR',
        'The IEDB population coverage connector is disabled.',
        true,
      );
    }
    if (this.options.url === undefined) {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_URL_REQUIRED',
        'CONNECTOR',
        'IEDB population coverage requires an explicit HTTP endpoint URL.',
        true,
      );
    }
    return this.calculate(input as PopulationCoverageInput, this.options.url);
  }

  private async calculate(input: PopulationCoverageInput, endpoint: string) {
    if (input.associations.length === 0 || input.populationIds.length === 0) {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_INPUT_EMPTY',
        'VALIDATION',
        'At least one HLA association and target population is required.',
      );
    }
    const body = {
      runId: input.runId,
      alleles: [...new Set(input.associations.map(({ allele }) => allele))].sort(),
      associations: input.associations,
      populationIds: input.populationIds,
      classMode: input.classMode,
    };
    const responseText = await this.post(endpoint, JSON.stringify(body));
    const parsed = parseProviderJson(responseText);
    return {
      projectedCoverage: parsed.projectedCoverage,
      metrics: {
        averageHits: parsed.averageHits,
        pc90: parsed.pc90,
        providerMetrics: parsed.providerMetrics,
      },
      provenance: {
        connectorId: CONNECTOR_ID,
        connectorVersion: CONNECTOR_VERSION,
        method: METHOD,
        methodVersion: METHOD_VERSION,
        status: 'LIVE' as const,
        sourceUri: endpoint,
        parameters: {
          classMode: input.classMode,
          populationIds: input.populationIds,
          associationCount: input.associations.length,
        },
        predictionSource: 'LIVE' as const,
        scientificUse: true,
        validationStatus: 'SCIENTIFIC' as const,
      },
    };
  }

  private async post(endpoint: string, body: string): Promise<string> {
    let response: Response;
    try {
      response = await this.request(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'ImmunoGraph/0.1 (+https://tools.iedb.org/)',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new ToolExecutionError(
        timedOut
          ? 'IEDB_POPULATION_COVERAGE_TIMEOUT'
          : 'IEDB_POPULATION_COVERAGE_NETWORK_ERROR',
        timedOut ? 'TIMEOUT' : 'CONNECTOR',
        timedOut
          ? 'IEDB population coverage request timed out.'
          : 'IEDB population coverage request failed.',
        true,
      );
    }
    if (response.status === 429) {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_RATE_LIMITED',
        'RATE_LIMIT',
        'IEDB rate-limited the population coverage request.',
        true,
      );
    }
    if (!response.ok) {
      throw new ToolExecutionError(
        'IEDB_POPULATION_COVERAGE_HTTP_ERROR',
        'CONNECTOR',
        `IEDB population coverage request failed with HTTP ${response.status}.`,
        response.status >= 500,
        { statusCode: response.status },
      );
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > this.maximumResponseBytes) responseTooLarge();
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > this.maximumResponseBytes) responseTooLarge();
    return text;
  }
}

function parseProviderJson(text: string): {
  projectedCoverage: number;
  averageHits: number | undefined;
  pc90: number | undefined;
  providerMetrics: unknown;
} {
  let value: ProviderCoverageJson;
  try {
    value = JSON.parse(text) as ProviderCoverageJson;
  } catch {
    invalidResponse();
  }
  const projectedCoverage = unit(value.projectedCoverage ?? value.coverage);
  return {
    projectedCoverage,
    averageHits: optionalNonnegative(value.averageHits ?? value.average_hits),
    pc90: optionalNonnegative(value.pc90 ?? value.pc90Coverage ?? value.pc90_coverage),
    providerMetrics: value.metrics,
  };
}

function unit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) invalidResponse();
  return parsed;
}

function optionalNonnegative(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) invalidResponse();
  return parsed;
}

function responseTooLarge(): never {
  throw new ToolExecutionError(
    'IEDB_POPULATION_COVERAGE_RESPONSE_TOO_LARGE',
    'CONNECTOR',
    'IEDB population coverage response exceeded the configured size limit.',
  );
}

function invalidResponse(): never {
  throw new ToolExecutionError(
    'IEDB_POPULATION_COVERAGE_RESPONSE_INVALID',
    'CONNECTOR',
    'IEDB population coverage returned an invalid response.',
    false,
  );
}
