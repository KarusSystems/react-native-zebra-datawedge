export type BarcodeDecoder =
  | 'code128'
  | 'code39'
  | 'code93'
  | 'ean8'
  | 'ean13'
  | 'upca'
  | 'upce'
  | 'qrcode'
  | 'datamatrix'
  | 'pdf417'
  | 'aztec'
  | 'i2of5';

export type BarcodeEvent = {
  data: string;
  labelType: string | null;
};

/**
 * DataWedge's reply to a SCANNER_INPUT_PLUGIN request. `ALREADY_ENABLED` and
 * `ALREADY_DISABLED` arrive as FAILUREs but describe the scanner already being
 * in the state we asked for.
 */
export type ScannerPluginResult =
  | 'SUCCESS'
  | 'FAILURE'
  | 'ALREADY_ENABLED'
  | 'ALREADY_DISABLED';

export type Diagnostics = {
  installed: boolean;
  packageEnabled: boolean;
  serviceEnabled: boolean;
  /**
   * False when DataWedge did not answer the status query in time. `serviceEnabled`
   * is meaningless in that case — see `reconcileDiagnostics`.
   */
  serviceStatusKnown: boolean;
  enabled: boolean;
  version: string | null;
  profileName: string;
  scanAction: string;
  profileExists: boolean;
  profileConfigured: boolean;
};
