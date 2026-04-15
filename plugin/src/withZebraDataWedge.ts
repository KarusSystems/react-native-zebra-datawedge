import {
  withAndroidManifest,
  withDangerousMod,
  type ConfigPlugin,
} from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

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

export type ZebraDataWedgeOptions = {
  profileName?: string;
  scanAction?: string;
  decoders?: BarcodeDecoder[];
  keystrokeOutput?: boolean;
};

const DATAWEDGE_PACKAGE = 'com.symbol.datawedge';

const withQueries: ConfigPlugin = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest as unknown as {
      queries?: Array<{ package?: Array<{ $: { 'android:name': string } }> }>;
    };
    const queries = manifest.queries ?? [];
    const hasPackage = queries.some((q) =>
      (q.package ?? []).some((p) => p.$?.['android:name'] === DATAWEDGE_PACKAGE)
    );
    if (!hasPackage) {
      queries.push({
        package: [{ $: { 'android:name': DATAWEDGE_PACKAGE } }],
      });
      manifest.queries = queries;
    }
    return c;
  });

const withGeneratedResources: ConfigPlugin<ZebraDataWedgeOptions> = (
  config,
  opts
) =>
  withDangerousMod(config, [
    'android',
    async (c) => {
      const resDir = path.join(
        c.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values'
      );
      fs.mkdirSync(resDir, { recursive: true });
      const file = path.join(resDir, 'zebra_datawedge.xml');
      fs.writeFileSync(file, renderXml(opts), 'utf8');
      return c;
    },
  ]);

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderXml(opts: ZebraDataWedgeOptions): string {
  const profileName = opts.profileName ?? 'AppDataWedgeProfile';
  const scanAction = opts.scanAction ?? '';
  const decoders =
    opts.decoders && opts.decoders.length > 0 ? opts.decoders : ['code128'];
  const keystroke = opts.keystrokeOutput === true;

  const items = decoders
    .map((d) => `        <item>${escape(d)}</item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="zdw_profile_name" translatable="false">${escape(profileName)}</string>
    <string name="zdw_scan_action" translatable="false">${escape(scanAction)}</string>
    <bool name="zdw_keystroke_output_enabled">${keystroke}</bool>
    <string-array name="zdw_enabled_decoders" translatable="false">
${items}
    </string-array>
</resources>
`;
}

const withZebraDataWedge: ConfigPlugin<ZebraDataWedgeOptions | void> = (
  config,
  opts
) => {
  const resolved: ZebraDataWedgeOptions = opts ?? {};
  config = withQueries(config);
  config = withGeneratedResources(config, resolved);
  return config;
};

export default withZebraDataWedge;
