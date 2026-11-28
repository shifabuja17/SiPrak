import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import SegmentedTabs from '@/components/common/SegmentedTabs';
import { FONT } from '@/constants/fonts';
import {
  Chip,
  PillButton,
  SoftCard,
  TAB_BAR_SPACE,
  UI,
} from '@/features/praktikan/ui/praktikan-ui';

import type {
  BulkFieldSpec,
  BulkReviewRow,
  BulkReviewSummary,
} from '../types';
import { summarizeBulkRows } from '../validation-engine';
import BulkRowEditModal from './bulk-row-edit-modal';

export type BulkReviewFilter = 'all' | 'accepted' | 'denied' | 'errors';

export interface BulkToggleFeedback {
  rejectedReason?: string | null;
}

interface BulkReviewListProps<T> {
  rows: readonly BulkReviewRow<T>[];
  fields: readonly BulkFieldSpec[];
  summary?: BulkReviewSummary;
  onToggleRowStatus: (rowId: string) => BulkToggleFeedback | void;
  onEditRow: (
    rowId: string,
    updatedRaw: Record<string, string>,
  ) => Promise<void> | void;
  onAcceptAllValid: () => void;
  onDenyAll: () => void;
  emptyMessage?: string;
  headerExtra?: ReactNode;
}

const FILTER_OPTIONS: { key: BulkReviewFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'accepted', label: 'Diterima' },
  { key: 'denied', label: 'Ditolak' },
  { key: 'errors', label: 'Error' },
];

/**
 * Komponen reusable daftar review & perbaikan data bulk import (FR-07 & FR-08).
 */
