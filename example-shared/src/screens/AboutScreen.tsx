import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { triggerSoftScan } from 'react-native-zebra-datawedge';
import { useScannerContext } from '../context';

export function AboutScreen() {
  const { scanner, runtimeMode } = useScannerContext();
  const d = scanner.diagnostics;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Section label="Runtime">
        <Row k="Mode" v={runtimeMode === 'expo' ? 'Expo managed' : 'Bare RN'} />
      </Section>

      <Section label="Configured profile">
        <Row k="Profile name" v={d?.profileName ?? '—'} />
        <Row k="Scan action" v={d?.scanAction ?? '—'} />
        <Row k="DataWedge version" v={d?.version ?? '—'} />
      </Section>

      <Section label="Soft trigger">
        <Text style={styles.blurb}>
          Send a START_SCANNING or STOP_SCANNING broadcast to DataWedge — useful
          for devices with a trigger-less form factor.
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => triggerSoftScan(true)}
          >
            <Text style={styles.btnTextPrimary}>Start soft scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => triggerSoftScan(false)}
          >
            <Text style={styles.btnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </Section>

      <Section label="About">
        <Text style={styles.blurb}>
          react-native-zebra-datawedge — open-source wrapper for Zebra DataWedge
          with profile auto-setup, barcode events, and diagnostics.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowVal} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  rowKey: { fontSize: 13, color: '#6B7280' },
  rowVal: {
    fontSize: 13,
    color: '#111827',
    marginLeft: 16,
    flexShrink: 1,
    textAlign: 'right',
  },
  blurb: { fontSize: 13, color: '#374151', lineHeight: 19 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  btnPrimary: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  btnText: { fontSize: 13, color: '#374151' },
  btnTextPrimary: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
});
