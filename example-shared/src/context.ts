import { createContext, useContext } from 'react';
import type {
  BarcodeEvent,
  UseZebraScannerResult,
} from '@karus-systems/react-native-zebra-datawedge';
import type { RuntimeMode } from './App';

export type ScannerContextValue = {
  scanner: UseZebraScannerResult;
  history: Array<BarcodeEvent & { at: number }>;
  clearHistory: () => void;
  runtimeMode: RuntimeMode;
};

export const ScannerContext = createContext<ScannerContextValue | null>(null);

export function useScannerContext(): ScannerContextValue {
  const value = useContext(ScannerContext);
  if (!value) throw new Error('ScannerContext missing — wrap in <App />');
  return value;
}
