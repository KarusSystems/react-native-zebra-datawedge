import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  openDataWedgeApp,
  openDataWedgeAppDetails,
  type Diagnostics,
} from '@karus-systems/react-native-zebra-datawedge';
import { useScannerContext } from '../context';

type Row = {
  label: string;
  ok: boolean;
  value: string;
  hint?: string;
};

function diagnosticsToRows(d: Diagnostics | null): Row[] {
  if (!d) return [];
  return [
    {
      label: 'DataWedge installed',
      ok: d.installed,
      value: d.installed ? 'Yes' : 'No',
      hint: d.installed
        ? undefined
        : 'DataWedge is only available on Zebra devices (TC series, MC series, etc.).',
    },
    {
      label: 'Package enabled (Android)',
      ok: d.packageEnabled,
      value: d.packageEnabled ? 'Enabled' : 'Disabled',
      hint: d.packageEnabled
        ? undefined
        : 'DataWedge is disabled in Android App Info. Open Android settings and enable it.',
    },
    {
      label: 'Service enabled (in-app toggle)',
      ok: d.serviceEnabled,
      value: d.serviceEnabled ? 'Enabled' : 'Disabled',
      hint: d.serviceEnabled
        ? undefined
        : 'Open the DataWedge app and toggle "DataWedge enabled" on.',
    },
    {
      label: 'DataWedge version',
      ok: d.version != null,
      value: d.version ?? '—',
    },
    {
      label: 'Profile exists',
      ok: d.profileExists,
      value: d.profileExists ? d.profileName : 'Not found',
      hint: d.profileExists
        ? undefined
        : 'Tap "Reapply profile" below to recreate it.',
    },
    {
      label: 'Profile configured this session',
      ok: d.profileConfigured,
      value: d.profileConfigured ? 'Yes' : 'No',
    },
    {
      label: 'Scan intent action',
      ok: true,
      value: d.scanAction,
    },
  ];
}

export function DiagnosticsScreen() {
  const { scanner } = useScannerContext();
  const rows = diagnosticsToRows(scanner.diagnostics);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View
          style={[
            styles.summaryDot,
            scanner.hasHardwareScanner ? styles.dotOk : styles.dotBad,
          ]}
        />
        <Text style={styles.summaryText}>
          {scanner.isChecking
            ? 'Checking…'
            : scanner.hasHardwareScanner
              ? 'Everything looks good'
              : 'Scanner not ready — review failing rows'}
        </Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View
              style={[styles.pill, row.ok ? styles.pillOk : styles.pillBad]}
            >
              <Text style={styles.pillText}>{row.value}</Text>
            </View>
          </View>
          {row.hint && <Text style={styles.rowHint}>{row.hint}</Text>}
        </View>
      ))}

      <View style={styles.actions}>
        <ActionBtn label="Refresh" onPress={scanner.refreshDiagnostics} />
        <ActionBtn
          label="Reapply profile"
          onPress={scanner.reconfigure}
          primary
        />
        <ActionBtn
          label="Open DataWedge app"
          onPress={() => openDataWedgeApp()}
        />
        <ActionBtn
          label="Open DataWedge in Android settings"
          onPress={() => openDataWedgeAppDetails()}
        />
      </View>
    </ScrollView>
  );
}

function ActionBtn({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary]}
      onPress={onPress}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  summaryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  summaryText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  dotOk: { backgroundColor: '#10B981' },
  dotBad: { backgroundColor: '#EF4444' },
  row: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: { fontSize: 13, color: '#374151', flex: 1, marginRight: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillOk: { backgroundColor: '#D1FAE5' },
  pillBad: { backgroundColor: '#FEE2E2' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  rowHint: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  actions: { marginTop: 16, gap: 8 },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionBtnPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  actionText: { fontSize: 14, color: '#374151' },
  actionTextPrimary: { color: '#FFFFFF', fontWeight: '600' },
});
