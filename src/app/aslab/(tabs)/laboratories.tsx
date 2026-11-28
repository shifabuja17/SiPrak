import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONT } from '@/constants/fonts';
import { useAuth } from '@/context/AuthContext';
import { parseLocaleNumber } from '@/features/bulk';
import {
  Chip,
  MetaLine,
  PillButton,
  ScreenTitle,
  SoftCard,
  TAB_BAR_SPACE,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';
import {
  createLaboratory,
  ensureDefaultLaboratories,
  subscribeLaboratories,
  type LaboratoryLocation,
} from '@/services/laboratory-service';

function isAslabRole(rawRole: unknown): boolean {
  return typeof rawRole === 'string' && rawRole.trim().toUpperCase() === 'ASLAB';
}

function formatRupiah(amount: number): string {
  return `Rp ${Math.max(0, Math.round(amount)).toLocaleString('id-ID')}`;
}

interface SingleLabFormState {
  nama: string;
  mataKuliahId: string;
  lokasi: string;
  lat: string;
  lng: string;
  radius: string;
  gracePeriodMenit: string;
  nominalDenda: string;
}

const INITIAL_SINGLE_FORM: SingleLabFormState = {
  nama: '',
  mataKuliahId: '',
  lokasi: '',
  lat: '-7.0482375',
  lng: '110.4407656',
  radius: '50',
  gracePeriodMenit: '15',
  nominalDenda: '5000',
};

/**
 * Halaman Manajemen Laboratorium khusus Aslab (`ASLAB`) dengan akses
 * berdampingan untuk Tambah Laboratorium (Single) dan Bulk Insert Laboratorium.
 */
export default function AslabLaboratoriesScreen() {
  const { profile, loading: authLoading } = useAuth();
  const isAuthorized = isAslabRole(profile?.role);

  const [laboratories, setLaboratories] = useState<LaboratoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);

  // Modal Tambah Laboratorium (Single)
  const [singleModalVisible, setSingleModalVisible] = useState(false);
  const [form, setForm] = useState<SingleLabFormState>(INITIAL_SINGLE_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingSingle, setSavingSingle] = useState(false);

  const handleRetry = useCallback(() => {
    setPageError(null);
    setRetryNonce((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!profile || !isAuthorized) {
      setLaboratories([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setPageError(null);

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

    ensureDefaultLaboratories().catch((seedError: unknown) => {
      if (!active) return;
      setPageError(
        seedError instanceof Error
          ? seedError.message
          : 'Gagal menginisialisasi data laboratorium awal.',
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authLoading, profile, isAuthorized, retryNonce]);

  const filteredLabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return laboratories;
    return laboratories.filter(
      (lab) =>
        lab.nama.toLowerCase().includes(q) ||
        lab.mataKuliahId.toLowerCase().includes(q) ||
        lab.lokasi.toLowerCase().includes(q),
    );
  }, [laboratories, searchQuery]);

  async function handleSubmitSingle() {
    setFormError(null);
    try {
      const lat = parseLocaleNumber(form.lat);
      const lng = parseLocaleNumber(form.lng);
      const radius = parseLocaleNumber(form.radius);
      const gracePeriodMenit = parseLocaleNumber(form.gracePeriodMenit);
      const nominalDenda = parseLocaleNumber(form.nominalDenda);

      setSavingSingle(true);
      await createLaboratory({
        nama: form.nama,
        mataKuliahId: form.mataKuliahId,
        lokasi: form.lokasi,
        lat,
        lng,
        radius,
        gracePeriodMenit,
        nominalDenda,
      });

      setSingleModalVisible(false);
      setForm(INITIAL_SINGLE_FORM);
      setPageMessage(
        `Laboratorium "${form.nama.trim()}" berhasil ditambahkan dan langsung tampil real-time.`,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Gagal menambahkan laboratorium.',
      );
    } finally {
      setSavingSingle(false);
    }
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={UI.ink} />
        <Text style={styles.mutedText}>Memeriksa akses akun...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !isAuthorized) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.emptyTitle}>Akses Ditolak</Text>
        <Text style={styles.mutedText}>
          Halaman Manajemen Laboratorium hanya dapat diakses oleh Asisten Lab
          (Aslab).
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle
          title="Manajemen Laboratorium"
          subtitle="Kelola daftar laboratorium secara real-time melalui input satuan atau import CSV/XLSX."
        />

        {/* TOMBOL AKSI SINGLE & BULK BERDAMPINGAN */}
        <View style={styles.actionRow}>
          <PillButton
            label="+ Tambah Laboratorium (Single)"
            variant="dark"
            onPress={() => {
              setFormError(null);
              setForm(INITIAL_SINGLE_FORM);
              setSingleModalVisible(true);
            }}
            style={styles.actionButton}
          />
          <PillButton
            label="Bulk Insert Laboratorium"
            variant="accent"
            onPress={() => router.push('/aslab/bulk-laboratories' as Href)}
            style={styles.actionButton}
          />
        </View>

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Cari nama lab, kode mata kuliah, atau lokasi..."
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          style={styles.searchInput}
        />

        {pageMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{pageMessage}</Text>
          </View>
        ) : null}

        {pageError ? (
          <SoftCard style={styles.errorCard}>
            <Text style={styles.errorText}>{pageError}</Text>
            <PillButton
              label="Coba Lagi"
              variant="outline"
              onPress={handleRetry}
            />
          </SoftCard>
        ) : null}

        {loading && laboratories.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={UI.ink} />
            <Text style={styles.mutedText}>Memuat daftar laboratorium...</Text>
          </View>
        ) : filteredLabs.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim()
                ? 'Tidak Ada Hasil Pencarian'
                : 'Belum Ada Laboratorium'}
            </Text>
            <Text style={styles.mutedText}>
              {searchQuery.trim()
                ? 'Coba kata kunci pencarian lain.'
                : 'Gunakan Tambah Laboratorium (Single) atau Bulk Insert Laboratorium.'}
            </Text>
          </SoftCard>
        ) : (
          filteredLabs.map((lab) => (
            <SoftCard key={lab.id} style={styles.labCard}>
              <View style={styles.labHeader}>
                <Text style={styles.labName}>{lab.nama}</Text>
                {lab.mataKuliahId ? (
                  <Chip label={lab.mataKuliahId} tone="accent" />
                ) : (
                  <Chip label="Umum" tone="soft" />
                )}
              </View>

              {lab.lokasi ? (
                <MetaLine icon="place" color={UI.muted} textStyle={styles.metaText}>
                  {lab.lokasi}
                </MetaLine>
              ) : null}

              <View style={styles.labGrid}>
                <Text style={styles.labDetail}>
                  Koordinat: {lab.lat.toFixed(6)}, {lab.lng.toFixed(6)}
                </Text>
                <Text style={styles.labDetail}>Radius: {lab.radius} m</Text>
                <Text style={styles.labDetail}>
                  Grace Period: {lab.gracePeriodMenit} menit
                </Text>
                <Text style={styles.labDetail}>
                  Denda: {formatRupiah(lab.nominalDenda)}
                </Text>
              </View>
            </SoftCard>
          ))
        )}
      </ScrollView>

      {/* MODAL TAMBAH LABORATORIUM SINGLE */}
      <Modal
        visible={singleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingSingle) setSingleModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tambah Laboratorium (Single)</Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {formError ? (
                <View style={styles.formErrorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nama Laboratorium *</Text>
                <TextInput
                  value={form.nama}
                  onChangeText={(nama) => setForm((p) => ({ ...p, nama }))}
                  placeholder="Contoh: Lab E Informatika"
                  placeholderTextColor="#9CA3AF"
                  editable={!savingSingle}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Kode Mata Kuliah *</Text>
                <TextInput
                  value={form.mataKuliahId}
                  onChangeText={(mataKuliahId) =>
                    setForm((p) => ({ ...p, mataKuliahId }))
                  }
                  placeholder="Contoh: IF201-PBO"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  editable={!savingSingle}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Lokasi / Gedung</Text>
                <TextInput
                  value={form.lokasi}
                  onChangeText={(lokasi) => setForm((p) => ({ ...p, lokasi }))}
                  placeholder="Gedung E FSM Lantai 2"
                  placeholderTextColor="#9CA3AF"
                  editable={!savingSingle}
                  style={styles.input}
                />
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, styles.halfField]}>
                  <Text style={styles.fieldLabel}>Latitude *</Text>
                  <TextInput
                    value={form.lat}
                    onChangeText={(lat) => setForm((p) => ({ ...p, lat }))}
                    keyboardType="decimal-pad"
                    editable={!savingSingle}
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, styles.halfField]}>
                  <Text style={styles.fieldLabel}>Longitude *</Text>
                  <TextInput
                    value={form.lng}
                    onChangeText={(lng) => setForm((p) => ({ ...p, lng }))}
                    keyboardType="decimal-pad"
                    editable={!savingSingle}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.fieldGroup, styles.halfField]}>
                  <Text style={styles.fieldLabel}>Radius (m) *</Text>
                  <TextInput
                    value={form.radius}
                    onChangeText={(radius) => setForm((p) => ({ ...p, radius }))}
                    keyboardType="numeric"
                    editable={!savingSingle}
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, styles.halfField]}>
                  <Text style={styles.fieldLabel}>Grace (menit) *</Text>
                  <TextInput
                    value={form.gracePeriodMenit}
                    onChangeText={(gracePeriodMenit) =>
                      setForm((p) => ({ ...p, gracePeriodMenit }))
                    }
                    keyboardType="numeric"
                    editable={!savingSingle}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Nominal Denda (Rp) *</Text>
                <TextInput
                  value={form.nominalDenda}
                  onChangeText={(nominalDenda) =>
                    setForm((p) => ({ ...p, nominalDenda }))
                  }
                  keyboardType="numeric"
                  editable={!savingSingle}
                  style={styles.input}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <PillButton
                label="Batal"
                variant="outline"
                disabled={savingSingle}
                onPress={() => setSingleModalVisible(false)}
                style={styles.modalActionButton}
              />
              <PillButton
                label="Simpan"
                variant="dark"
                loading={savingSingle}
                onPress={handleSubmitSingle}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: UI.page,
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: UI.page,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: TAB_BAR_SPACE,
    paddingHorizontal: UI.padding,
    paddingTop: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  searchInput: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 16,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  successBanner: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  successBannerText: {
    color: '#9A3412',
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  errorCard: {
    borderColor: UI.danger,
    gap: 10,
  },
  errorText: {
    color: UI.danger,
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 17,
  },
  mutedText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  labCard: {
    gap: 8,
    padding: 16,
  },
  labHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  labName: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.extrabold,
    fontSize: 16,
  },
  metaText: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  labGrid: {
    backgroundColor: UI.soft,
    borderRadius: 12,
    gap: 4,
    padding: 10,
  },
  labDetail: {
    color: UI.ink,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(17, 16, 20, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: UI.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 12,
    maxHeight: '88%',
    paddingBottom: 20,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#D4D4D8',
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  modalTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 19,
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  formErrorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    color: UI.ink,
    fontFamily: FONT.semibold,
    fontSize: 12,
  },
  input: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 12,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalActionButton: {
    flex: 1,
  },
});
