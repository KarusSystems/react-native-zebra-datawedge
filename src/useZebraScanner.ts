import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addBarcodeListener,
  addScannerPluginResultListener,
  configureProfile,
  getDiagnostics,
  setScannerEnabled,
} from './NativeZebraDataWedge';
import {
  deriveScannerState,
  reconcileDiagnostics,
  resolveScannerPluginResult,
  type ScannerPhase,
} from './scannerState';
import type { BarcodeEvent, Diagnostics, ScannerState } from './types';

/**
 * How long to wait for DataWedge to confirm an enable before assuming it
 * worked. The native module now resolves readiness from SCANNER_INPUT_PLUGIN's
 * own RESULT_ACTION, which always arrives — this is a last-resort guard so a
 * lost broadcast can never strand the UI on a spinner forever.
 */
const READY_TIMEOUT_MS = 3000;

export type UseZebraScannerOptions = {
  onBarcode?: (event: BarcodeEvent) => void;
  autoConfigure?: boolean;
  /**
   * Enable the scanner as soon as one is available. On by default: barcodes are
   * delivered from mount regardless, so leaving the reported state at "stopped"
   * until someone calls startReading would describe the scanner inaccurately.
   */
  autoStart?: boolean;
};

export type UseZebraScannerResult = {
  hasHardwareScanner: boolean;
  isChecking: boolean;
  isScannerReady: boolean;
  scannerState: ScannerState;
  diagnostics: Diagnostics | null;
  startReading: () => void;
  stopReading: () => void;
  reconfigure: () => Promise<void>;
  refreshDiagnostics: () => Promise<Diagnostics | null>;
};

export function useZebraScanner(
  options: UseZebraScannerOptions = {}
): UseZebraScannerResult {
  const { onBarcode, autoConfigure = true, autoStart = true } = options;
  const callbackRef = useRef(onBarcode);
  callbackRef.current = onBarcode;

  const enabledRef = useRef(true);
  // Tracks whether the last setScannerEnabled call was an enable (true) or disable.
  const intendedEnabledRef = useRef(false);
  const diagnosticsRef = useRef<Diagnostics | null>(null);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [phase, setPhase] = useState<ScannerPhase>('stopped');

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current !== null) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const runDiagnostics = useCallback(async () => {
    try {
      const d = reconcileDiagnostics(
        diagnosticsRef.current,
        await getDiagnostics()
      );
      diagnosticsRef.current = d;
      setDiagnostics(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  const reconfigure = useCallback(async () => {
    try {
      await configureProfile();
    } catch {
      // swallow — diagnostics will reflect failure state
    }
    await runDiagnostics();
  }, [runDiagnostics]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsChecking(true);
      if (autoConfigure) {
        try {
          await configureProfile();
        } catch {}
      }
      if (cancelled) return;
      const first = await runDiagnostics();
      if (!cancelled) setIsChecking(false);

      // The first query races DataWedge's cold start, so an unanswered status
      // is expected rather than exceptional. Ask again once it has settled.
      if (!cancelled && first && !first.serviceStatusKnown) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
        if (!cancelled) await runDiagnostics();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoConfigure, runDiagnostics]);

  useEffect(() => {
    const sub = addBarcodeListener((event) => {
      if (!enabledRef.current) return;
      callbackRef.current?.(event);
    });
    return () => sub.remove();
  }, []);

  // Listen for DataWedge's confirmation that ENABLE_PLUGIN / DISABLE_PLUGIN completed.
  useEffect(() => {
    const sub = addScannerPluginResultListener((event) => {
      // Ignore a reply to a request we have since superseded.
      if (event.requestedEnabled !== intendedEnabledRef.current) return;
      clearReadyTimeout();
      const ready = resolveScannerPluginResult(
        event.result,
        event.requestedEnabled
      );
      setPhase(ready ? 'ready' : 'stopped');
    });
    return () => sub.remove();
  }, [clearReadyTimeout]);

  useEffect(() => clearReadyTimeout, [clearReadyTimeout]);

  const startReading = useCallback(() => {
    enabledRef.current = true;
    intendedEnabledRef.current = true;
    setPhase('enabling');
    clearReadyTimeout();
    // Assume the enable landed if DataWedge never replies. A wrong optimistic
    // "ready" costs the user one trigger press; a stuck spinner costs them the
    // whole screen.
    readyTimeoutRef.current = setTimeout(() => {
      readyTimeoutRef.current = null;
      if (intendedEnabledRef.current) setPhase('ready');
    }, READY_TIMEOUT_MS);
    setScannerEnabled(true).catch(() => {});
  }, [clearReadyTimeout]);

  const stopReading = useCallback(() => {
    enabledRef.current = false;
    intendedEnabledRef.current = false;
    clearReadyTimeout();
    setPhase('stopped');
    setScannerEnabled(false).catch(() => {});
  }, [clearReadyTimeout]);

  const hasHardwareScanner =
    !!diagnostics && diagnostics.installed && diagnostics.enabled;

  // Barcodes are delivered from mount, so start for real rather than leaving
  // the state claiming "stopped" while scans are landing.
  useEffect(() => {
    if (autoStart && hasHardwareScanner && phase === 'stopped') {
      startReading();
    }
    // Deliberately not depending on `phase`: a later stopReading() must stick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, hasHardwareScanner, startReading]);

  return {
    hasHardwareScanner,
    isChecking,
    isScannerReady: phase === 'ready',
    scannerState: deriveScannerState({ isChecking, hasHardwareScanner, phase }),
    diagnostics,
    startReading,
    stopReading,
    reconfigure,
    refreshDiagnostics: runDiagnostics,
  };
}
