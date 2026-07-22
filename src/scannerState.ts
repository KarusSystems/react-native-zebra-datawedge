import type { Diagnostics, ScannerPluginResult, ScannerState } from './types';

/** What the hook is currently trying to do, before availability is considered. */
export type ScannerPhase = 'stopped' | 'enabling' | 'ready';

export function deriveScannerState(input: {
  isChecking: boolean;
  hasHardwareScanner: boolean;
  phase: ScannerPhase;
}): ScannerState {
  if (input.isChecking) return 'checking';
  if (!input.hasHardwareScanner) return 'unavailable';
  return input.phase;
}

/**
 * Merge a fresh diagnostics query with what we already knew.
 *
 * `getDiagnostics` asks DataWedge for its service status over a broadcast
 * round-trip, and that round-trip can time out — most often on the very first
 * query, fired while the DataWedge service is still cold-starting and applying
 * the SET_CONFIG we just sent it. A timeout means "no answer", NOT "disabled",
 * and reporting it as the latter is what makes a working scanner surface a
 * "DataWedge is disabled" banner that the troubleshoot screen then contradicts.
 *
 * So when the service status is unknown we never downgrade: we keep the last
 * answer if we have one, and otherwise fall back to the synchronous
 * PackageManager facts, which are always trustworthy.
 */
export function reconcileDiagnostics(
  previous: Diagnostics | null,
  incoming: Diagnostics
): Diagnostics {
  if (incoming.serviceStatusKnown) return incoming;

  // A previous answer, however stale, beats a guess.
  if (previous?.serviceStatusKnown) {
    return {
      ...incoming,
      serviceEnabled: previous.serviceEnabled,
      serviceStatusKnown: true,
      enabled: incoming.packageEnabled && previous.serviceEnabled,
    };
  }

  // Nothing to fall back on. The package being installed and enabled is
  // verifiable without DataWedge's cooperation, so trust that and let the
  // troubleshoot screen report the unknown rather than blocking the feature.
  return {
    ...incoming,
    enabled: incoming.installed && incoming.packageEnabled,
  };
}

/**
 * Decide whether the scanner ended up enabled, given DataWedge's reply to
 * SCANNER_INPUT_PLUGIN and the state we asked it for.
 *
 * DataWedge answers an ENABLE_PLUGIN that was already enabled with FAILURE
 * (cause ALREADY_ENABLED). That is the scanner being ready, not an error.
 */
export function resolveScannerPluginResult(
  result: ScannerPluginResult,
  requestedEnabled: boolean
): boolean {
  switch (result) {
    case 'SUCCESS':
      return requestedEnabled;
    case 'ALREADY_ENABLED':
      return true;
    case 'ALREADY_DISABLED':
      return false;
    default:
      return false;
  }
}
