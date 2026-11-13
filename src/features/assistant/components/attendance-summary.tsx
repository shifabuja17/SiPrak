import { StyleSheet, Text, View } from 'react-native';
import type { AttendanceRecord } from '../types';

interface AttendanceSummaryProps {
  records: AttendanceRecord[];
}

export function AttendanceSummary({
  records,
}: AttendanceSummaryProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Rekap Kehadiran</Text>
        <Text style={styles.count}>
          {records.length} hadir
        </Text>
      </View>

      {records.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            Belum ada presensi
          </Text>

          <Text style={styles.emptyText}>
            Daftar praktikan akan muncul setelah mereka melakukan presensi.
          </Text>
        </View>
      ) : (
        records.map((record) => (
          <View key={record.uid} style={styles.record}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {record.nama.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.identity}>
              <Text style={styles.name}>
                {record.nama}
              </Text>
            </View>

            <Text style={styles.timestamp}>
              {record.waktu}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    color: '#000000',
    fontSize: 19,
    fontWeight: '700',
  },
  count: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 5,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  record: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  avatarText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  timestamp: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
});