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
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_LABORATORIES,
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

function formatUpdatedAt(date: Date | null): string {
  if (!date) {
    return 'Baru diinisialisasi';
  }

  return (
    date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' WIB'
  );
}

function LocationIcon({
  name,
  size = 18,
  color = '#000000',
}: {
  name: 'pin' | 'check' | 'alert' | 'edit';
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

      {name === 'edit' && (
        <Path
          d="M4 20H8L18.5 9.5A2.121 2.121 0 0 0 15.5 6.5L5 17V20Z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

export default function AssistantLaboratoriesScreen() {
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

    if (!profile || profile.role !== 'asisten') {
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
        <ActivityIndicator size="large" color="#000000" />
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

  if (profile.role !== 'asisten') {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman ini hanya dapat diakses oleh Asisten.
        </Text>
      </SafeAreaView>
    );
  }

  const isWaitingForInitialData =
    (loading || (seeding && laboratories.length === 0)) && !pageError;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AssistantHeader />

        <View style={styles.pageContent}>
          {/* JUDUL HALAMAN */}
          <View style={styles.header}>
            <Text style={styles.pageSubtitle}>MANAJEMEN PRAKTIKUM</Text>
            <Text style={styles.title}>Pengaturan Lokasi Lab</Text>
            <Text style={styles.subtitle}>
              Atur titik koordinat dan radius presensi untuk ke-4 lokasi
              praktikum tetap. Perubahan langsung berlaku secara real-time.
            </Text>
          </View>

          {/* INFO LOKASI TETAP */}
          <View style={styles.infoBanner}>
            <LocationIcon name="pin" size={18} color="#333333" />
            <Text style={styles.infoBannerText}>
              Terdapat {DEFAULT_LABORATORIES.length} titik lokasi tetap. Pilih
              salah satu kartu di bawah untuk memperbarui koordinat dan radius.
            </Text>
          </View>

          {/* PESAN SUKSES */}
          {pageMessage ? (
            <View style={styles.successBox}>
              <LocationIcon name="check" size={18} color="#315A35" />
              <Text style={styles.successText}>{pageMessage}</Text>
            </View>
          ) : null}

          {/* PESAN ERROR */}
          {pageError ? (
            <View style={styles.errorBox}>
              <View style={styles.errorHeader}>
                <LocationIcon name="alert" size={18} color="#991B1B" />
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

          {/* HEADER DAFTAR */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionInfo}>
              <Text style={styles.sectionTitle}>Daftar Lokasi Lab</Text>
              <Text style={styles.sectionCaption}>
                Pilih lokasi untuk mengubah latitude, longitude, dan radius.
              </Text>
            </View>

            <View style={styles.totalBadge}>
              <Text style={styles.totalText}>
                {laboratories.length}/{DEFAULT_LABORATORIES.length} lokasi
              </Text>
            </View>
          </View>

          {/* DAFTAR LOKASI */}
          {isWaitingForInitialData ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color="#000000" />
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
                    <View style={styles.labIconBox}>
                      <LocationIcon name="pin" size={19} color="#000000" />
                    </View>
                    <View style={styles.labTitleText}>
                      <Text style={styles.labName}>{item.name}</Text>
                      <Text style={styles.labIdText}>ID: {item.id}</Text>
                    </View>
                  </View>

                  <View style={styles.radiusBadge}>
                    <Text style={styles.radiusBadgeText}>
                      {item.radius} m
                    </Text>
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

                <View style={styles.cardFooter}>
                  <Text style={styles.updatedText}>
                    Diperbarui: {formatUpdatedAt(item.updatedAt)}
                  </Text>

                  <View style={styles.editPill}>
                    <LocationIcon name="edit" size={14} color="#000000" />
                    <Text style={styles.editPillText}>Ubah Lokasi</Text>
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeEditModal}
              disabled={saving}
            />

            <ScrollView
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
                      ? `${editingLab.name} (${editingLab.id})`
                      : 'Perbarui titik koordinat dan radius presensi.'}
                  </Text>
                </View>

                {/* INPUT LATITUDE */}
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  value={form.latitude}
                  onChangeText={(value) => updateField('latitude', value)}
                  placeholder="Contoh: -7.04817"
                  placeholderTextColor="#888888"
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
                  placeholder="Contoh: 110.44140"
                  placeholderTextColor="#888888"
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
                  placeholderTextColor="#888888"
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
                    <LocationIcon name="alert" size={16} color="#991B1B" />
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
    backgroundColor: '#F7F7F9',
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  pageContent: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 25,
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
  pageSubtitle: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: '#000000',
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },

  infoBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#EEEEF1',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 10,
    padding: 13,
  },
  infoBannerText: {
    color: '#444444',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },

  successBox: {
    alignItems: 'center',
    backgroundColor: '#E8F0E8',
    borderRadius: 11,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  successText: {
    color: '#315A35',
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },

  errorBox: {
    backgroundColor: '#FEE2E2',
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
    color: '#991B1B',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#991B1B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionInfo: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 19,
    fontWeight: '800',
  },
  sectionCaption: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
  },
  totalBadge: {
    backgroundColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  totalText: {
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },

  labCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 17,
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
    gap: 11,
  },
  labIconBox: {
    alignItems: 'center',
    backgroundColor: '#EFEFF2',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  labTitleText: {
    flex: 1,
    gap: 2,
  },
  labName: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  labIdText: {
    color: '#777777',
    fontSize: 11,
  },
  radiusBadge: {
    backgroundColor: '#000000',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  radiusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  coordBox: {
    backgroundColor: '#F1F1F3',
    borderRadius: 12,
    flexDirection: 'row',
    padding: 12,
  },
  coordItem: {
    flex: 1,
    gap: 4,
  },
  coordDivider: {
    backgroundColor: '#DCDCE0',
    marginHorizontal: 8,
    width: 1,
  },
  coordLabel: {
    color: '#777777',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  coordValue: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },

  cardFooter: {
    alignItems: 'center',
    borderTopColor: '#EEEEEE',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  updatedText: {
    color: '#777777',
    flex: 1,
    fontSize: 11,
  },
  editPill: {
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    borderColor: '#D4D4D8',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#EEEEF1',
    borderRadius: 17,
    gap: 8,
    padding: 25,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },
  mutedText: {
    color: '#666666',
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
    backgroundColor: '#DDDDDD',
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
    color: '#000000',
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#666666',
    fontSize: 13,
    fontWeight: '600',
  },

  inputLabel: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderColor: '#DDDDDD',
    borderRadius: 11,
    borderWidth: 1,
    color: '#000000',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fieldHint: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
  },

  modalErrorBox: {
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    padding: 11,
  },
  modalError: {
    color: '#991B1B',
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
    borderColor: '#CCCCCC',
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    padding: 13,
  },
  cancelText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: '#000000',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
