import { describe, expect, it } from '@jest/globals';
import {
  reconcileDiagnostics,
  resolveScannerPluginResult,
} from '../scannerState';
import type { Diagnostics } from '../types';

const base: Diagnostics = {
  installed: true,
  packageEnabled: true,
  serviceEnabled: true,
  serviceStatusKnown: true,
  enabled: true,
  version: '11.4',
  profileName: 'AppDataWedgeProfile',
  scanAction: 'com.example.SCAN',
  profileExists: true,
  profileConfigured: true,
};

const diag = (over: Partial<Diagnostics> = {}): Diagnostics => ({
  ...base,
  ...over,
});

describe('reconcileDiagnostics', () => {
  it('passes through a fully answered query', () => {
    expect(reconcileDiagnostics(null, diag())).toEqual(diag());
  });

  it('reports a genuine disabled service as disabled', () => {
    const next = reconcileDiagnostics(
      diag(),
      diag({ serviceEnabled: false, enabled: false })
    );
    expect(next.serviceEnabled).toBe(false);
    expect(next.enabled).toBe(false);
  });

  // Bug 2: an unanswered GET_DATAWEDGE_STATUS must not read as "disabled".
  it('keeps the last known-good service state when the query times out', () => {
    const next = reconcileDiagnostics(
      diag({ serviceEnabled: true, enabled: true }),
      diag({ serviceEnabled: false, serviceStatusKnown: false, enabled: false })
    );
    expect(next.serviceEnabled).toBe(true);
    expect(next.enabled).toBe(true);
    expect(next.serviceStatusKnown).toBe(true);
  });

  it('does not resurrect a service previously known to be disabled', () => {
    const next = reconcileDiagnostics(
      diag({ serviceEnabled: false, enabled: false }),
      diag({ serviceEnabled: false, serviceStatusKnown: false, enabled: false })
    );
    expect(next.serviceEnabled).toBe(false);
    expect(next.enabled).toBe(false);
  });

  it('assumes usable on an unanswered first query when the package is installed and enabled', () => {
    const next = reconcileDiagnostics(
      null,
      diag({ serviceEnabled: false, serviceStatusKnown: false, enabled: false })
    );
    expect(next.enabled).toBe(true);
    expect(next.serviceStatusKnown).toBe(false);
  });

  it('never assumes usable when the package itself is absent or disabled', () => {
    const absent = reconcileDiagnostics(
      null,
      diag({
        installed: false,
        packageEnabled: false,
        serviceEnabled: false,
        serviceStatusKnown: false,
        enabled: false,
      })
    );
    expect(absent.enabled).toBe(false);

    const disabled = reconcileDiagnostics(
      null,
      diag({
        packageEnabled: false,
        serviceEnabled: false,
        serviceStatusKnown: false,
        enabled: false,
      })
    );
    expect(disabled.enabled).toBe(false);
  });

  it('takes fresh non-service fields from the incoming query', () => {
    const next = reconcileDiagnostics(
      diag({ profileExists: false, version: '11.3' }),
      diag({ profileExists: true, version: '11.4', serviceStatusKnown: false })
    );
    expect(next.profileExists).toBe(true);
    expect(next.version).toBe('11.4');
  });
});

describe('resolveScannerPluginResult', () => {
  it('reports ready when an enable succeeds', () => {
    expect(resolveScannerPluginResult('SUCCESS', true)).toBe(true);
  });

  it('reports not ready when a disable succeeds', () => {
    expect(resolveScannerPluginResult('SUCCESS', false)).toBe(false);
  });

  it('reports not ready when the plugin genuinely fails', () => {
    expect(resolveScannerPluginResult('FAILURE', true)).toBe(false);
  });

  // Bug 1: DataWedge answers an enable-when-already-enabled with FAILURE.
  it('treats an already-enabled failure as ready', () => {
    expect(resolveScannerPluginResult('ALREADY_ENABLED', true)).toBe(true);
  });

  it('treats an already-disabled failure as not ready', () => {
    expect(resolveScannerPluginResult('ALREADY_DISABLED', false)).toBe(false);
  });
});
