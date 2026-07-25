import { loadReferenceBundle } from '@immunograph/database';

import type { ConnectorDiagnosticsPort } from './ports.js';

/** Read connector flags dynamically so diagnostics reflect the current runtime environment. */
function envFlag(name: string): boolean {
  return (process.env[name] ?? 'false').toLowerCase().trim() === 'true';
}

function envConfigured(name: string): boolean {
  return (process.env[name] ?? '').trim().length > 0;
}

function iedbPopulationCoverageLive(): boolean {
  return (
    envFlag('IEDB_POPULATION_COVERAGE_ENABLED') &&
    (envConfigured('IEDB_POPULATION_COVERAGE_URL') ||
      envConfigured('IEDB_POPULATION_COVERAGE_SCRIPT_PATH'))
  );
}

function liveActiveForConnector(connectorId: string): boolean {
  if (connectorId === 'mhcflurry') return envFlag('MHCFLURRY_ENABLED');
  if (connectorId === 'iedb-population-coverage') return iedbPopulationCoverageLive();
  return envFlag('IEDB_LIVE_ENABLED');
}

function liveMessage(connectorId: string): string {
  if (connectorId === 'mhcflurry') {
    return 'Local MHCflurry connector is enabled for MHC-I predictions; scientificUse=true.';
  }
  if (connectorId === 'iedb-population-coverage') {
    return 'IEDB population coverage is enabled through a configured live endpoint or standalone tool; scientificUse=true.';
  }
  return 'Live IEDB connector is enabled; real predictions are available for research use.';
}

function degradedMessage(connectorId: string): string {
  if (connectorId === 'mhcflurry') {
    return 'MHCFLURRY_ENABLED=false - local MHCflurry predictions are disabled. Install MHCflurry/models and set MHCFLURRY_ENABLED=true to enable MHC-I local prediction.';
  }
  if (connectorId === 'iedb-population-coverage') {
    return 'IEDB population coverage live mode is disabled or missing IEDB_POPULATION_COVERAGE_URL / IEDB_POPULATION_COVERAGE_SCRIPT_PATH; fixture fallback remains available.';
  }
  return 'IEDB_LIVE_ENABLED=false - running in offline/backup mode with fixture fallback. Set IEDB_LIVE_ENABLED=true to enable live predictions.';
}

export class LocalConnectorDiagnosticsPort implements ConnectorDiagnosticsPort {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async list() {
    const { connectorRegistry } = await loadReferenceBundle();
    return connectorRegistry.connectors.map((connector) => {
      const liveSupported = !connector.fixtureOnly && !connector.syntheticOnly;
      const liveActive = liveSupported && liveActiveForConnector(connector.connectorId);
      return {
        connectorId: connector.connectorId,
        displayName: connector.displayName,
        methods: connector.methods.map(({ method }) => method),
        liveSupported,
        fixtureOnly: connector.fixtureOnly,
        licenseStatus:
          connector.fixtureOnly ||
          connector.syntheticOnly ||
          connector.connectorId === 'mhcflurry' ||
          liveActive
            ? ('APPROVED' as const)
            : ('RESTRICTED' as const),
      };
    });
  }

  async health() {
    const { connectorRegistry } = await loadReferenceBundle();
    const checkedAt = this.clock().toISOString();
    return connectorRegistry.connectors.map((connector) => {
      const isLiveConnector = !connector.fixtureOnly && !connector.syntheticOnly;
      const liveActive = isLiveConnector && liveActiveForConnector(connector.connectorId);
      return {
        connectorId: connector.connectorId,
        health: liveActive
          ? ('AVAILABLE' as const)
          : connector.fixtureOnly || connector.syntheticOnly
            ? ('AVAILABLE' as const)
            : ('DEGRADED' as const),
        sourceStatus: connector.syntheticOnly
          ? ('SYNTHETIC' as const)
          : liveActive
            ? ('LIVE' as const)
            : ('FIXTURE' as const),
        checkedAt,
        message: connector.syntheticOnly
          ? 'Deterministic offline demonstration connector is available; scientificUse=false.'
          : liveActive
            ? liveMessage(connector.connectorId)
            : connector.fixtureOnly
              ? 'Approved local synthetic fixture is available.'
              : degradedMessage(connector.connectorId),
      };
    });
  }
}
