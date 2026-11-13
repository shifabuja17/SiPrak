import { StyleSheet, Text, View } from 'react-native';

import { LeaveAiInfoBox } from '@/features/praktikan/components/leave-ai-info-box';
import { LeaveStatusBadge } from '@/features/praktikan/components/leave-status-badge';
import type {
  LeaveRequestDoc,
  PraktikanSession,
} from '@/features/praktikan/types';
import {
  formatDateTimeWIB,
  formatMeetingTitle,
} from '@/features/praktikan/utils/format';

export interface LeaveRequestCardProps {
  leave: LeaveRequestDoc;
  session?: PraktikanSession | null;
}

/**
 * Kartu item daftar pengajuan izin Praktikan (FR-17).
 * Menampilkan metadata sesi, alasan, timestamp pengajuan WIB, info kategori AI
 * (atau status fallback saat tidak tersedia), serta blok keputusan Asisten saat sudah ditinjau.
 */
export function LeaveRequestCard({ leave, session = null }: LeaveRequestCardProps) {
  const createdAtLabel =
    formatDateTimeWIB(leave.createdAt) ?? 'Menunggu sinkronisasi waktu...';

  const isReviewed = leave.status === 'diterima' || leave.status === 'ditolak';
  const isAccepted = leave.status === 'diterima';
  const reviewedAtLabel = formatDateTimeWIB(leave.reviewedAt) ?? 'Waktu review belum tercatat';
  const assistantNote =
    typeof leave.catatanAsisten === 'string' && leave.catatanAsisten.trim().length > 0
      ? leave.catatanAsisten.trim()
      : null;

  const scheduleSummary = session
    ? session.classRoom
      ? `${session.scheduleTime} · ${session.classRoom}`
      : session.scheduleTime
    : `ID Sesi: ${leave.sessionId}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.practicumName}>
            {session ? session.practicumName : 'Sesi Praktikum'}
          </Text>

          {session ? (
            <Text style={styles.meetingTitle}>
              {formatMeetingTitle(session.moduleTitle)}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeWrap}>
          <LeaveStatusBadge status={leave.status} />
        </View>
      </View>

      <View style={styles.metadataGrid}>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Jadwal Sesi</Text>
          <Text style={styles.metadataValue}>{scheduleSummary}</Text>
        </View>

        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Diajukan Pada</Text>
          <Text style={styles.metadataValue}>{createdAtLabel}</Text>
        </View>
      </View>

      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Alasan Ketidakhadiran</Text>
        <Text style={styles.reasonText}>{leave.alasan}</Text>
      </View>

      <LeaveAiInfoBox kategoriAI={leave.kategoriAI} />

      {isReviewed ? (
        <View
          style={[
            styles.decisionBox,
            isAccepted ? styles.decisionBoxAccepted : styles.decisionBoxRejected,
          ]}
        >
          <Text
            style={[
              styles.decisionTitle,
              isAccepted ? styles.decisionTitleAccepted : styles.decisionTitleRejected,
            ]}
          >
            {isAccepted
              ? 'Keputusan Asisten: Izin Diterima'
              : 'Keputusan Asisten: Izin Ditolak'}
          </Text>

          {assistantNote ? (
            <Text
              style={[
                styles.decisionText,
                isAccepted ? styles.decisionTextAccepted : styles.decisionTextRejected,
              ]}
            >
              Catatan Asisten: {assistantNote}
            </Text>
          ) : null}

          <Text
            style={[
              styles.decisionMeta,
              isAccepted ? styles.decisionTextAccepted : styles.decisionTextRejected,
            ]}
          >
            Diperiksa: {reviewedAtLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default LeaveRequestCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  practicumName: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  meetingTitle: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  badgeWrap: {
    flexShrink: 0,
  },
  metadataGrid: {
    gap: 8,
  },
  metadataRow: {
    gap: 2,
  },
  metadataLabel: {
    color: '#666666',
    fontSize: 12,
  },
  metadataValue: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 19,
  },
  reasonBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  reasonLabel: {
    color: '#525252',
    fontSize: 12,
    fontWeight: '700',
  },
  reasonText: {
    color: '#171717',
    fontSize: 13,
    lineHeight: 19,
  },
  decisionBox: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  decisionBoxAccepted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  decisionBoxRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  decisionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  decisionTitleAccepted: {
    color: '#15803D',
  },
  decisionTitleRejected: {
    color: '#B91C1C',
  },
  decisionText: {
    fontSize: 13,
    lineHeight: 19,
  },
  decisionMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  decisionTextAccepted: {
    color: '#166534',
  },
  decisionTextRejected: {
    color: '#991B1B',
  },
});
