import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FONT } from '@/constants/fonts';
import { UI } from '@/features/praktikan/ui/praktikan-ui';
import type { LatePolicyInput } from '@/types/laboratory';

import {
  validateLatePolicyForm,
  type LatePolicyFormErrors,
  type LatePolicyFormValues,
} from '../utils/laboratory-form';

interface LatePolicyModalProps {
  visible: boolean;
  courses: string[];
  labCountByCourse: Record<string, number>;
  saving: boolean;
  submitError: string;
  onClose: () => void;
  onSubmit: (mataKuliahId: string, policy: LatePolicyInput) => Promise<void>;
}

/**
 * Modal "Atur Denda per Mata Kuliah" untuk menerapkan grace period dan nominal denda
 * sekaligus ke semua laboratorium dalam satu mata kuliah (FR-12).
 */
export default function LatePolicyModal({
  visible,
  courses,
  labCountByCourse,
  saving,
  submitError,
  onClose,
  onSubmit,
}: LatePolicyModalProps) {
  const [values, setValues] = useState<LatePolicyFormValues>({
    mataKuliahId: '',
    gracePeriodMenit: '0',
    nominalDenda: '0',
  });
  const [errors, setErrors] = useState<LatePolicyFormErrors>({});

  useEffect(() => {
    if (!visible) return;
    setValues({
      mataKuliahId: courses[0] ?? '',
      gracePeriodMenit: '0',
      nominalDenda: '0',
    });
    setErrors({});
  }, [visible, courses]);

  function updateField(field: keyof LatePolicyFormValues, nextValue: string) {
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

    const result = validateLatePolicyForm(values);
    if (!result.data) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    await onSubmit(result.data.mataKuliahId, result.data.policy);
  }

  const targetCourse = values.mataKuliahId.trim();
  const targetLabCount = targetCourse ? (labCountByCourse[targetCourse] ?? 0) : 0;

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
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.card}>
              <View style={styles.handle} />

              <View style={styles.header}>
                <Text style={styles.title}>Atur Denda per Mata Kuliah</Text>
                <Text style={styles.subtitle}>
                  Terapkan grace period dan nominal denda sekaligus untuk semua laboratorium
                  pada satu mata kuliah.
                </Text>
              </View>

              <Text style={styles.label}>Pilih / Masukkan Mata Kuliah</Text>
              {courses.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {courses.map((course) => {
                    const active = targetCourse === course;
                    return (
                      <Pressable
                        key={course}
                        disabled={saving}
                        onPress={() => updateField('mataKuliahId', course)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {course} ({labCountByCourse[course] ?? 0})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <TextInput
                value={values.mataKuliahId}
                onChangeText={(text) => updateField('mataKuliahId', text)}
                placeholder="Contoh: IF-201"
                placeholderTextColor={UI.border}
                autoCapitalize="characters"
                style={[styles.input, errors.mataKuliahId && styles.inputError]}
                editable={!saving}
              />
              {errors.mataKuliahId ? (
                <Text style={styles.fieldError}>{errors.mataKuliahId}</Text>
              ) : targetCourse ? (
                <Text style={styles.helperText}>
                  {targetLabCount > 0
                    ? `Akan diperbarui untuk ${targetLabCount} laboratorium pada ${targetCourse}.`
                    : `Belum ada laboratorium dengan mata kuliah "${targetCourse}".`}
                </Text>
              ) : null}

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Grace Period (menit)</Text>
                  <TextInput
                    value={values.gracePeriodMenit}
                    onChangeText={(text) => updateField('gracePeriodMenit', text)}
                    placeholder="0"
                    placeholderTextColor={UI.border}
                    keyboardType="number-pad"
                    style={[styles.input, errors.gracePeriodMenit && styles.inputError]}
                    editable={!saving}
                  />
                  {errors.gracePeriodMenit ? (
                    <Text style={styles.fieldError}>{errors.gracePeriodMenit}</Text>
                  ) : null}
                </View>

                <View style={styles.col}>
                  <Text style={styles.label}>Nominal Denda (Rp)</Text>
                  <TextInput
                    value={values.nominalDenda}
                    onChangeText={(text) => updateField('nominalDenda', text)}
                    placeholder="0"
                    placeholderTextColor={UI.border}
                    keyboardType="number-pad"
                    style={[styles.input, errors.nominalDenda && styles.inputError]}
                    editable={!saving}
                  />
                  {errors.nominalDenda ? (
                    <Text style={styles.fieldError}>{errors.nominalDenda}</Text>
                  ) : null}
                </View>
              </View>

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
                      <Text style={styles.saveText}>Menerapkan...</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveText}>Terapkan Kebijakan</Text>
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

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
    maxHeight: '90%',
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: UI.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
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
    marginBottom: 4,
  },
  title: {
    fontFamily: FONT.extrabold,
    color: UI.ink,
    fontSize: 20,
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
    marginTop: 6,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: UI.ink,
    borderColor: UI.ink,
  },
  chipText: {
    fontFamily: FONT.semibold,
    color: UI.ink,
    fontSize: 12,
  },
  chipTextActive: {
    color: UI.onColor,
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
  helperText: {
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
  submitErrorBox: {
    backgroundColor: UI.danger,
    borderRadius: 11,
    marginTop: 6,
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
    marginTop: 14,
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
