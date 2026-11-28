import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FONT } from '@/constants/fonts';
import { UI } from '@/features/praktikan/ui/praktikan-ui';
import type { Laboratory, LaboratoryPayload } from '@/types/laboratory';

import {
  EMPTY_LABORATORY_FORM,
  laboratoryToFormValues,
  validateLaboratoryForm,
  type LaboratoryFormErrors,
  type LaboratoryFormValues,
} from '../utils/laboratory-form';

interface LaboratoryFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  initialLab: Laboratory | null;
  existingCourses: string[];
  saving: boolean;
  submitError: string;
  onClose: () => void;
  onSubmit: (payload: LaboratoryPayload, applyPolicyToCourse: boolean) => Promise<void>;
}

/**
 * Modal form Tambah & Edit Laboratorium khusus Aslab (FR-02 & FR-12).
 */
export default function LaboratoryFormModal({
  visible,
  mode,
  initialLab,
  existingCourses,
  saving,
  submitError,
  onClose,
  onSubmit,
}: LaboratoryFormModalProps) {
  const [values, setValues] = useState<LaboratoryFormValues>(EMPTY_LABORATORY_FORM);
  const [errors, setErrors] = useState<LaboratoryFormErrors>({});
  const [applyPolicyToCourse, setApplyPolicyToCourse] = useState(false);
  const [mapPickerNoticeVisible, setMapPickerNoticeVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setValues(
      mode === 'edit' && initialLab
        ? laboratoryToFormValues(initialLab)
        : EMPTY_LABORATORY_FORM,
    );
    setErrors({});
    setApplyPolicyToCourse(false);
    setMapPickerNoticeVisible(false);
  }, [visible, mode, initialLab]);

  function updateField(field: keyof LaboratoryFormValues, nextValue: string) {
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit() {
    if (saving) return;

    const result = validateLaboratoryForm(values);
    if (!result.payload) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    await onSubmit(result.payload, applyPolicyToCourse);
  }

  const numericKeyboard =
    Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';
  const decimalKeyboard = Platform.OS === 'ios' ? 'decimal-pad' : 'numeric';

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!saving) onClose();
            }}
            disabled={saving}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.card}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <Text style={styles.title}>
                  {mode === 'create' ? 'Tambah Laboratorium' : 'Edit Laboratorium'}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === 'create'
                    ? 'Lengkapi identitas lab, titik koordinat presensi, dan aturan denda.'
                    : `Perbarui konfigurasi untuk ${initialLab?.nama ?? 'laboratorium'}.`}
                </Text>
              </View>

              {/* NAMA LABORATORIUM */}
              <FieldLabel label="Nama Laboratorium" required />
              <TextInput
                value={values.nama}
                onChangeText={(text) => updateField('nama', text)}
                placeholder="Contoh: Lab B Informatika"
                placeholderTextColor={UI.border}
                style={[styles.input, errors.nama && styles.inputError]}
                editable={!saving}
              />
              <FieldError message={errors.nama} />

              {/* MATA KULIAH */}
              <FieldLabel label="Mata Kuliah (ID / Kode)" required />
              <TextInput
                value={values.mataKuliahId}
                onChangeText={(text) => updateField('mataKuliahId', text)}
                placeholder="Contoh: IF-201 atau PM-A"
                placeholderTextColor={UI.border}
                autoCapitalize="characters"
                style={[styles.input, errors.mataKuliahId && styles.inputError]}
                editable={!saving}
              />
              {existingCourses.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.courseChipRow}
                >
                  {existingCourses.map((course) => {
                    const active = values.mataKuliahId.trim() === course;
                    return (
                      <Pressable
                        key={course}
                        disabled={saving}
                        onPress={() => updateField('mataKuliahId', course)}
                        style={[
                          styles.courseChip,
                          active && styles.courseChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.courseChipText,
                            active && styles.courseChipTextActive,
                          ]}
                        >
                          {course}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              <FieldError message={errors.mataKuliahId} />

              {/* LOKASI */}
              <FieldLabel label="Nama Lokasi / Ruangan" />
              <TextInput
                value={values.lokasi}
                onChangeText={(text) => updateField('lokasi', text)}
                placeholder="Contoh: Gedung E Lantai 2, FSM UNDIP"
                placeholderTextColor={UI.border}
                style={[styles.input, errors.lokasi && styles.inputError]}
                editable={!saving}
              />
              <FieldError message={errors.lokasi} />

              {/* KOORDINAT & PLACEHOLDER FR-11 */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Titik Koordinat Presensi</Text>
                {/* // TODO: FR-11 — Integrasi modal pemilih koordinat di peta */}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => setMapPickerNoticeVisible((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.mapPlaceholderBtn,
                    pressed && !saving && styles.pressed,
                  ]}
                >
                  <Text style={styles.mapPlaceholderBtnText}>Pilih di Peta</Text>
                </Pressable>
              </View>

              {mapPickerNoticeVisible ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    Pemilih koordinat langsung di peta akan tersedia pada tahap FR-11.
                    Untuk sementara, masukkan nilai Latitude dan Longitude secara manual.
                  </Text>
                </View>
              ) : null}

              <View style={styles.row}>
                <View style={styles.col}>
                  <FieldLabel label="Latitude" required />
                  <TextInput
                    value={values.lat}
                    onChangeText={(text) => updateField('lat', text)}
                    placeholder="-7.0482375"
                    placeholderTextColor={UI.border}
                    keyboardType={numericKeyboard}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, errors.lat && styles.inputError]}
                    editable={!saving}
                  />
                  <FieldError message={errors.lat} />
                </View>

                <View style={styles.col}>
                  <FieldLabel label="Longitude" required />
                  <TextInput
                    value={values.lng}
                    onChangeText={(text) => updateField('lng', text)}
                    placeholder="110.4407656"
                    placeholderTextColor={UI.border}
                    keyboardType={numericKeyboard}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, errors.lng && styles.inputError]}
                    editable={!saving}
                  />
                  <FieldError message={errors.lng} />
                </View>
              </View>

              {/* RADIUS */}
              <FieldLabel label="Radius Presensi (meter)" required />
              <TextInput
                value={values.radius}
                onChangeText={(text) => updateField('radius', text)}
                placeholder="50"
                placeholderTextColor={UI.border}
                keyboardType={decimalKeyboard}
                autoCapitalize="none"
                style={[styles.input, errors.radius && styles.inputError]}
                editable={!saving}
              />
              <FieldError message={errors.radius} />

              {/* GRACE PERIOD & DENDA */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <FieldLabel label="Grace Period (menit)" required />
                  <TextInput
                    value={values.gracePeriodMenit}
                    onChangeText={(text) => updateField('gracePeriodMenit', text)}
                    placeholder="0"
                    placeholderTextColor={UI.border}
                    keyboardType="number-pad"
                    style={[styles.input, errors.gracePeriodMenit && styles.inputError]}
                    editable={!saving}
                  />
                  <FieldError message={errors.gracePeriodMenit} />
                </View>

                <View style={styles.col}>
                  <FieldLabel label="Nominal Denda (Rp)" required />
                  <TextInput
                    value={values.nominalDenda}
                    onChangeText={(text) => updateField('nominalDenda', text)}
                    placeholder="0"
                    placeholderTextColor={UI.border}
                    keyboardType="number-pad"
                    style={[styles.input, errors.nominalDenda && styles.inputError]}
                    editable={!saving}
                  />
                  <FieldError message={errors.nominalDenda} />
                </View>
              </View>

              {/* TERAPKAN KE SEMUA LAB DI MATA KULIAH INI */}
              <Pressable
                disabled={saving}
                onPress={() => setApplyPolicyToCourse((prev) => !prev)}
                style={styles.policyToggleCard}
              >
                <View style={styles.policyToggleTextWrap}>
                  <Text style={styles.policyToggleTitle}>
                    Terapkan ke Semua Lab di Mata Kuliah Ini
                  </Text>
                  <Text style={styles.policyToggleHint}>
                    Salin durasi grace period &amp; nominal denda ini ke semua laboratorium
                    dengan mata kuliah yang sama.
                  </Text>
                </View>
                <Switch
                  value={applyPolicyToCourse}
                  onValueChange={setApplyPolicyToCourse}
                  disabled={saving}
                  trackColor={{ false: '#D4D4D8', true: UI.accent }}
                  thumbColor="#FFFFFF"
                />
              </Pressable>

              {submitError ? (
                <View style={styles.submitErrorBox}>
                  <Text style={styles.submitErrorText}>{submitError}</Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  onPress={onClose}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && !saving && styles.pressed,
                    saving && styles.disabled,
                  ]}
                >
                  <Text style={styles.cancelText}>Batal</Text>
                </Pressable>

                <Pressable
                  onPress={() => void handleSubmit()}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && !saving && styles.pressed,
                    saving && styles.disabled,
                  ]}
                >
                  {saving ? (
                    <View style={styles.savingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.saveText}>Menyimpan...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveText}>
                      {mode === 'create' ? 'Simpan Laboratorium' : 'Simpan Perubahan'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.requiredMark}> *</Text> : null}
    </Text>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
    maxHeight: '92%',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: UI.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 6,
    padding: 22,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: UI.border,
    borderRadius: 5,
    height: 5,
    marginBottom: 8,
    width: 42,
  },
  header: {
    gap: 4,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 21,
  },
  subtitle: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 13,
    marginTop: 8,
  },
  requiredMark: {
    color: UI.danger,
  },
  input: {
    fontFamily: FONT.regular,
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 11,
    borderWidth: 1,
    color: UI.ink,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputError: {
    borderColor: UI.danger,
  },
  fieldError: {
    fontFamily: FONT.regular,
    color: UI.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  courseChipRow: {
    gap: 6,
    paddingTop: 4,
  },
  courseChip: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  courseChipActive: {
    backgroundColor: UI.ink,
    borderColor: UI.ink,
  },
  courseChipText: {
    fontFamily: FONT.semibold,
    color: UI.ink,
    fontSize: 12,
  },
  courseChipTextActive: {
    color: UI.onColor,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sectionLabel: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 13,
  },
  mapPlaceholderBtn: {
    backgroundColor: UI.soft,
    borderColor: UI.ink,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapPlaceholderBtnText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 12,
  },
  infoBox: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 11,
    borderWidth: 1,
    marginTop: 4,
    padding: 10,
  },
  infoText: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  policyToggleCard: {
    alignItems: 'center',
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  policyToggleTextWrap: {
    flex: 1,
    gap: 2,
  },
  policyToggleTitle: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 13,
  },
  policyToggleHint: {
    fontFamily: FONT.regular,
    color: UI.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  submitErrorBox: {
    backgroundColor: UI.danger,
    borderRadius: 11,
    marginTop: 10,
    padding: 12,
  },
  submitErrorText: {
    fontFamily: FONT.regular,
    color: UI.onColor,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: UI.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    padding: 13,
  },
  cancelText: {
    fontFamily: FONT.bold,
    color: UI.ink,
    fontSize: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: UI.accent,
    borderRadius: 12,
    flex: 1.4,
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
    color: UI.onColor,
    fontSize: 14,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
