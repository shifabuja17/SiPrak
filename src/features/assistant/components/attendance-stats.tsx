import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/fonts';
import {
  attendanceStatus,
  useSessionAttendance,
} from '@/features/assistant/hooks/use-session-attendance';

/** Radius kartu di dalam kartu sesi: radius kartu sesi (26) dikurangi padding-nya (16). */
export const INNER_RADIUS = 10;

/**
 * Kartu rekap kehadiran ringkas di dalam kartu sesi: Hadir, Izin, Tidak Hadir.
 * Izin = peserta yang belum presensi tetapi pengajuan izinnya untuk sesi ini diterima.
 */
export default function AttendanceStats({
  sessionId,
  classId,
  excusedUids,
}: {
  sessionId: string;
  classId: string;
  /** uid praktikan yang izinnya diterima untuk sesi ini. */
  excusedUids: ReadonlySet<string>;
}) {
  const { records, loading, error } = useSessionAttendance(sessionId, classId);

  const counts = { hadir: 0, izin: 0, tidak_hadir: 0 };
  for (const record of records) counts[attendanceStatus(record, excusedUids)] += 1;

  return (
    <View style={styles.card}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#111014" />
          <Text style={styles.muted}>Memuat rekap...</Text>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <View style={styles.row}>
          <Stat value={counts.hadir} label="Hadir" />
          <View style={styles.divider} />
          <Stat value={counts.izin} label="Izin" />
          <View style={styles.divider} />
          <Stat value={counts.tidak_hadir} label="Tidak Hadir" danger={counts.tidak_hadir > 0} />
        </View>
      )}
    </View>
  );
}

function Stat({ value, label, danger = false }: { value: number; label: string; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, danger && styles.valueDanger]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: INNER_RADIUS,
    gap: 10,
    padding: 14,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  divider: {
    alignSelf: 'stretch',
    backgroundColor: '#E4E4E7',
    width: 1,
  },
  value: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 22,
  },
  valueDanger: {
    color: '#E00000',
  },
  label: {
    fontFamily: FONT.semibold,
    color: '#5F5F66',
    fontSize: 12,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  muted: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },
  error: {
    fontFamily: FONT.regular,
    color: '#E00000',
    fontSize: 12,
  },
});
