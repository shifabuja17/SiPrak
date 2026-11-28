import { useEffect, useState } from 'react';
import {
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

import { FONT } from '@/constants/fonts';
import { PillButton, UI } from '@/features/praktikan/ui/praktikan-ui';

import type { BulkFieldSpec, BulkReviewRow } from '../types';

interface BulkRowEditModalProps<T> {
  visible: boolean;
  row: BulkReviewRow<T> | null;
  fields: readonly BulkFieldSpec[];
  saving?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSave: (
    rowId: string,
    updatedRaw: Record<string, string>,
  ) => Promise<void> | void;
}

/**
 * Modal edit/lengkapi kolom untuk 1 baris review sebelum divalidasi ulang (FR-08).
 */
export default function BulkRowEditModal<T>({
  visible,
  row,
  fields,
  saving = false,
  errorMessage = null,
  onClose,
  onSave,
}: BulkRowEditModalProps<T>) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible || !row) return;
    const nextDraft: Record<string, string> = {};
    for (const field of fields) {
      nextDraft[field.key] = row.raw[field.key] ?? '';
    }
    setDraft(nextDraft);
  }, [visible, row, fields]);

  if (!row) return null;

  const targetRow = row;

  function handleChangeField(key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSubmit() {
    if (saving) return;
    onSave(targetRow.rowId, draft);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                Edit Data Baris #{targetRow.rowIndex}
              </Text>
              <Text style={styles.subtitle}>
                Perbaiki atau lengkapi kolom di bawah ini lalu simpan untuk
                memvalidasi ulang seluruh tabel.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup modal edit"
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && !saving && styles.pressed,
              ]}
            >
              <Text style={styles.closeText}>Tutup</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {targetRow.errors.length > 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxTitle}>
                  Masalah Validasi Saat Ini:
                </Text>
                {targetRow.errors.map((err, index) => (
                  <Text key={`${targetRow.rowId}-err-${index}`} style={styles.errorItem}>
                    • {err}
                  </Text>
                ))}
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorItem}>{errorMessage}</Text>
              </View>
            ) : null}

            {fields.map((field) => {
              const value = draft[field.key] ?? '';
              const isMissingRequired =
                Boolean(field.required) && value.trim().length === 0;

              return (
                <View key={field.key} style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{field.label}</Text>
                    {field.required ? (
                      <Text style={styles.requiredMark}>* Wajib</Text>
                    ) : (
                      <Text style={styles.optionalMark}>Opsional</Text>
                    )}
                  </View>

                  <TextInput
                    value={value}
                    onChangeText={(text) => handleChangeField(field.key, text)}
                    placeholder={
                      field.placeholder ?? `Masukkan ${field.label.toLowerCase()}`
                    }
                    placeholderTextColor="#9CA3AF"
                    keyboardType={field.keyboardType ?? 'default'}
                    multiline={Boolean(field.multiline)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!saving}
                    style={[
                      styles.input,
                      field.multiline && styles.inputMultiline,
                      isMissingRequired && styles.inputMissing,
                    ]}
                  />
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <PillButton
              label="Batal"
              variant="outline"
              disabled={saving}
              onPress={onClose}
              style={styles.actionButton}
            />
            <PillButton
              label="Simpan & Validasi"
              variant="accent"
              loading={saving}
              onPress={handleSubmit}
              style={styles.actionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(17, 16, 20, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: UI.page,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 20,
    paddingHorizontal: UI.padding,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D4D4D8',
    borderRadius: 999,
    height: 4,
    marginBottom: 14,
    width: 44,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 19,
  },
  subtitle: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: UI.soft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  closeText: {
    color: UI.ink,
    fontFamily: FONT.semibold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  errorBoxTitle: {
    color: UI.danger,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  errorItem: {
    color: '#991B1B',
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: UI.ink,
    fontFamily: FONT.semibold,
    fontSize: 13,
  },
  requiredMark: {
    color: UI.danger,
    fontFamily: FONT.semibold,
    fontSize: 11,
  },
  optionalMark: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 11,
  },
  input: {
    backgroundColor: UI.page,
    borderColor: UI.border,
    borderRadius: 14,
    borderWidth: 1,
    color: UI.ink,
    fontFamily: FONT.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputMissing: {
    borderColor: UI.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
  },
});
