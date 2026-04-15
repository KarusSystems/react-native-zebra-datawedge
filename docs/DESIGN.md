# Extract DataWedge Native Module → Open-Source RN Library + Expo Config Plugin

## Context

We just shipped a working Zebra DataWedge integration in Hazcanz ([DataWedgeModule.kt](android/app/src/main/java/com/karus/hazcanz/DataWedgeModule.kt) + [useZebraScanner.ts](src/hooks/useZebraScanner.ts) + [ScannerTroubleshootScreen.tsx](src/screens/ScannerTroubleshootScreen.tsx)). The user wants to:

1. Reuse it in another project that runs **latest Expo + RN**.
2. Optionally reuse it later in this **bare RN 0.73** Hazcanz project.
3. **Open-source** it on **public npm**, configurable via build-time options.

**Existing libraries are insufficient:**
- `react-native-datawedge-intents` — archived 2022, classic RN bridge only, no Expo plugin, no profile-creation helper.
- `@pqthanh/expo-datawedge` — brand new, single contributor, "My new module" placeholder description, also a thin `sendBroadcastWithExtras` wrapper with no profile helper.

Both leave SET_CONFIG bundle, lifecycle handling, diagnostics, and deep-linking to consumers — i.e. they don't carry the value that makes our Kotlin module useful.

## Architectural decision: classic RN library + Expo config plugin (not an Expo Module)

A pure Expo Module would force bare-RN consumers (like Hazcanz) to install `expo-modules-core` first — non-trivial footprint, version-pinning headaches on RN 0.73. Instead we follow the pattern used by `react-native-mmkv`, `react-native-permissions`, `react-native-vision-camera`:

- **Native side:** classic `ReactContextBaseJavaModule` (what we have today, parameterized).
- **JS side:** plain `NativeModules.X` + `NativeEventEmitter`. No Expo runtime required.
- **Expo support:** ship a **config plugin** that runs at `expo prebuild` to inject the manifest `<queries>` and write the build-time configuration resources.

| Compatibility | Pure Expo Module | This plan (classic + plugin) |
|---|---|---|
| Latest Expo + RN | ✅ | ✅ via config plugin |
| Bare RN ≥ 0.60 (incl. Hazcanz on 0.73) | ⚠️ Needs `install-expo-modules` | ✅ Plain `npm install` + autolinking |

Trade-off accepted: no Expo Sweet-API ergonomics on the Kotlin side. In exchange we ship a single artifact that drops into any modern RN project (Expo or bare).

The library lives in a **separate repo**. Hazcanz keeps its current native bridge — migrating Hazcanz to consume the published library is a follow-up task.

## Approach

### 1. Repo scaffold

