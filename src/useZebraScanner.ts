import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addBarcodeListener,
  addScannerPluginResultListener,
  configureProfile,
  getDiagnostics,
  setScannerEnabled,
} from './NativeZebraDataWedge';
import type { BarcodeEvent, Diagnostics } from './types';

export type UseZebraScannerOptions = {
  onBarcode?: (event: BarcodeEvent) => void;
  autoConfigure?: boolean;
};

export type UseZebraScannerResult = {
  hasHardwareScanner: boolean;
  isChecking: boolean;
  isScannerReady: boolean;
  diagnostics: Diagnostics | null;
  startReading: () => void;
  stopReading: () => void;
  reconfigure: () => Promise<void>;
  refreshDiagnostics: () => Promise<Diagnostics | null>;
};

export function useZebraScanner(
  options: UseZebraScannerOptions = {}
): UseZebraScannerResult {
  const { onBarcode, autoConfigure = true } = options;
  const callbackRef = useRef(onBarcode);
  callbackRef.current = onBarcode;

  const enabledRef = useRef(true);
  // Tracks whether the last setScannerEnabled call was an enable (true) or disable.
  const intendedEnabledRef = useRef(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isScannerReady, setIsScannerReady] = useState(false);

  const runDiagnostics = useCallback(async () => {
    try {
      const d = await getDiagnostics();
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
      await runDiagnostics();
      if (!cancelled) setIsChecking(false);
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
      if (event.result === 'SUCCESS') {
        setIsScannerReady(intendedEnabledRef.current);
      }
    });
    return () => sub.remove();
  }, []);

  const startReading = useCallback(() => {
    enabledRef.current = true;
    intendedEnabledRef.current = true;
    setIsScannerReady(false);
    console.log('[zdw] startReading → setScannerEnabled(true)');
    setScannerEnabled(true)
      .then((r) => console.log('[zdw] setScannerEnabled(true) →', r))
      .catch((e) => console.log('[zdw] setScannerEnabled(true) err', e));
  }, []);

  const stopReading = useCallback(() => {
    enabledRef.current = false;
    intendedEnabledRef.current = false;
    setIsScannerReady(false);
    console.log('[zdw] stopReading → setScannerEnabled(false)');
    setScannerEnabled(false)
      .then((r) => console.log('[zdw] setScannerEnabled(false) →', r))
      .catch((e) => console.log('[zdw] setScannerEnabled(false) err', e));
  }, []);

  return {
    hasHardwareScanner:
      !!diagnostics && diagnostics.installed && diagnostics.enabled,
    isChecking,
    isScannerReady,
    diagnostics,
    startReading,
    stopReading,
    reconfigure,
    refreshDiagnostics: runDiagnostics,
  };
}
