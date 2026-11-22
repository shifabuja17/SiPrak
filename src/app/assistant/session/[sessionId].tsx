import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AssistantLeaveRequestsScreen from '@/app/assistant/leave-requests';
import AssistantHeader from '@/components/common/AssistantHeader';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import PersonIcon from '@/components/common/person-icon';
import { FONT } from '@/constants/fonts';
import {
  attendanceStatus,
  NO_EXCUSED,
  useExcusedBySession,
  useSessionAttendance,
  type AttendanceStatus,
} from '@/features/assistant/hooks/use-session-attendance';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  tidak_hadir: 'Tidak Hadir',
};

/** Urutan daftar: yang hadir dulu, lalu izin, lalu tidak hadir. */
const STATUS_ORDER: Record<AttendanceStatus, number> = { hadir: 0, izin: 1, tidak_hadir: 2 };

type Section = 'rekap' | 'izin';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'rekap', label: 'Rekap Kehadiran' },
  { key: 'izin', label: 'Pengajuan Izin' },
];

// ==========================================
// HALAMAN CEK PRESENSI SESI
// ==========================================

/** Cek Presensi: judul sesi di atas, lalu tab Rekap Kehadiran / Pengajuan Izin. */
export default function AssistantCheckAttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions } = useAssistantSessions();
  const session = sessions.find((item) => item.id === sessionId);
  const [section, setSection] = useState<Section>('rekap');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AssistantHeader />

      {/* NAMA PRAKTIKUM & PERTEMUAN */}
      <View style={styles.top}>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
            {session ? session.practicumName : 'Cek Presensi'}
          </Text>
          {session ? (
            <Text style={styles.subtitle}>{formatMeetingTitle(session.moduleTitle)}</Text>
          ) : null}
        </View>

        <SegmentedTabs options={SECTIONS} value={section} onChange={setSection} />
      </View>

      <View style={styles.body}>
        {section === 'rekap' ? (
          <AttendanceRecapList sessionId={sessionId} />
        ) : (
          <AssistantLeaveRequestsScreen sessionId={sessionId} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// TAB REKAP KEHADIRAN
// ==========================================

function AttendanceRecapList({ sessionId }: { sessionId: string }) {
  const { sessions } = useAssistantSessions();
  const session = sessions.find((item) => item.id === sessionId);

  const { records, loading, error } = useSessionAttendance(sessionId, session?.classId);
  const excusedBySession = useExcusedBySession(true);
  const excused = excusedBySession.get(sessionId) ?? NO_EXCUSED;

  const rows = records
    .map((record) => ({ record, status: attendanceStatus(record, excused) }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.record.nama.localeCompare(b.record.nama),
    );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {!session ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Sesi tidak ditemukan</Text>
            <Text style={styles.stateText}>Data sesi yang kamu cari tidak tersedia.</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#111014" />
            <Text style={styles.stateText}>Memuat rekap kehadiran...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={[styles.stateText, styles.dangerText]}>{error}</Text>
          </View>
        ) : (
          <>

            {/* DAFTAR PESERTA */}
            {rows.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>Belum ada peserta yang terdaftar di kelas ini.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {rows.map(({ record, status }) => (
                  <View key={record.uid} style={styles.row}>
                    <View style={styles.avatar}>
                      <PersonIcon size={18} color="#111014" />
                    </View>

                    <View style={styles.identity}>
                      <Text style={styles.name} numberOfLines={1}>
                        {record.nama}
                      </Text>
                      <Text style={styles.meta}>
                        {status === 'hadir' && record.waktu
                          ? `NIM ${record.nim || '-'}  |  ${record.waktu}`
                          : `NIM ${record.nim || '-'}`}
                      </Text>
                    </View>

                    <View style={[styles.badge, badgeStyle[status]]}>
                      <Text style={[styles.badgeText, badgeTextStyle[status]]}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
    </ScrollView>
  );
}


const badgeStyle = StyleSheet.create({
  hadir: { backgroundColor: '#F47321' },
  izin: { backgroundColor: '#111014' },
  tidak_hadir: { backgroundColor: '#E00000' },
});

const badgeTextStyle = StyleSheet.create({
  hadir: { color: '#FFFFFF' },
  izin: { color: '#FFFFFF' },
  tidak_hadir: { color: '#FFFFFF' },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  top: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  body: {
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  heading: {
    gap: 4,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 15,
  },
  list: {
    gap: 10,
  },
  row: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  avatar: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  meta: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },
  stateCard: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    padding: 20,
  },
  stateTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },
  stateText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    textAlign: 'center',
  },
  dangerText: {
    color: '#E00000',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
