import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { LeaveSubmittingStep } from '@/features/praktikan/hooks/use-praktikan-leave-requests';
import type {
  FirestoreSessionStatus,
  LeaveRequestDoc,
  LeaveRequestStatus,
  PraktikanSession,
  SessionAttendanceDoc,
  SubmitLeaveRequestOutcome,
} from '@/features/praktikan/types';
import { formatMeetingTitle } from '@/features/praktikan/utils/format';
import {
  LEAVE_REASON_MAX_LENGTH,
  LEAVE_REASON_MIN_LENGTH,
  validateLeaveReason,
} from '@/features/praktikan/utils/leave-validation';

export interface LeaveRequestSheetProps {
  visible: boolean;
  sessions: PraktikanSession[];
  preselectedSession?: PraktikanSession | null;
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null | undefined>;
  leaveBySessionId: Record<string, LeaveRequestDoc | null | undefined>;
  submitting: boolean;
  submittingStep?: LeaveSubmittingStep;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (sessionId: string, alasan: string) => Promise<SubmitLeaveRequestOutcome>;
}

const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  menunggu: 'Menunggu',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
};

const SUBMITTING_STEP_LABELS: Record<LeaveSubmittingStep, string> = {
  idle: 'Mengirim...',
  classifying_ai: 'Mengklasifikasi alasan dengan AI...',
  saving_firestore: 'Menyimpan pengajuan izin...',
};

const SESSION_STATUS_LABELS: Record<FirestoreSessionStatus, string> = {
  dijadwalkan: 'Belum Dibuka',
  dibuka: 'Berlangsung',
  ditutup: 'Selesai',
};

function getSessionBlockReason(
  sessionId: string,
  attendanceBySessionId: Record<string, SessionAttendanceDoc | null | undefined>,
  leaveBySessionId: Record<string, LeaveRequestDoc | null | undefined>,
): string | null {
  if (attendanceBySessionId[sessionId]) {
    return 'Sudah tercatat hadir pada sesi ini';
  }

  const existingLeave = leaveBySessionId[sessionId];
  if (existingLeave) {
    return `Izin sudah diajukan (${LEAVE_STATUS_LABELS[existingLeave.status]})`;
  }

  return null;
}

/**
 * Modal/Bottom Sheet pengajuan izin Praktikan (FR-15).
 * Mendukung mode sesi terpilih (`preselectedSession`) maupun pemilih daftar sesi.
 */
