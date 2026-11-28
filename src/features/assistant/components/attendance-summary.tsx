import { StyleSheet, Text, View } from 'react-native';
import type { AttendanceRecord } from '../types';
import { FONT } from '@/constants/fonts';
import PersonIcon from '@/components/common/person-icon';
import { BORDER_COLOR } from '@/constants/colors';

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
              <PersonIcon size={18} color="#111014" />
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
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 19,
  },
  count: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 5,
    padding: 24,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },
  emptyTitle: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 15,
  },
  emptyText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  record: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 18,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },
  timestamp: {
    fontFamily: FONT.semibold,
    color: '#5F5F66',
    fontSize: 12,
  },
});