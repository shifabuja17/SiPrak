import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import AssistantHeader from '@/components/common/AssistantHeader';
import AslabRoleGuard from '@/components/auth/aslab-role-guard';
import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { isAslabRole } from '@/types/user';
import {
  ensureDefaultLaboratories,
  subscribeLaboratories,
  updateLaboratory,
  validateLaboratoryInput,
  type LaboratoryLocation,
} from '@/features/assistant/services/laboratory-service';

interface LaboratoryFormState {
  latitude: string;
  longitude: string;
  radius: string;
}

const EMPTY_FORM: LaboratoryFormState = {
  latitude: '',
  longitude: '',
  radius: '',
};

const NUMERIC_INPUT_PATTERN = /^[+-]?\d+(\.\d+)?$/;

function parseNumericField(rawValue: string, fieldLabel: string): number {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error(`${fieldLabel} wajib diisi.`);
  }

  const normalized = !trimmed.includes('.')
    ? trimmed.replace(',', '.')
    : trimmed;

  if (!NUMERIC_INPUT_PATTERN.test(normalized)) {
    throw new Error(`${fieldLabel} harus berupa angka yang valid.`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} harus berupa angka yang valid.`);
  }

  return parsed;
}

function formatCoordinate(value: number): string {
  return value.toFixed(6);
}


function LocationIcon({
  name,
  size = 18,
  color = '#000000',
}: {
  name: 'pin' | 'check' | 'alert';
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'pin' && (
        <>
          <Path
            d="M20 10C20 15.5 12 21 12 21S4 15.5 4 10A8 8 0 1 1 20 10Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={1.8} />
        </>
      )}

      {name === 'check' && (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
          <Path
            d="M8.5 12.2L10.8 14.5L15.8 9.5"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {name === 'alert' && (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
          <Path
            d="M12 7.5V13"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Circle cx={12} cy={16.5} r={1} fill={color} />
        </>
      )}
    </Svg>
  );
}

export default function AssistantLaboratoriesScreen() {
  return (
    <AslabRoleGuard featureName="Pengaturan Lokasi Laboratorium">
      <AssistantLaboratoriesContent />
    </AslabRoleGuard>
  );
}

function AssistantLaboratoriesContent() {
  const { profile, loading: authLoading } = useAuth();

  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const [pageError, setPageError] = useState('');
  const [pageMessage, setPageMessage] = useState('');

  const [editingLab, setEditingLab] = useState<LaboratoryLocation | null>(null);
  const [form, setForm] = useState<LaboratoryFormState>(EMPTY_FORM);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRetry = useCallback(() => {
    setPageError('');
    setRetryNonce((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!profile || !isAslabRole(profile.role)) {
      setLaboratories([]);
      setLoading(false);
      setSeeding(false);
      return;
    }

    let active = true;
    setLoading(true);
    setSeeding(true);
    setPageError('');

    const unsubscribe = subscribeLaboratories(
      (data) => {
        if (!active) return;
        setLaboratories(data);
        setLoading(false);
      },
      (firebaseError) => {
        if (!active) return;
        setPageError(firebaseError.message);
        setLoading(false);
      },
    );

    ensureDefaultLaboratories()
      .then(() => {
        if (!active) return;
        setSeeding(false);
      })
      .catch((seedError: unknown) => {
        if (!active) return;
        setSeeding(false);
        setLoading(false);
        setPageError(
          seedError instanceof Error
            ? seedError.message
            : 'Gagal menginisialisasi lokasi laboratorium.',
        );
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, profile, retryNonce]);

  function openEditModal(item: LaboratoryLocation) {
    setPageMessage('');
    setModalError('');
    setEditingLab(item);
    setForm({
      latitude: String(item.latitude),
      longitude: String(item.longitude),
      radius: String(item.radius),
    });
  }

  function closeEditModal() {
    if (saving) return;
    setEditingLab(null);
    setForm(EMPTY_FORM);
    setModalError('');
  }

  function updateField(field: keyof LaboratoryFormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    if (modalError) {
      setModalError('');
    }
  }

  async function handleSave() {
    if (!editingLab || saving) return;

    let validatedInput: ReturnType<typeof validateLaboratoryInput>;
    try {
      const latitude = parseNumericField(form.latitude, 'Latitude');
      const longitude = parseNumericField(form.longitude, 'Longitude');
      const radius = parseNumericField(form.radius, 'Radius presensi');

      validatedInput = validateLaboratoryInput({
        latitude,
        longitude,
        radius,
      });
    } catch (validationError) {
      setModalError(
        validationError instanceof Error
          ? validationError.message
          : 'Input lokasi tidak valid.',
      );
      return;
    }

    try {
      setSaving(true);
      setModalError('');
      setPageError('');

      await updateLaboratory(editingLab.id, validatedInput);

      const updatedName = editingLab.name;
      setEditingLab(null);
      setForm(EMPTY_FORM);
      setPageMessage(
        `Lokasi "${updatedName}" berhasil diperbarui (radius ${validatedInput.radius} m).`,
      );
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan pengaturan lokasi laboratorium.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#111014" />
        <Text style={styles.mutedText}>Memeriksa akun...</Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Belum Login</Text>
        <Text style={styles.mutedText}>
          Silakan login terlebih dahulu untuk mengelola lokasi laboratorium.
        </Text>
      </SafeAreaView>
    );
  }

  if (!isAslabRole(profile.role)) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman ini hanya dapat diakses oleh Asisten Lab (Aslab).
        </Text>
      </SafeAreaView>
    );
  }

  const isWaitingForInitialData =
    (loading || (seeding && laboratories.length === 0)) && !pageError;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AssistantHeader />

        <View style={styles.pageContent}>
          {/* JUDUL HALAMAN */}
          <View style={styles.header}>
            <Text style={styles.title}>Pengaturan Lokasi Lab</Text>
            <Text style={styles.subtitle}>
              Atur titik koordinat dan radius presensi untuk ke-4 lokasi
              praktikum tetap. Perubahan langsung berlaku secara real-time.
            </Text>
          </View>

          {/* PESAN SUKSES */}
          {pageMessage ? (
            <View style={styles.successBox}>
              <LocationIcon name="check" size={18} color="#FFFFFF" />
              <Text style={styles.successText}>{pageMessage}</Text>
            </View>
          ) : null}

          {/* PESAN ERROR */}
          {pageError ? (
            <View style={styles.errorBox}>
              <View style={styles.errorHeader}>
                <LocationIcon name="alert" size={18} color="#FFFFFF" />
                <Text style={styles.errorText}>{pageError}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleRetry}
              >
                <Text style={styles.retryButtonText}>Coba Lagi</Text>
              </Pressable>
            </View>
          ) : null}

          {/* DAFTAR LOKASI */}
          {isWaitingForInitialData ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color="#111014" />
              <Text style={styles.mutedText}>
                Memuat data lokasi laboratorium...
              </Text>
            </View>
          ) : laboratories.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Data Lokasi Belum Tersedia</Text>
              <Text style={styles.mutedText}>
                Tidak dapat memuat ke-4 titik lokasi laboratorium dari Firestore.
              </Text>
            </View>
          ) : (
            laboratories.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit lokasi ${item.name}`}
                style={({ pressed }) => [
                  styles.labCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => openEditModal(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.labTitleRow}>
                    <LocationIcon name="pin" size={20} color="#FFFFFF" />
                    <View style={styles.labTitleText}>
                      <Text style={styles.labName}>{item.name}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.coordBox}>
                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>LATITUDE</Text>
                    <Text style={styles.coordValue}>
                      {formatCoordinate(item.latitude)}
                    </Text>
                  </View>

                  <View style={styles.coordDivider} />

                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>LONGITUDE</Text>
                    <Text style={styles.coordValue}>
                      {formatCoordinate(item.longitude)}
                    </Text>
                  </View>

                  <View style={styles.coordDivider} />

                  <View style={styles.coordItem}>
                    <Text style={styles.coordLabel}>RADIUS</Text>
                    <Text style={styles.coordValue}>{item.radius} meter</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* =====================================
          MODAL EDIT KOORDINAT & RADIUS LAB
      ===================================== */}
      <Modal
        animationType="slide"
        transparent
        visible={editingLab !== null}
        onRequestClose={closeEditModal}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboard}
          behavior="padding"
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeEditModal}
              disabled={saving}
            />

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Edit Lokasi Laboratorium
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {editingLab
                      ? `${editingLab.name}`
                      : 'Perbarui titik koordinat dan radius presensi.'}
                  </Text>
                </View>

                {/* INPUT LATITUDE */}
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  value={form.latitude}
                  onChangeText={(value) => updateField('latitude', value)}
                  placeholder="Contoh: -7.0482375"
                  placeholderTextColor="#8E8E93"
                  keyboardType={
                    Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  editable={!saving}
                  returnKeyType="next"
                />
                <Text style={styles.fieldHint}>
                  Angka desimal antara -90 s.d. 90 (mendukung tanda minus).
                </Text>

                {/* INPUT LONGITUDE */}
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  value={form.longitude}
                  onChangeText={(value) => updateField('longitude', value)}
                  placeholder="Contoh: 110.440765625"
                  placeholderTextColor="#8E8E93"
                  keyboardType={
                    Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  editable={!saving}
                  returnKeyType="next"
                />
                <Text style={styles.fieldHint}>
                  Angka desimal antara -180 s.d. 180.
                </Text>

                {/* INPUT RADIUS */}
                <Text style={styles.inputLabel}>Radius Presensi (meter)</Text>
                <TextInput
                  value={form.radius}
                  onChangeText={(value) => updateField('radius', value)}
                  placeholder="Contoh: 50"
                  placeholderTextColor="#8E8E93"
                  keyboardType={
                    Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  editable={!saving}
                  onSubmitEditing={() => void handleSave()}
                  returnKeyType="done"
                />
                <Text style={styles.fieldHint}>
                  Jarak maksimal presensi praktikan dalam meter (harus {'>'} 0).
                </Text>

                {/* ERROR MODAL */}
                {modalError ? (
                  <View style={styles.modalErrorBox}>
                    <LocationIcon name="alert" size={16} color="#FFFFFF" />
                    <Text style={styles.modalError}>{modalError}</Text>
                  </View>
                ) : null}

                {/* TOMBOL AKSI MODAL */}
                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cancelButton,
                      pressed && !saving && styles.pressed,
                      saving && styles.disabledButton,
                    ]}
                    onPress={closeEditModal}
                    disabled={saving}
                  >
                    <Text style={styles.cancelText}>Batal</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && !saving && styles.pressed,
                      saving && styles.disabledButton,
                    ]}
                    onPress={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? (
                      <View style={styles.savingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.saveText}>Menyimpan...</Text>
                      </View>
                    ) : (
                      <Text style={styles.saveText}>Simpan Lokasi</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  pageContent: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 25,
  },
  centeredContent: {
    alignItems: 'center',
    gap: 10,
    padding: 32,
  },

  header: {
    gap: 6,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 27,
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
  },



  successBox: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  successText: {
    fontFamily: FONT.semibold,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: '#E00000',
    borderRadius: 11,
    gap: 10,
    padding: 12,
  },
  errorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  errorText: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },


  labCard: {
    backgroundColor: '#F47321',
    borderRadius: 26,
    gap: 14,
    padding: 18,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  labTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  labTitleText: {
    flex: 1,
    gap: 2,
  },
  labName: {
    fontFamily: FONT.extrabold,
    color: '#FFFFFF',
    fontSize: 16,
  },

  coordBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 12,
  },
  coordItem: {
    flex: 1,
    gap: 4,
  },
  coordDivider: {
    backgroundColor: '#E4E4E7',
    marginHorizontal: 8,
    width: 1,
  },
  coordLabel: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  coordValue: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
  },


  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 8,
    padding: 20,
    borderColor: '#8E8E93',
    borderWidth: 1,
  },
  emptyTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 16,
  },
  mutedText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.68,
  },
  disabledButton: {
    opacity: 0.55,
  },

  modalKeyboard: {
    flex: 1,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
    padding: 22,
    paddingBottom: 32,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#8E8E93',
    borderRadius: 5,
    height: 5,
    marginBottom: 8,
    width: 42,
  },
  modalHeader: {
    gap: 4,
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: FONT.extrabold,
    color: '#111014',
    fontSize: 21,
  },
  modalSubtitle: {
    fontFamily: FONT.semibold,
    color: '#5F5F66',
    fontSize: 13,
  },

  inputLabel: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 13,
    marginTop: 6,
  },
  input: {
    fontFamily: FONT.regular,
    backgroundColor: '#FFFFFF',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    color: '#111014',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldHint: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 11,
    lineHeight: 16,
  },

  modalErrorBox: {
    alignItems: 'center',
    backgroundColor: '#E00000',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    padding: 11,
  },
  modalError: {
    fontFamily: FONT.regular,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#8E8E93',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    padding: 13,
  },
  cancelText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#F47321',
    borderRadius: 11,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    padding: 13,
  },
  savingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveText: {
    fontFamily: FONT.bold,
    color: '#FFFFFF',
    fontSize: 14,
  },
});
