# Bare RN example (RN 0.71.19, Android 5.1+)

Bare React Native app consuming `react-native-zebra-datawedge` via classic
autolinking. Pinned to RN 0.71.19 so the minimum Android SDK can stay at
21 (Android 5.1), matching older Zebra TC-series firmware.

The demo UI is identical to the Expo example — both apps re-export from
[`@zdw/example-shared`](../example-shared). The "Bare RN" badge on the
About screen confirms which build is running.

## Optional resource overrides

Copy [`zebra_datawedge.example.xml`](./zebra_datawedge.example.xml) into
`android/app/src/main/res/values/zebra_datawedge.xml` to override the
library defaults (profile name, scan action, decoders, keystroke output).

## Run

From the repo root:

```sh
yarn install
cd example-bare
npx react-native run-android
```
