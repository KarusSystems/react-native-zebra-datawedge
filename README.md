# react-native-zebra-datawedge

React Native + Expo plugin for Zebra DataWedge: auto profile setup, barcode events, and built-in diagnostics.

## Installation


```sh
npm install react-native-zebra-datawedge
```


## Usage

### Expo (managed workflow)

Add the config plugin to `app.json`:

```jsonc
{
  "expo": {
    "plugins": [
      ["react-native-zebra-datawedge", {
        "profileName": "MyAppProfile",
        "scanAction": "com.myapp.SCAN",
        "decoders": ["code128", "qrcode", "ean13"],
        "keystrokeOutput": false
      }]
    ]
  }
}
```

Then `npx expo prebuild` + `npx expo run:android`.

### Bare React Native

Autolinking picks up the Android module. Optionally override the library
defaults by creating `android/app/src/main/res/values/zebra_datawedge.xml`
with `zdw_profile_name`, `zdw_scan_action`, `zdw_enabled_decoders`,
`zdw_keystroke_output_enabled` — see [example-bare/zebra_datawedge.example.xml](example-bare/zebra_datawedge.example.xml).

### API

```tsx
import {
  useZebraScanner,
  getDiagnostics,
  configureProfile,
  openDataWedgeApp,
  openDataWedgeAppDetails,
} from 'react-native-zebra-datawedge';

function Scanner() {
  const { hasHardwareScanner, diagnostics } = useZebraScanner({
    onBarcode: (e) => console.log(e.data, e.labelType),
  });
  // ...
}
```

See [example-shared/src](example-shared/src) for a full three-tab demo
(scan / diagnostics / about) that runs in both the Expo and bare-RN example
apps.


## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
