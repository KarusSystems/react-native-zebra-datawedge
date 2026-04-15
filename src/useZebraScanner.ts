import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addBarcodeListener,
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
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [isChecking, setIsChecking] = useState(true);

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

  const startReading = useCallback(() => {
    enabledRef.current = true;
    setScannerEnabled(true).catch(() => {});
  }, []);
  const stopReading = useCallback(() => {
    enabledRef.current = false;
    setScannerEnabled(false).catch(() => {});
  }, []);

  return {
    hasHardwareScanner:
      !!diagnostics && diagnostics.installed && diagnostics.enabled,
    isChecking,
    diagnostics,
    startReading,
    stopReading,
    reconfigure,
    refreshDiagnostics: runDiagnostics,
  };
}