Use `create-react-native-library` (Callstack's tool — generates a classic RN module + autolinking config + example app):

```
npx create-react-native-library@latest react-native-zebra-datawedge
```

Pick: language Kotlin, type "Native module", platforms Android only.

Final structure:

```
react-native-zebra-datawedge/
├── src/
│   ├── index.ts                          # public API re-exports
│   ├── NativeZebraDataWedge.ts           # NativeModules wrapper + types
│   ├── useZebraScanner.ts                # convenience hook
│   └── types.ts                          # Diagnostics, BarcodeEvent, BarcodeDecoder
├── android/
│   ├── build.gradle
│   └── src/main/java/com/zebradatawedge/
│       ├── ZebraDataWedgeModule.kt       # ported from Hazcanz DataWedgeModule.kt
│       ├── ZebraDataWedgePackage.kt
│       └── DataWedgeBundle.kt            # SET_CONFIG bundle builder
├── plugin/
│   ├── src/index.ts                      # config plugin entry
│   └── src/withZebraDataWedge.ts         # Manifest + resource modifications
├── app.plugin.js                         # Expo plugin entry shim
├── react-native.config.js                # autolinking metadata
├── package.json                          # name, peerDeps (react, react-native), peerDepsMeta (expo optional)
├── tsconfig.json
├── README.md
├── LICENSE                               # MIT
├── CHANGELOG.md
└── example/                              # bare RN example app for device testing
```

### 2. Native module (classic Kotlin bridge)

Port the logic from [DataWedgeModule.kt](android/app/src/main/java/com/karus/hazcanz/DataWedgeModule.kt) with these changes:

- Module name: `"ZebraDataWedge"`.
- Constants `PROFILE_NAME`, `SCAN_ACTION`, decoder list, keystroke flag come from generated Android resources (filled in by either the Expo plugin or by the consumer in bare RN — see §4):
  - `R.string.zdw_profile_name`
  - `R.string.zdw_scan_action`
  - `R.array.zdw_enabled_decoders`
  - `R.bool.zdw_keystroke_output_enabled`
- Sensible fallbacks if a resource is missing (e.g. profile name `"AppDataWedgeProfile"`, scan action `"${packageName}.SCAN"`, decoders `["code128"]`).
- `DataWedgeBundle.kt` factored out so the SET_CONFIG bundle construction is testable in isolation.

**Public methods:**

| Method | Returns | Purpose |
|---|---|---|
| `configureProfile()` | `Promise<boolean>` | Sends SET_CONFIG (CREATE_IF_NOT_EXIST) + SWITCH_TO_PROFILE. Idempotent — safe to call on every mount. |
| `getDiagnostics()` | `Promise<Diagnostics>` | Full status snapshot — see below. |
| `openDataWedgeApp()` | `Promise<boolean>` | Launches the DataWedge app (deep link). |
| `openDataWedgeAppDetails()` | `Promise<boolean>` | Opens the DataWedge entry in Android app settings. |

**Event:** `onBarcode` → `{ data: string, labelType?: string | null }`.

**Diagnostics shape (mirrors the current Hazcanz module):**

```ts
type Diagnostics = {
  installed: boolean;        // PackageManager finds com.symbol.datawedge
  packageEnabled: boolean;   // ApplicationInfo.enabled (Android-level toggle)
  serviceEnabled: boolean;   // GET_DATAWEDGE_STATUS result (in-app toggle)
  enabled: boolean;          // packageEnabled && serviceEnabled — convenience
  version: string | null;    // DataWedge versionName
  profileName: string;       // configured profile name
  scanAction: string;        // configured intent action
  profileExists: boolean;    // GET_PROFILES_LIST contains profileName
  profileConfigured: boolean;// session flag (true after configureProfile succeeded)
};
```

**Async query implementation:**

`getDiagnostics()` synchronously fills `installed`, `packageEnabled`, `version`, then — only if both true — fires two DataWedge intent broadcasts in parallel and waits for `RESULT_ACTION` responses with a single 2 s timeout:

- `com.symbol.datawedge.api.GET_DATAWEDGE_STATUS` → `RESULT_GET_DATAWEDGE_STATUS` (string `"enabled"` / `"disabled"`)
- `com.symbol.datawedge.api.GET_PROFILES_LIST` → `RESULT_GET_PROFILES_LIST` (`String[]` of profile names; checked for `profileName` membership)

A small "pending response" state machine in the module tracks `pendingResult: WritableMap`, `pendingPromise: Promise`, `pendingRemaining: Int`. Each matching `RESULT_ACTION` populates one field and decrements the counter; resolution happens when the counter hits zero or the timeout fires (timeout fills missing fields with `false`). Partial results are always returned — never reject — so the UI degrades gracefully when DataWedge is unresponsive.

If a second `getDiagnostics` is called while one is in flight, the older promise is rejected with `DW_DIAGNOSTICS_SUPERSEDED` and the newer query takes over.

**Lifecycle:**

- Init — register `BroadcastReceiver` for `SCAN_ACTION` + `RESULT_ACTION` (categories: `DEFAULT`).
- `onHostResume` — re-send `SWITCH_TO_PROFILE` if `profileConfigured` is true (defends against another app changing the active profile).
- `onHostDestroy` — unregister receiver.
- API 33+ uses `Context.RECEIVER_EXPORTED` flag.

### 3. Expo config plugin

`plugin/src/withZebraDataWedge.ts`:

```ts
import { ConfigPlugin, withAndroidManifest, withDangerousMod }
  from '@expo/config-plugins';

export type ZebraDataWedgeOptions = {
  profileName?: string;
  scanAction?: string;
  decoders?: BarcodeDecoder[];        // default ["code128"]
  keystrokeOutput?: boolean;          // default false
};

const withZebraDataWedge: ConfigPlugin<ZebraDataWedgeOptions> = (config, opts) => {
  config = withQueriesPackage(config, 'com.symbol.datawedge');
  config = withGeneratedResources(config, opts);
  return config;
};
```

Plugin responsibilities:

1. **AndroidManifest** (`withAndroidManifest`) — add `<queries><package android:name="com.symbol.datawedge" /></queries>`.
2. **String + array resources** (`withDangerousMod` writing `android/app/src/main/res/values/zebra_datawedge.xml`) — emit `zdw_profile_name`, `zdw_scan_action`, `zdw_keystroke_output_enabled` and the `zdw_enabled_decoders` string array.

Consumer config (Expo `app.json`):
 
```jsonc
{
  "expo": {
    "plugins": [
      ["react-native-zebra-datawedge", {
        "profileName": "MyAppProfile",
        "scanAction": "com.myapp.SCAN",
        "decoders": ["code128", "qrcode"]
      }]
    ]
  }
}
```

### 4. Bare RN consumption (Hazcanz path)

In a bare RN project there is no `expo prebuild`, so the consumer either:

- Writes the same `zebra_datawedge.xml` resource file by hand under `android/app/src/main/res/values/` (we'll document this in the README), **or**
- Adds the `<queries>` to AndroidManifest by hand (one line) and accepts the library defaults.

The native module reads resources at runtime; missing resources fall back to defaults, so the library works even with zero configuration.

### 5. JS / TS public API

```ts
// src/index.ts
export { useZebraScanner } from './useZebraScanner';
export {
  configureProfile,
  getDiagnostics,
  openDataWedgeApp,
  openDataWedgeAppDetails,
  addBarcodeListener,
} from './NativeZebraDataWedge';
export type { Diagnostics, BarcodeEvent, BarcodeDecoder } from './types';
```

`useZebraScanner.ts` — direct port of [src/hooks/useZebraScanner.ts](src/hooks/useZebraScanner.ts), preserving `{ hasHardwareScanner, isChecking, startReading, stopReading }` for drop-in adoption. Internally calls `getDiagnostics()` and treats `hasHardwareScanner = installed && enabled` (i.e. **both** `packageEnabled` and `serviceEnabled`), so the hook automatically reports unavailable when DataWedge is disabled either at the Android-package level or via DataWedge's in-app toggle.

For consumers that want to build their own troubleshoot UI (like Hazcanz's [ScannerTroubleshootScreen.tsx](src/screens/ScannerTroubleshootScreen.tsx)), the full `Diagnostics` object — including `serviceEnabled`, `profileExists`, `version`, `profileName` — is available via direct `getDiagnostics()` calls. The README will include a worked example mirroring Hazcanz's screen, with rows for each diagnostic field, a "Reapply scanner profile" button (calls `configureProfile()`), and "Open DataWedge app" / "Open in Android settings" buttons (call `openDataWedgeApp()` / `openDataWedgeAppDetails()`).

### 6. Repo, license, publishing

- New GitHub repo: `react-native-zebra-datawedge` (separate from Hazcanz).
- MIT license.
- README documenting: install (`npm install react-native-zebra-datawedge`), Expo plugin options, bare-RN manual setup, JS API, troubleshooting (mirror Hazcanz's troubleshoot-screen advice), supported decoder list.
- GitHub Actions: lint + tsc on PR; `npm publish --access public` on tagged release.
- Initial release `0.1.0`. Compatibility matrix: tested against latest Expo SDK and RN 0.73 (Hazcanz).
- Hazcanz stays on its current native bridge — adopting the published library here is a follow-up.

## Critical files (to be created in the new repo)

| File | Purpose |
|---|---|
| `android/src/main/java/com/zebradatawedge/ZebraDataWedgeModule.kt` | Classic RN bridge; ported from [DataWedgeModule.kt](android/app/src/main/java/com/karus/hazcanz/DataWedgeModule.kt). |
| `android/src/main/java/com/zebradatawedge/DataWedgeBundle.kt` | Builds SET_CONFIG bundle from generated resources. |
| `android/src/main/java/com/zebradatawedge/ZebraDataWedgePackage.kt` | RN package wrapper. |
| `plugin/src/withZebraDataWedge.ts` | Config plugin: manifest queries + generated resources. |
| `app.plugin.js` | Expo plugin entry. |
| `src/NativeZebraDataWedge.ts` | TS bindings on top of `NativeModules`. |
| `src/useZebraScanner.ts` | Convenience hook; ported from [src/hooks/useZebraScanner.ts](src/hooks/useZebraScanner.ts). |
| `package.json` | Name, version, peerDeps (`react`, `react-native`); `expo` listed in `peerDependenciesMeta` as optional. |
| `react-native.config.js` | Autolinking declaration for bare RN. |
| `README.md` | Install, plugin options, bare-RN setup, API, troubleshooting. |
| `example/App.tsx` | Manual test harness (bare RN). |

## Verification

1. **Library build:** `npm run build` (tsc) and `cd example/android && ./gradlew assembleDebug` — confirms compilation across the boundary.
2. **Plugin smoke test:** create a fresh `npx create-expo-app`, install the library, configure the plugin in `app.json`, run `npx expo prebuild --clean`, inspect generated `android/app/src/main/AndroidManifest.xml` + `android/app/src/main/res/values/zebra_datawedge.xml` for expected entries.
3. **Device test on TC8000:** `npx expo run:android` from the Expo example, scan a CODE128 barcode (and any extra decoders configured), confirm payload arrives. Then exercise each diagnostic state and confirm `getDiagnostics()` returns the expected fields:
   - **Healthy:** `installed && packageEnabled && serviceEnabled && profileExists && enabled` all `true`.
   - **DataWedge disabled in Android settings:** `packageEnabled=false`, `enabled=false`, no async fields fetched (short-circuited).
   - **DataWedge service disabled inside the DataWedge app:** `packageEnabled=true`, `serviceEnabled=false`, `enabled=false`.
   - **Profile manually deleted from DataWedge:** `profileExists=false`. Tap "Reapply" → `profileExists` becomes `true` on next `getDiagnostics()`.
   - **Restart app after profile creation:** `profileExists` should still be `true` (it's queried live, not a session flag).
4. **Bare RN test:** `npm install ../react-native-zebra-datawedge` in the bundled bare-RN `example/`, edit AndroidManifest by hand to add `<queries>`, run `npx react-native run-android`, repeat the scan test to confirm autolinking + runtime work without Expo.
5. **Cross-version test:** install in a fresh latest-Expo-SDK app and verify it works without code changes; install in an RN 0.73 sample app and verify the same.
6. **Publish dry run:** `npm publish --dry-run` to verify package contents (no example app, no plugin TS source, only compiled `lib/`, only Android sources).
7. **Hazcanz follow-up (out of scope):** once published, a separate task replaces [DataWedgeModule.kt](android/app/src/main/java/com/karus/hazcanz/DataWedgeModule.kt) / [DataWedgePackage.kt](android/app/src/main/java/com/karus/hazcanz/DataWedgePackage.kt) with the new dependency, manually adds the `<queries>` to [AndroidManifest.xml](android/app/src/main/AndroidManifest.xml), optionally adds the `zebra_datawedge.xml` resource, and rewrites [useZebraScanner.ts](src/hooks/useZebraScanner.ts) to import from the package.
