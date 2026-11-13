import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  subscribeSessionAttendance,
  type SessionAttendanceRecap,
} from '@/features/assistant/services/attendance-service';

interface AttendanceRecapProps {
  sessionId: string;
  classId: string;
}

export default function AttendanceRecap({
  sessionId,
  classId,
}: AttendanceRecapProps) {
  const [records, setRecords] = useState<SessionAttendanceRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Mengambil rekap presensi secara real-time.
  useEffect(() => {
    setLoading(true);
    setError('');
    setRecords([]);

    const unsubscribe = subscribeSessionAttendance(
      sessionId,
      classId,
      (data) => {
        setRecords(data);
        setLoading(false);
        setError('');
      },
      (firebaseError) => {
        console.error('Gagal mengambil rekap presensi:', firebaseError);
        setError('Rekap presensi tidak dapat dimuat.');
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [sessionId, classId]);

  const total = records.length;
  const present = records.filter((item) => item.hadir).length;
  const absent = total - present;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Rekap Kehadiran</Text>

        <Pressable
          onPress={() => setExpanded((previous) => !previous)}
        >
          <Text style={styles.toggleText}>
            {expanded ? 'Sembunyikan' : 'Lihat Rekap'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#000000" />
          <Text style={styles.loadingText}>
            Memuat rekap...
          </Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{total}</Text>
              <Text style={styles.summaryLabel}>Peserta</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.presentNumber}>{present}</Text>
              <Text style={styles.summaryLabel}>Hadir</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.absentNumber}>{absent}</Text>
              <Text style={styles.summaryLabel}>Belum Hadir</Text>
            </View>
          </View>

          {expanded && (
            <View style={styles.listContainer}>
              {records.length === 0 ? (
                <Text style={styles.emptyText}>
                  Belum ada peserta yang terdaftar di kelas ini.
                </Text>
              ) : (
                records.map((item) => (
                  <View key={item.uid} style={styles.record}>
                    <View style={styles.identity}>
                      <Text style={styles.name}>
                        {item.nama}
                      </Text>

                      <Text style={styles.nim}>
                        NIM: {item.nim || '-'}
                      </Text>

                      {item.hadir && (
                        <Text style={styles.time}>
                          Waktu presensi: {item.waktu || '-'}
                        </Text>
                      )}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.hadir
                          ? styles.presentBadge
                          : styles.absentBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          item.hadir
                            ? styles.presentText
                            : styles.absentText,
                        ]}
                      >
                        {item.hadir ? 'HADIR' : 'BELUM HADIR'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '800',
  },
  toggleText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
  },
  loadingText: {
    color: '#666666',
    fontSize: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  summaryItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    flex: 1,
    padding: 10,
  },
  summaryNumber: {
    color: '#222222',
    fontSize: 19,
    fontWeight: '800',
  },
  presentNumber: {
    color: '#15803D',
    fontSize: 19,
    fontWeight: '800',
  },
  absentNumber: {
    color: '#B91C1C',
    fontSize: 19,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#666666',
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
  },
  listContainer: {
    borderTopColor: '#DDDDDD',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 5,
  },
  emptyText: {
    color: '#777777',
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'center',
  },
  record: {
    alignItems: 'center',
    borderBottomColor: '#E5E5E5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: '#222222',
    fontSize: 13,
    fontWeight: '700',
  },
  nim: {
    color: '#666666',
    fontSize: 11,
  },
  time: {
    color: '#666666',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  presentBadge: {
    backgroundColor: '#DCFCE7',
  },
  absentBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  presentText: {
    color: '#15803D',
  },
  absentText: {
    color: '#B91C1C',
  },
});