import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useZebraScanner,
  type BarcodeEvent,
} from 'react-native-zebra-datawedge';
import { ScanScreen } from './screens/ScanScreen';
import { DiagnosticsScreen } from './screens/DiagnosticsScreen';
import { AboutScreen } from './screens/AboutScreen';
import { ScannerContext, type ScannerContextValue } from './context';

export type RuntimeMode = 'expo' | 'bare';

type Tab = 'scan' | 'diagnostics' | 'about';

type Props = {
  runtimeMode: RuntimeMode;
};

export default function App({ runtimeMode }: Props) {
  const [tab, setTab] = useState<Tab>('scan');
  const [history, setHistory] = useState<Array<BarcodeEvent & { at: number }>>(
    []
  );

  const scanner = useZebraScanner({
    onBarcode: (event) => {
      setHistory((prev) =>
        [{ ...event, at: Date.now() }, ...prev].slice(0, 20)
      );
    },
  });

  const contextValue: ScannerContextValue = useMemo(
    () => ({
      scanner,
      history,
      clearHistory: () => setHistory([]),
      runtimeMode,
    }),
    [scanner, history, runtimeMode]
  );

  return (
    <ScannerContext.Provider value={contextValue}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.title}>Zebra DataWedge Demo</Text>
          <View
            style={[
              styles.modePill,
              runtimeMode === 'expo' ? styles.modeExpo : styles.modeBare,
            ]}
          >
            <Text style={styles.modePillText}>
              {runtimeMode === 'expo' ? 'Expo' : 'Bare RN'}
            </Text>
          </View>
        </View>
        <View style={styles.body}>
          {tab === 'scan' && <ScanScreen />}
          {tab === 'diagnostics' && <DiagnosticsScreen />}
          {tab === 'about' && <AboutScreen />}
        </View>
        <View style={styles.tabs}>
          <TabButton
            label="Scan"
            active={tab === 'scan'}
            onPress={() => setTab('scan')}
          />
          <TabButton
            label="Diagnostics"
            active={tab === 'diagnostics'}
            onPress={() => setTab('diagnostics')}
          />
          <TabButton
            label="About"
            active={tab === 'about'}
            onPress={() => setTab('about')}
          />
        </View>
      </SafeAreaView>
    </ScannerContext.Provider>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D6DAE0',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  modeExpo: { backgroundColor: '#E0E7FF' },
  modeBare: { backgroundColor: '#FEF3C7' },
  modePillText: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D6DAE0',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: { borderTopWidth: 2, borderTopColor: '#2563EB' },
  tabText: { fontSize: 14, color: '#6B7280' },
  tabTextActive: { color: '#2563EB', fontWeight: '600' },
});
