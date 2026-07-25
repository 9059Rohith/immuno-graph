import { loadReferenceBundle } from '@immunograph/database';

import type { ConnectorDiagnosticsPort } from './ports.js';

/** Read IEDB_LIVE_ENABLED without pulling the full validated env schema here. */
const iedbLiveEnabled = (process.env.IEDB_LIVE_ENABLED ?? 'false').toLowerCase().trim() === 'true';
const mhcflurryEnabled = (process.env.MHCFLURRY_ENABLED ?? 'false').toLowerCase().trim() === 'true';

export class LocalConnectorDiagnosticsPort implements ConnectorDiagnosticsPort {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async list() {
    const { connectorRegistry } = await loadReferenceBundle();
    return connectorRegistry.connectors.map((connector) => ({
      connectorId: connector.connectorId,
      displayName: connector.displayName,
      methods: connector.methods.map(({ method }) => method),
      liveSupported: !connector.fixtureOnly && !connector.syntheticOnly,
      fixtureOnly: connector.fixtureOnly,
      licenseStatus:
        connector.fixtureOnly || connector.syntheticOnly
          ? ('APPROVED' as const)
          : connector.connectorId === 'mhcflurry'
            ? ('APPROVED' as const)
            : iedbLiveEnabled
              ? ('APPROVED' as const)
              : ('RESTRICTED' as const),
    }));
  }

  async health() {
    const { connectorRegistry } = await loadReferenceBundle();
    const checkedAt = this.clock().toISOString();
    return connectorRegistry.connectors.map((connector) => {
      const isLiveConnector = !connector.fixtureOnly && !connector.syntheticOnly;
      const liveActive =
        isLiveConnector &&
        (connector.connectorId === 'mhcflurry' ? mhcflurryEnabled : iedbLiveEnabled);
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
            ? connector.connectorId === 'mhcflurry'
              ? 'Local MHCflurry connector is enabled for MHC-I predictions; scientificUse=true.'
              : 'Live IEDB connector is enabled; real predictions are available for research use.'
            : connector.fixtureOnly
              ? 'Approved local synthetic fixture is available.'
              : connector.connectorId === 'mhcflurry'
                ? 'MHCFLURRY_ENABLED=false — local MHCflurry predictions are disabled. Install MHCflurry/models and set MHCFLURRY_ENABLED=true to enable MHC-I local prediction.'
                : 'IEDB_LIVE_ENABLED=false \u2014 running in offline/backup mode with fixture fallback. Set IEDB_LIVE_ENABLED=true to enable live predictions.',
      };
    });
  }
}
