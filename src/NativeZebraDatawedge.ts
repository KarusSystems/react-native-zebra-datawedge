import {
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type { BarcodeEvent, Diagnostics } from './types';

const LINKING_ERROR =
  "The package 'react-native-zebra-datawedge' doesn't seem to be linked. Make sure:\n\n" +
  '- You rebuilt the app after installing the package\n' +
  '- You are running on Android (this library is Android-only)\n';

type NativeSpec = {
  configureProfile(): Promise<boolean>;
  getDiagnostics(): Promise<Diagnostics>;
  openDataWedgeApp(): Promise<boolean>;
  openDataWedgeAppDetails(): Promise<boolean>;
  setScannerEnabled(enabled: boolean): Promise<boolean>;
  triggerSoftScan(start: boolean): Promise<boolean>;
};

const native: NativeSpec =
  Platform.OS === 'android' && NativeModules.ZebraDataWedge
    ? NativeModules.ZebraDataWedge
    : (new Proxy(
        {},
        {
          get() {
            throw new Error(LINKING_ERROR);
          },
        }
      ) as NativeSpec);

const emitter =
  Platform.OS === 'android' && NativeModules.ZebraDataWedge
    ? new NativeEventEmitter(NativeModules.ZebraDataWedge)
    : null;

export function configureProfile(): Promise<boolean> {
  return native.configureProfile();
}

export function getDiagnostics(): Promise<Diagnostics> {
  return native.getDiagnostics();
}

export function openDataWedgeApp(): Promise<boolean> {
  return native.openDataWedgeApp();
}

export function openDataWedgeAppDetails(): Promise<boolean> {
  return native.openDataWedgeAppDetails();
}

export function setScannerEnabled(enabled: boolean): Promise<boolean> {
  return native.setScannerEnabled(enabled);
}

export function triggerSoftScan(start: boolean): Promise<boolean> {
  return native.triggerSoftScan(start);
}

export function addBarcodeListener(
  listener: (event: BarcodeEvent) => void
): EmitterSubscription {
  if (!emitter) {
    return { remove: () => {} } as EmitterSubscription;
  }
  return emitter.addListener('onBarcode', listener as (event: unknown) => void);
}
