import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import HeaderProfileBar from '@/components/common/HeaderProfileBar';
import {
  usePracticum,
  type SessionStatus,
} from '@/context/PracticumContext';

interface AttendanceBadgeProps {
  sessionStatus: SessionStatus;
  isPresent: boolean;
}

function AttendanceBadge({
  sessionStatus,
  isPresent,
}: AttendanceBadgeProps) {
  let label = 'BELUM DIBUKA';

  if (isPresent) {
    label = 'HADIR';
  } else if (sessionStatus === 'OPEN') {
    label = 'BELUM PRESENSI';
  } else if (sessionStatus === 'CLOSED') {
    label = 'TIDAK HADIR';
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export default function AttendanceHistoryScreen() {
  const { currentUser, sessions } = usePracticum();

  const isPraktikan = currentUser.role === 'PRAKTIKAN';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={isPraktikan ? sessions : []}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>
              Riwayat Kehadiran
            </Text>

            <Text style={styles.subtitle}>
              Pantau status kehadiran setiap sesi praktikum.
            </Text>

            <HeaderProfileBar />

            {isPraktikan && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                  Total Sesi Praktikum
                </Text>

                <Text style={styles.summaryValue}>
                  {sessions.length}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {isPraktikan
                ? 'Riwayat Sesi'
                : 'Riwayat Praktikan'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const attendance = item.attendances.find(
            (record) => record.userId === currentUser.id,
          );

          return (
            <View style={styles.card}>
              <Text style={styles.sessionName}>
                {item.practicumName}
              </Text>

              <Text style={styles.module}>
                {item.moduleTitle.replace(
                  /^Modul\s*(\d+)\s*:\s*/i,
                  'Pertemuan $1: ',
                )}
              </Text>

              <View style={styles.metadata}>
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    Lokasi
                  </Text>

                  <Text style={styles.metadataValue}>
                    {item.classRoom}
                  </Text>
                </View>

                <View style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>
                    Jadwal
                  </Text>

                  <Text style={styles.metadataValue}>
                    {item.scheduleTime}
                  </Text>
                </View>
              </View>

              <View style={styles.footer}>
                <AttendanceBadge
                  sessionStatus={item.status}
                  isPresent={Boolean(attendance)}
                />

                {attendance && (
                  <Text style={styles.timestamp}>
                    {attendance.timestamp}
                  </Text>
                )}
              </View>

              {attendance?.note ? (
                <View style={styles.noteContainer}>
                  <Text style={styles.metadataLabel}>
                    Catatan Presensi
                  </Text>

                  <Text style={styles.note}>
                    {attendance.note}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {isPraktikan
                ? 'Belum Ada Sesi'
                : 'Pilih Akun Praktikan'}
            </Text>

            <Text style={styles.emptyText}>
              {isPraktikan
                ? 'Riwayat sesi praktikum belum tersedia.'
                : 'Ganti akun ke Praktikan untuk melihat riwayat kehadiran pribadi.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 100,
  },
  header: {
    gap: 8,
    marginBottom: 20,
  },
  title: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  summaryCard: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 7,
    marginTop: 12,
    padding: 16,
  },
  summaryLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  sessionName: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  module: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  metadata: {
    gap: 10,
  },
  metadataRow: {
    gap: 4,
  },
  metadataLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  metadataValue: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    alignItems: 'center',
    borderTopColor: '#E5E5E5',
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#404040',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timestamp: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  noteContainer: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    gap: 5,
    padding: 12,
  },
  note: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    gap: 6,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});