export function LeaveRequestSheet({
  visible,
  sessions,
  preselectedSession = null,
  attendanceBySessionId,
  leaveBySessionId,
  submitting,
  submittingStep = 'idle',
  error = null,
  onCancel,
  onSubmit,
}: LeaveRequestSheetProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState('');
  const [touched, setTouched] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const localSubmittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const preselectedSessionId = preselectedSession?.id ?? null;

  useEffect(() => {
    if (!visible) {
      return;
    }

    setAlasan('');
    setTouched(false);
    setAttemptedSubmit(false);
    setSubmitError(null);
    setSelectedSessionId(null);
  }, [visible, preselectedSessionId]);

  const autoSelectedSession = !preselectedSession
    ? sessions.find(
        (item) => getSessionBlockReason(item.id, attendanceBySessionId, leaveBySessionId) === null,
      ) ?? null
    : null;

  const activeSession = preselectedSession
    ? preselectedSession
    : (selectedSessionId ? sessions.find((item) => item.id === selectedSessionId) : null) ??
      autoSelectedSession;

  const activeBlockReason = activeSession
    ? getSessionBlockReason(activeSession.id, attendanceBySessionId, leaveBySessionId)
    : null;

  const trimmedLength = alasan.trim().length;
  const validationError = validateLeaveReason(alasan);
  const shouldShowInlineError =
    touched || attemptedSubmit || trimmedLength > LEAVE_REASON_MAX_LENGTH;
  const visibleValidationError = shouldShowInlineError ? validationError : null;

  const isCounterInvalid =
    trimmedLength > LEAVE_REASON_MAX_LENGTH ||
    (shouldShowInlineError && trimmedLength < LEAVE_REASON_MIN_LENGTH);

  const hasEligibleSession = preselectedSession
    ? activeBlockReason === null
    : sessions.some(
        (item) => getSessionBlockReason(item.id, attendanceBySessionId, leaveBySessionId) === null,
      );

  const isFormBlocked = !activeSession || activeBlockReason !== null;
  const isSubmitDisabled = submitting || isFormBlocked;
  const displayedSubmitError = error || submitError || null;

  function handleRequestClose() {
    if (submitting || localSubmittingRef.current) {
      return;
    }
    onCancel();
  }

  async function handlePressSubmit() {
    if (submitting || localSubmittingRef.current) {
      return;
    }

    setAttemptedSubmit(true);
    setSubmitError(null);

    if (!activeSession) {
      setSubmitError('Pilih sesi praktikum terlebih dahulu.');
      return;
    }

    if (activeBlockReason) {
      setSubmitError(activeBlockReason);
      return;
    }

    if (validationError) {
      return;
    }

    localSubmittingRef.current = true;
    try {
      const outcome = await onSubmit(activeSession.id, alasan.trim());
      if (!outcome.ok && mountedRef.current) {
        setSubmitError(
          'Pengajuan izin gagal dikirim. Periksa pesan error yang tampil atau coba kembali.',
        );
      }
    } catch (error) {
      if (mountedRef.current) {
        setSubmitError(
          error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim pengajuan izin.',
        );
      }
    } finally {
      localSubmittingRef.current = false;
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.title}>Ajukan Izin Praktikum</Text>
            <Text style={styles.subtitle}>
              Tuliskan alasan ketidakhadiran Anda untuk ditinjau oleh Asisten Praktikum.
            </Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
          >
            {preselectedSession ? (
              <View style={styles.sessionSection}>
                <Text style={styles.sectionLabel}>Sesi Terpilih</Text>
                <View style={styles.sessionInfoBox}>
                  <Text style={styles.sessionName}>{preselectedSession.practicumName}</Text>
                  <Text style={styles.sessionModule}>
                    {formatMeetingTitle(preselectedSession.moduleTitle)}
                  </Text>
                  <Text style={styles.sessionMeta}>
                    {preselectedSession.scheduleTime} ·{' '}
                    {SESSION_STATUS_LABELS[preselectedSession.status]}
                  </Text>
                </View>

                {activeBlockReason ? (
                  <View style={styles.blockedNoticeBox}>
                    <Text style={styles.blockedNoticeText}>
                      Tidak dapat mengajukan izin: {activeBlockReason}.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.sessionSection}>
                <Text style={styles.sectionLabel}>Pilih Sesi Praktikum</Text>

                {sessions.length === 0 ? (
                  <View style={styles.emptySessionsBox}>
                    <Text style={styles.emptySessionsText}>
                      Belum ada sesi praktikum yang tersedia untuk diajukan izin.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.sessionList}>
                    {sessions.map((item) => {
                      const blockReason = getSessionBlockReason(
                        item.id,
                        attendanceBySessionId,
                        leaveBySessionId,
                      );
                      const isDisabled = blockReason !== null || submitting;
                      const isSelected = blockReason === null && activeSession?.id === item.id;

                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="radio"
                          accessibilityState={{
                            checked: isSelected,
                            disabled: isDisabled,
                          }}
                          disabled={isDisabled}
                          onPress={() => {
                            setSelectedSessionId(item.id);
                            setSubmitError(null);
                          }}
                          style={({ pressed }) => [
                            styles.sessionOption,
                            isSelected && styles.sessionOptionSelected,
                            blockReason !== null && styles.sessionOptionBlocked,
                            pressed && !isDisabled && styles.pressed,
                          ]}
                        >
                          <View style={styles.sessionOptionTop}>
                            <View style={styles.sessionOptionTextWrap}>
                              <Text
                                style={[
                                  styles.sessionOptionName,
                                  blockReason !== null && styles.sessionOptionTextMuted,
                                ]}
                              >
                                {item.practicumName}
                              </Text>
                              <Text style={styles.sessionOptionModule}>
                                {formatMeetingTitle(item.moduleTitle)}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.radioOuter,
                                isSelected && styles.radioOuterSelected,
                                blockReason !== null && styles.radioOuterDisabled,
                              ]}
                            >
                              {isSelected ? <View style={styles.radioInner} /> : null}
                            </View>
                          </View>

                          <Text style={styles.sessionOptionSchedule}>
                            {item.scheduleTime} · {SESSION_STATUS_LABELS[item.status]}
                          </Text>

                          {blockReason ? (
                            <View style={styles.blockTag}>
                              <Text style={styles.blockTagText}>{blockReason}</Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}

                    {!hasEligibleSession ? (
                      <View style={styles.blockedNoticeBox}>
                        <Text style={styles.blockedNoticeText}>
                          Semua sesi Anda sudah memiliki catatan presensi atau pengajuan izin.
                        </Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            <View style={styles.inputSection}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Alasan Ketidakhadiran</Text>
                <Text style={[styles.counterText, isCounterInvalid && styles.counterTextError]}>
                  {trimmedLength}/{LEAVE_REASON_MAX_LENGTH}
                </Text>
              </View>

              <TextInput
                editable={!submitting && !isFormBlocked}
                multiline
                numberOfLines={4}
                onBlur={() => setTouched(true)}
                onChangeText={(value) => {
                  setAlasan(value);
                  if (submitError) {
                    setSubmitError(null);
                  }
                }}
                placeholder="Contoh: Saya tidak dapat hadir karena sakit demam dan berobat ke klinik."
                placeholderTextColor="#8C8C8C"
                style={[
                  styles.textArea,
                  (visibleValidationError || displayedSubmitError) && styles.textAreaError,
                  (submitting || isFormBlocked) && styles.textAreaDisabled,
                ]}
                textAlignVertical="top"
                value={alasan}
              />

              <Text style={styles.helperText}>
                Minimal {LEAVE_REASON_MIN_LENGTH} karakter, maksimal {LEAVE_REASON_MAX_LENGTH}{' '}
                karakter.
              </Text>

              <View style={styles.aiNoticeBox}>
                <Text style={styles.aiNoticeText}>
                  Alasan izin akan diklasifikasikan oleh AI sebagai informasi pendukung bagi Asisten. Keputusan tetap ditentukan oleh Asisten.
                </Text>
              </View>

              {visibleValidationError ? (
                <Text style={styles.inlineErrorText}>{visibleValidationError}</Text>
              ) : null}

              {displayedSubmitError ? (
                <View style={styles.submitErrorBox}>
                  <Text style={styles.submitErrorText}>{displayedSubmitError}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={handleRequestClose}
              style={({ pressed }) => [
                styles.cancelButton,
                submitting && styles.disabled,
                pressed && !submitting && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSubmitDisabled }}
              disabled={isSubmitDisabled}
              onPress={() => void handlePressSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitDisabled && styles.submitButtonDisabled,
                pressed && !isSubmitDisabled && styles.pressed,
              ]}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text numberOfLines={2} style={[styles.submitText, styles.submittingText]}>
                    {SUBMITTING_STEP_LABELS[submittingStep]}
                  </Text>
                </View>
              ) : (
                <Text style={styles.submitText}>Kirim Pengajuan Izin</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default LeaveRequestSheet;

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
    maxHeight: '90%',
    padding: 22,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D9D9D9',
    borderRadius: 3,
    height: 5,
    marginBottom: 2,
    width: 40,
  },
  sheetHeader: {
    gap: 4,
  },
  title: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 4,
  },
  sessionSection: {
    gap: 8,
  },
  sectionLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
  },
  sessionInfoBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    gap: 4,
    padding: 12,
  },
  sessionName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionModule: {
    color: '#404040',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  sessionMeta: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
  },
  sessionList: {
    gap: 8,
  },
  sessionOption: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  sessionOptionSelected: {
    backgroundColor: '#FAFAFA',
    borderColor: '#000000',
    borderWidth: 1.5,
  },
  sessionOptionBlocked: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    opacity: 0.72,
  },
  sessionOptionTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  sessionOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  sessionOptionName: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionOptionTextMuted: {
    color: '#525252',
  },
  sessionOptionModule: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 18,
  },
  sessionOptionSchedule: {
    color: '#666666',
    fontSize: 12,
  },
  radioOuter: {
    alignItems: 'center',
    borderColor: '#A3A3A3',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 18,
    justifyContent: 'center',
    marginTop: 2,
    width: 18,
  },
  radioOuterSelected: {
    borderColor: '#000000',
  },
  radioOuterDisabled: {
    borderColor: '#D4D4D4',
  },
  radioInner: {
    backgroundColor: '#000000',
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  blockTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5E5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  blockTagText: {
    color: '#404040',
    fontSize: 11,
    fontWeight: '700',
  },
  emptySessionsBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    padding: 14,
  },
  emptySessionsText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
  },
  blockedNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  blockedNoticeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  inputSection: {
    gap: 8,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  counterText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  counterTextError: {
    color: '#B91C1C',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFBFBF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 104,
    padding: 12,
  },
  textAreaError: {
    borderColor: '#B91C1C',
  },
  textAreaDisabled: {
    backgroundColor: '#F5F5F5',
    color: '#737373',
  },
  helperText: {
    color: '#666666',
    fontSize: 12,
  },
  aiNoticeBox: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiNoticeText: {
    color: '#404040',
    fontSize: 12,
    lineHeight: 17,
  },
  inlineErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  submitErrorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  submitErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#BFBFBF',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  cancelText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    flex: 1.5,
    justifyContent: 'center',
    padding: 14,
  },
  submitButtonDisabled: {
    backgroundColor: '#A3A3A3',
  },
  submittingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  submittingText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.68,
  },
});