export default function BulkReviewList<T>({
  rows,
  fields,
  summary: summaryProp,
  onToggleRowStatus,
  onEditRow,
  onAcceptAllValid,
  onDenyAll,
  emptyMessage = 'Belum ada data hasil parsing untuk direview.',
  headerExtra,
}: BulkReviewListProps<T>) {
  const [filter, setFilter] = useState<BulkReviewFilter>('all');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [toggleWarning, setToggleWarning] = useState<{
    rowId: string;
    message: string;
  } | null>(null);

  const summary = useMemo(
    () => summaryProp ?? summarizeBulkRows(rows),
    [rows, summaryProp],
  );

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'accepted':
        return rows.filter((row) => row.status === 'accepted');
      case 'denied':
        return rows.filter((row) => row.status === 'denied');
      case 'errors':
        return rows.filter((row) => row.errors.length > 0);
      case 'all':
      default:
        return rows;
    }
  }, [rows, filter]);

  const editingRow = useMemo(
    () => rows.find((row) => row.rowId === editingRowId) ?? null,
    [rows, editingRowId],
  );

  const validButDeniedCount = useMemo(
    () =>
      rows.filter(
        (row) => row.errors.length === 0 && row.status === 'denied',
      ).length,
    [rows],
  );

  function handleToggleRow(row: BulkReviewRow<T>) {
    const result = onToggleRowStatus(row.rowId);
    if (result?.rejectedReason) {
      setToggleWarning({
        rowId: row.rowId,
        message: result.rejectedReason,
      });
      return;
    }

    if (row.errors.length > 0 && row.status === 'denied') {
      setToggleWarning({
        rowId: row.rowId,
        message: `Baris #${row.rowIndex} masih bermasalah (${row.errors.length} error). Perbaiki lewat tombol Edit sebelum menerima baris ini.`,
      });
      return;
    }

    if (toggleWarning?.rowId === row.rowId) {
      setToggleWarning(null);
    }
  }

  async function handleSaveEdit(
    rowId: string,
    updatedRaw: Record<string, string>,
  ) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await onEditRow(rowId, updatedRaw);
      setEditingRowId(null);
      if (toggleWarning?.rowId === rowId) {
        setToggleWarning(null);
      }
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan perubahan dan memvalidasi ulang baris.',
      );
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {headerExtra}

        {/* RINGKASAN DINAMIS */}
        <SoftCard style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Ringkasan Review Data</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{summary.total}</Text>
              <Text style={styles.statLabel}>Total Baris</Text>
            </View>

            <View style={[styles.statTile, styles.statTileAccent]}>
              <Text style={[styles.statValue, styles.statValueOnColor]}>
                {summary.accepted}
              </Text>
              <Text style={[styles.statLabel, styles.statLabelOnColor]}>
                Siap Disimpan
              </Text>
            </View>

            <View style={[styles.statTile, styles.statTileDark]}>
              <Text style={[styles.statValue, styles.statValueOnColor]}>
                {summary.denied}
              </Text>
              <Text style={[styles.statLabel, styles.statLabelOnColor]}>
                Ditolak
              </Text>
            </View>

            <View
              style={[
                styles.statTile,
                summary.withErrors > 0 && styles.statTileDanger,
              ]}
            >
              <Text
                style={[
                  styles.statValue,
                  summary.withErrors > 0 && styles.statValueDanger,
                ]}
              >
                {summary.withErrors}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  summary.withErrors > 0 && styles.statLabelDanger,
                ]}
              >
                Bermasalah
              </Text>
            </View>
          </View>

          {summary.duplicateInFile > 0 || summary.duplicateInDb > 0 ? (
            <Text style={styles.duplicateSummaryText}>
              Terdeteksi duplikat: {summary.duplicateInFile} di file,{' '}
              {summary.duplicateInDb} sudah ada di Firestore.
            </Text>
          ) : null}

          <View style={styles.bulkActions}>
            <PillButton
              label="Accept Semua Valid"
              variant="accent"
              disabled={validButDeniedCount === 0}
              onPress={() => {
                setToggleWarning(null);
                onAcceptAllValid();
              }}
              style={styles.bulkActionButton}
            />
            <PillButton
              label="Deny Semua"
              variant="outline"
              disabled={summary.accepted === 0}
              onPress={() => {
                setToggleWarning(null);
                onDenyAll();
              }}
              style={styles.bulkActionButton}
            />
          </View>
        </SoftCard>

        {/* FILTER STATUS */}
        <SegmentedTabs
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />

        {/* DAFTAR BARIS */}
        {filteredRows.length === 0 ? (
          <SoftCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Tidak Ada Baris Ditampilkan</Text>
            <Text style={styles.emptyText}>
              {rows.length === 0
                ? emptyMessage
                : 'Tidak ada baris yang sesuai dengan filter status saat ini.'}
            </Text>
          </SoftCard>
        ) : (
          filteredRows.map((row) => {
            const hasErrors = row.errors.length > 0;
            const isAccepted = row.status === 'accepted';
            const rowWarning =
              toggleWarning?.rowId === row.rowId ? toggleWarning.message : null;

            return (
              <SoftCard
                key={row.rowId}
                style={[
                  styles.rowCard,
                  hasErrors && styles.rowCardError,
                ]}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.rowBadgeGroup}>
                    <Text style={styles.rowNumber}>Baris #{row.rowIndex}</Text>
                    <Chip
                      label={isAccepted ? 'ACCEPTED' : 'DENIED'}
                      tone={isAccepted ? 'accent' : 'dark'}
                    />
                    {row.isDuplicateInFile ? (
                      <Chip label="Duplikat File" tone="soft" />
                    ) : null}
                    {row.isDuplicateInDb ? (
                      <Chip label="Duplikat DB" tone="soft" />
                    ) : null}
                  </View>
                </View>

                {/* RINGKASAN FIELD */}
                <View style={styles.fieldsTable}>
                  {fields.map((field) => {
                    const value = (row.raw[field.key] ?? '').trim();
                    const isEmptyRequired =
                      Boolean(field.required) && value.length === 0;

                    return (
                      <View
                        key={`${row.rowId}-${field.key}`}
                        style={styles.fieldRow}
                      >
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <Text
                          style={[
                            styles.fieldValue,
                            isEmptyRequired && styles.fieldValueMissing,
                            value.length === 0 &&
                              !isEmptyRequired &&
                              styles.fieldValueEmpty,
                          ]}
                        >
                          {value.length > 0
                            ? value
                            : isEmptyRequired
                              ? '(Wajib diisi)'
                              : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* DAFTAR ERROR VALIDASI */}
                {hasErrors ? (
                  <View style={styles.errorListBox}>
                    <Text style={styles.errorListTitle}>
                      Alasan Penolakan ({row.errors.length}):
                    </Text>
                    {row.errors.map((err, idx) => (
                      <Text
                        key={`${row.rowId}-msg-${idx}`}
                        style={styles.errorListItem}
                      >
                        • {err}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {rowWarning ? (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>{rowWarning}</Text>
                  </View>
                ) : null}

                {/* AKSI PER BARIS */}
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isAccepted
                        ? `Tolak baris ${row.rowIndex}`
                        : `Terima baris ${row.rowIndex}`
                    }
                    onPress={() => handleToggleRow(row)}
                    style={({ pressed }) => [
                      styles.rowActionButton,
                      isAccepted
                        ? styles.toggleDenyButton
                        : hasErrors
                          ? styles.toggleBlockedButton
                          : styles.toggleAcceptButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rowActionText,
                        isAccepted
                          ? styles.toggleDenyText
                          : hasErrors
                            ? styles.toggleBlockedText
                            : styles.toggleAcceptText,
                      ]}
                    >
                      {isAccepted ? 'Deny Baris' : 'Accept Baris'}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit data baris ${row.rowIndex}`}
                    onPress={() => {
                      setEditError(null);
                      setEditingRowId(row.rowId);
                    }}
                    style={({ pressed }) => [
                      styles.rowActionButton,
                      styles.editButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.editButtonText}>
                      Edit / Lengkapi Data
                    </Text>
                  </Pressable>
                </View>
              </SoftCard>
            );
          })
        )}
      </ScrollView>

      <BulkRowEditModal
        visible={editingRow !== null}
        row={editingRow}
        fields={fields}
        saving={savingEdit}
        errorMessage={editError}
        onClose={() => {
          if (!savingEdit) {
            setEditingRowId(null);
            setEditError(null);
          }
        }}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: TAB_BAR_SPACE,
  },
  summaryCard: {
    gap: 12,
  },
  summaryTitle: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    backgroundColor: UI.soft,
    borderRadius: 16,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statTileAccent: {
    backgroundColor: UI.accent,
  },
  statTileDark: {
    backgroundColor: UI.ink,
  },
  statTileDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  statValue: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 20,
  },
  statValueOnColor: {
    color: UI.onColor,
  },
  statValueDanger: {
    color: UI.danger,
  },
  statLabel: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  statLabelOnColor: {
    color: UI.onColorMuted,
  },
  statLabelDanger: {
    color: '#991B1B',
  },
  duplicateSummaryText: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  bulkActionButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 26,
  },
  emptyTitle: {
    color: UI.ink,
    fontFamily: FONT.bold,
    fontSize: 15,
  },
  emptyText: {
    color: UI.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  rowCard: {
    gap: 12,
    padding: 16,
  },
  rowCardError: {
    borderColor: UI.danger,
    borderWidth: 1.5,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowBadgeGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowNumber: {
    color: UI.ink,
    fontFamily: FONT.extrabold,
    fontSize: 15,
  },
  fieldsTable: {
    backgroundColor: '#FAFAFA',
    borderColor: UI.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: UI.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
    width: '38%',
  },
  fieldValue: {
    color: UI.ink,
    flex: 1,
    fontFamily: FONT.semibold,
    fontSize: 12,
    textAlign: 'right',
  },
  fieldValueMissing: {
    color: UI.danger,
    fontFamily: FONT.bold,
  },
  fieldValueEmpty: {
    color: '#9CA3AF',
    fontFamily: FONT.regular,
  },
  errorListBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
    padding: 10,
  },
  errorListTitle: {
    color: UI.danger,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  errorListItem: {
    color: '#991B1B',
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  warningBox: {
    backgroundColor: '#FFF7ED',
    borderColor: UI.accent,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  warningText: {
    color: '#9A3412',
    fontFamily: FONT.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rowActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  toggleAcceptButton: {
    backgroundColor: UI.accent,
  },
  toggleDenyButton: {
    backgroundColor: UI.page,
    borderColor: UI.ink,
    borderWidth: 1.5,
  },
  toggleBlockedButton: {
    backgroundColor: UI.soft,
    borderColor: UI.line,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: UI.ink,
  },
  rowActionText: {
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  toggleAcceptText: {
    color: UI.onColor,
  },
  toggleDenyText: {
    color: UI.ink,
  },
  toggleBlockedText: {
    color: UI.muted,
  },
  editButtonText: {
    color: UI.onColor,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
