# @karus-systems/react-native-zebra-datawedge

Open-source wrapper for Zebra [DataWedge](https://techdocs.zebra.com/datawedge/)
with first-class Expo + bare RN support. Ships profile auto-setup, barcode
events, diagnostics, and a convenience React hook — so consumer apps can
wire up a Zebra hardware scanner without touching intents or Bundles.

**Android only** (DataWedge is Zebra-specific). Classic `NativeModules` bridge
— no `expo-modules-core` dependency, no New Architecture requirement.

## Features

- **Auto-configured DataWedge profile** — idempotent `configureProfile()`
  creates / updates a profile scoped to your app's package, with decoder
  toggles of your choice.
- **Barcode events** via `NativeEventEmitter`, or via the `useZebraScanner`
  hook that handles config + teardown for you.
- **Runtime diagnostics** (`getDiagnostics()`) — tells you whether
  DataWedge is installed, enabled in Android, enabled in the DataWedge app,
  which version, and whether your profile exists. Ideal for building a
  troubleshoot screen (there's one in the example app).
- **Scanner pause/resume** — `setScannerEnabled(false)` truly stops the
  laser/imager at the hardware level, not just filters JS events.
- **Soft trigger** — `triggerSoftScan(true/false)` for devices without a
  physical scan trigger or for in-app scan buttons.
- **Deep links** to the DataWedge app and its Android settings page so
  users can fix configuration issues without leaving your app.

## Install

```sh
npm install @karus-systems/react-native-zebra-datawedge
# or
yarn add @karus-systems/react-native-zebra-datawedge
```

### Expo (managed workflow)

Add the config plugin to `app.json` and rebuild:

```jsonc
{
  "expo": {
    "plugins": [
      ["@karus-systems/react-native-zebra-datawedge", {
        "profileName": "MyAppProfile",
        "scanAction": "com.myapp.SCAN",
        "decoders": ["code128", "qrcode", "ean13"],
        "keystrokeOutput": false
      }]
    ]
  }
}
```

```sh
npx expo prebuild --clean
npx expo run:android
```

The plugin injects a `<queries>` entry for `com.symbol.datawedge` and
writes `android/app/src/main/res/values/zebra_datawedge.xml` with your
options. All four fields are optional (see **Plugin options** below for
defaults).

### Bare React Native

Autolinking picks up the Android module — `npm install` + rebuild is all
that's strictly required. Optionally override defaults by dropping a
resource file at `android/app/src/main/res/values/zebra_datawedge.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="zdw_profile_name" translatable="false">MyAppProfile</string>
    <string name="zdw_scan_action" translatable="false">com.myapp.SCAN</string>
    <bool name="zdw_keystroke_output_enabled">false</bool>
    <string-array name="zdw_enabled_decoders" translatable="false">
        <item>code128</item>
        <item>qrcode</item>
        <item>ean13</item>
    </string-array>
</resources>
```

See [example-bare/zebra_datawedge.example.xml](example-bare/zebra_datawedge.example.xml)
for a working reference.

## Plugin options

| Option | Type | Default | Notes |
|---|---|---|---|
| `profileName` | `string` | `"AppDataWedgeProfile"` | DataWedge profile created/updated by `configureProfile()`. |
| `scanAction` | `string` | `"${applicationId}.SCAN"` | Intent action DataWedge broadcasts scanned barcodes with. Must be unique per app. |
| `decoders` | `BarcodeDecoder[]` | `["code128"]` | Which symbologies to enable. See supported list below. |
| `keystrokeOutput` | `boolean` | `false` | If `true`, DataWedge also types scans as keystrokes into the focused input. Normally `false` so scans only arrive as intents. |

**Supported decoders:** `code128`, `code39`, `code93`, `ean8`, `ean13`,
`upca`, `upce`, `qrcode`, `datamatrix`, `pdf417`, `aztec`, `i2of5`.

## Usage

### Hook (recommended)

```tsx
import { useZebraScanner } from '@karus-systems/react-native-zebra-datawedge';

function Scanner() {
  const {
    hasHardwareScanner,
    isChecking,
    diagnostics,
    startReading,
    stopReading,
    reconfigure,
  } = useZebraScanner({
    onBarcode: (e) => console.log('scanned', e.data, e.labelType),
  });

  if (isChecking) return <Spinner />;
  if (!hasHardwareScanner) return <NoScannerMessage d={diagnostics} />;
  // ...
}
```

The hook calls `configureProfile()` + `getDiagnostics()` on mount, subscribes
to barcode events, and exposes helpers to start/stop the scanner and
re-apply the profile.

### Reporting scanner status

Use `scannerState` rather than `isScannerReady` for anything a user reads. The
boolean cannot tell a deliberately stopped scanner from one still starting up,
so UI built on it announces "Enabling scanner…" after the user presses stop.

```ts
type ScannerState =
  | 'checking'     // diagnostics still running
  | 'unavailable'  // no usable DataWedge — send them to your troubleshoot screen
  | 'stopped'      // stopReading() was called
  | 'enabling'     // enable requested, awaiting DataWedge
  | 'ready';       // confirmed enabled
```

`isScannerReady` remains available and is exactly `scannerState === 'ready'`.

The scanner starts automatically once one is available, because barcodes are
delivered from mount regardless — reporting "stopped" while scans land would be
a lie. Pass `autoStart: false` if you want to drive it entirely by hand.

> **Multi-screen apps:** call `useZebraScanner` **once** at the top of your
> tree and share it via React context. Calling the hook independently in
> each screen would create independent subscriptions and independent
> start/stop flags. See [example-shared/src/App.tsx](example-shared/src/App.tsx)
> and [example-shared/src/context.ts](example-shared/src/context.ts) for
> the pattern used by the demo app.

### Imperative API

```tsx
import {
  configureProfile,
  getDiagnostics,
  addBarcodeListener,
  setScannerEnabled,
  triggerSoftScan,
  openDataWedgeApp,
  openDataWedgeAppDetails,
} from '@karus-systems/react-native-zebra-datawedge';

await configureProfile();
const diag = await getDiagnostics();

const sub = addBarcodeListener((e) => console.log(e.data));
// ...later
sub.remove();

await setScannerEnabled(false);  // physically disable the scanner
await triggerSoftScan(true);     // fire a scan from software
await openDataWedgeApp();        // deep-link into DataWedge
```

### Diagnostics shape

```ts
type Diagnostics = {
  installed: boolean;        // com.symbol.datawedge is on the device
  packageEnabled: boolean;   // DataWedge not disabled in Android settings
  serviceEnabled: boolean;   // DataWedge's own in-app "DataWedge enabled" toggle
  serviceStatusKnown: boolean; // false if DataWedge never answered the query
  enabled: boolean;          // packageEnabled && serviceEnabled
  version: string | null;    // DataWedge versionName, if available
  profileName: string;       // your configured profile name
  scanAction: string;        // your configured intent action
  profileExists: boolean;    // DataWedge has a profile with profileName
  profileConfigured: boolean; // configureProfile() succeeded this session
};
```

`serviceEnabled` is read over a broadcast round-trip that can time out, most
often on the first query of a session while the DataWedge service is still
cold-starting. When that happens `serviceStatusKnown` is `false` and
`serviceEnabled` is meaningless — a timeout means "no answer", not "disabled".

`useZebraScanner` handles this for you: it keeps the last known-good answer,
falls back to the (synchronously verifiable) package state when there isn't one,
and re-queries in the background. If you call `getDiagnostics()` directly, check
`serviceStatusKnown` before telling a user their scanner is unavailable.

`getDiagnostics()` fires two DataWedge query broadcasts in parallel with a
2-second timeout — missing fields degrade to `false` rather than rejecting,
so your UI always gets a usable answer.

### Troubleshoot screen

See [example-shared/src/screens/DiagnosticsScreen.tsx](example-shared/src/screens/DiagnosticsScreen.tsx)
for a drop-in pattern: one row per diagnostic field with a green/red pill,
plain-English hints on how to recover from each failure mode, and buttons
for **Reapply profile**, **Open DataWedge app**, and **Open in Android
settings**.

## Example apps

Two example apps in this repo exercise the same shared UI
([`example-shared/src`](example-shared/src)) against different RN
compatibility targets:

| App | RN | Min Android | Purpose |
|---|---|---|---|
| [`example/`](example) | Latest (via Expo SDK 55) | API 24 | Demonstrates the Expo config plugin end-to-end. |
| [`example-bare/`](example-bare) | 0.71.19 | API 22 (Android 5.1) | Classic autolinking — needed for older Zebra firmware (TC8000 etc.). |

Run either with:

```sh
yarn install                     # at repo root
cd example     && npx expo run:android
# or
cd example-bare && npx react-native run-android
```

## Compatibility

- Android-only.
- Supports minSdk 21+ at the library level. The bare-RN example is pinned to
  RN 0.71.19 to stay buildable for API 22 devices; the Expo example runs on
  modern RN (API 24+).
- Needs DataWedge 6.x or later. Older firmware versions may not support
  `setScannerEnabled` — scans will still filter correctly on the JS side but
  the hardware trigger won't pause.

### Supported devices

**Tested on hardware.** A barcode was scanned on the real device with this
library.

| Device | Android | DataWedge | Library | Notes |
|---|---|---|---|---|
| Zebra TC8300 | 11 | 11.3.28 | 0.2.2 | Needs 0.2.2 or later. Earlier versions crash DataWedge 11 ([#7](https://github.com/KarusSystems/react-native-zebra-datawedge/pull/7)). |
| Zebra TC26 | — | 15.0.104 | 0.2.2 | |
| Zebra TC8000 | 5.1 (API 22) | — | — | Use the classic autolinking setup shown in [`example-bare/`](example-bare). |

**Should work, not verified.** These devices ship DataWedge 6.x or later, so
the same intent API is present. Nobody has confirmed them on hardware yet.

| Family | Models |
|---|---|
| TC2x | TC21, TC22, TC27 |
| TC5x | TC51, TC52, TC53, TC56, TC57, TC58 |
| TC7x | TC70x, TC72, TC73, TC75x, TC77, TC78 |
| MC series | MC2200, MC2700, MC3300, MC9300 |
| EC series | EC30, EC50, EC55 |
| ET tablets with a scanner | ET40, ET45, ET51, ET56 |

DataWedge behaviour differs between major versions: DataWedge 15 hid two bugs
that DataWedge 11 exposed. If you run this library on a device that is not in
the tested table, please
[open an issue](https://github.com/KarusSystems/react-native-zebra-datawedge/issues)
with the model, the Android version, the DataWedge version and the result, so
the device can move to the correct table.

## Why this vs. existing libraries?

- [`react-native-datawedge-intents`](https://github.com/darryncampbell/react-native-datawedge-intents)
  is archived and only wraps raw `sendBroadcastWithExtras`. No profile
  helper, no diagnostics, no Expo plugin.
- [`@pqthanh/expo-datawedge`](https://www.npmjs.com/package/@pqthanh/expo-datawedge)
  is a thin Expo-module wrapper over the same raw broadcast API, single
  contributor, no profile helper.

This library carries the value the raw-intent wrappers leave to each
consumer — the SET_CONFIG bundle, the lifecycle handling, the
diagnostics state machine, and the deep-link helpers — so integrating
with DataWedge is a five-line hook call instead of a weekend of reverse
engineering Zebra docs.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
