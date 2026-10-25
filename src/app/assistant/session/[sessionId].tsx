import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

import { AttendanceSummary } from '@/features/assistant/components/attendance-summary';
import { SessionStatusBadge } from '@/features/assistant/components/session-status-badge';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';

export default function AssistantSessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, openSession, closeSession } = useAssistantSessions();
  const session = sessions.find((item) => item.id === sessionId);
  const [modalVisible, setModalVisible] = useState(false);
  const [sessionNote, setSessionNote] = useState('');

  if (!session) {
    return <SafeAreaView style={styles.safeArea}><Text style={styles.title}>Sesi tidak ditemukan</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Kembali ke jadwal</Text></Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{session.practicumName}</Text>
          <SessionStatusBadge status={session.status} />
        </View>
        <View style={styles.infoCard}>
          <Info label="Pertemuan dan Materi" value={session.moduleTitle} />
          <Info label="Lokasi" value={session.classRoom} />
          <Info label="Jadwal" value={session.scheduleTime} />
          <Info label="Catatan sesi" value={session.sessionNote || '-'} last />
        </View>
        {session.status === 'UPCOMING' && (
          <Pressable style={styles.primaryButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.primaryButtonText}>Buka Sesi</Text>
          </Pressable>
        )}
        {session.status === 'OPEN' && (
          <Pressable style={styles.secondaryButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.secondaryButtonText}>Tutup Sesi</Text>
          </Pressable>
        )}
        {session.status === 'CLOSED' && (
          <View style={styles.closedNotice}><Text style={styles.closedNoticeText}>Sesi ini sudah selesai.</Text></View>
        )}
        <AttendanceSummary records={session.attendances} />
      </ScrollView>
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{session.status === 'UPCOMING' ? 'Buka sesi praktikum?' : 'Tutup sesi praktikum?'}</Text>
            <Text style={styles.modalDescription}>{session.status === 'UPCOMING' ? 'Sesi akan berubah menjadi berlangsung dan praktikan dapat melakukan presensi.' : 'Sesi akan ditandai selesai. Praktikan tidak dapat melakukan presensi setelah sesi ditutup.'}</Text>
            {session.status === 'UPCOMING' && (
              <>
                <Text style={styles.inputLabel}>Catatan / materi sesi (opsional)</Text>
                <TextInput
                  value={sessionNote}
                  onChangeText={setSessionNote}
                  placeholder="Contoh: bahas latihan bagian 1–3"
                  placeholderTextColor="#777777"
                  multiline
                  textAlignVertical="top"
                  style={styles.noteInput}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)}><Text style={styles.cancelButtonText}>Batal</Text></Pressable>
              <Pressable
                style={styles.confirmButton}
                onPress={() => {
                  if (session.status === 'UPCOMING') openSession(session.id, sessionNote);
                  else if (session.status === 'OPEN') closeSession(session.id);
                  setSessionNote('');
                  setModalVisible(false);
                }}>
                <Text style={styles.confirmButtonText}>Konfirmasi</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Info({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, last && styles.infoRowLast]}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { gap: 22, padding: 20, paddingTop: 48, paddingBottom: 40 },
  back: { color: '#000000', fontSize: 14, fontWeight: '700', paddingVertical: 5 },
  titleBlock: { gap: 10 },
  title: { color: '#000000', fontSize: 25, fontWeight: '800', lineHeight: 32 },
  infoCard: { backgroundColor: '#FFFFFF', borderColor: '#D9D9D9', borderRadius: 18, borderWidth: 1, paddingHorizontal: 16 },
  infoRow: { borderBottomColor: '#E5E5E5', borderBottomWidth: 1, gap: 5, paddingVertical: 14 },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: '#666666', fontSize: 12, fontWeight: '600' },
  infoValue: { color: '#000000', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: '#000000', borderRadius: 14, padding: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#000000', borderRadius: 14, borderWidth: 1, padding: 15 },
  secondaryButtonText: { color: '#000000', fontSize: 15, fontWeight: '700' },
  closedNotice: { alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 14, padding: 15 },
  closedNoticeText: { color: '#404040', fontSize: 14, fontWeight: '600' },
  modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.45)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 14, padding: 22, paddingBottom: 32 },
  modalTitle: { color: '#000000', fontSize: 20, fontWeight: '800' },
  modalDescription: { color: '#404040', fontSize: 14, lineHeight: 21 },
  inputLabel: { color: '#000000', fontSize: 13, fontWeight: '700' },
  noteInput: { borderColor: '#BFBFBF', borderRadius: 12, borderWidth: 1, color: '#000000', minHeight: 92, padding: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelButton: { alignItems: 'center', borderColor: '#BFBFBF', borderRadius: 12, borderWidth: 1, flex: 1, padding: 14 },
  cancelButtonText: { color: '#000000', fontSize: 14, fontWeight: '700' },
  confirmButton: { alignItems: 'center', backgroundColor: '#000000', borderRadius: 12, flex: 1, padding: 14 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
