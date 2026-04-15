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

export type Diagnostics = {
  installed: boolean;
  packageEnabled: boolean;
  serviceEnabled: boolean;
  enabled: boolean;
  version: string | null;
  profileName: string;
  scanAction: string;
  profileExists: boolean;
  profileConfigured: boolean;
};
