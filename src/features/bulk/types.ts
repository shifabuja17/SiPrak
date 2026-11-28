export const BULK_MAX_ROWS = 500;

export type BulkFileFormat = 'csv' | 'xlsx';

export type BulkTemplateKind = 'laboratories' | 'praktikan' | 'asprak';

export type BulkRowStatus = 'accepted' | 'denied';

export type BulkParseErrorCode =
  | 'INVALID_EXTENSION'
  | 'EMPTY_FILE'
  | 'MISSING_HEADERS'
  | 'ROW_LIMIT_EXCEEDED'
  | 'READ_FAILED'
  | 'PARSE_FAILED';

export interface BulkParseErrorDetails {
  missingHeaders?: string[];
  rowCount?: number;
  maxRows?: number;
  fileName?: string;
}

/**
 * Error eksplisit saat membaca atau mem-parsing file CSV/XLSX bulk import.
 */
export class BulkParseError extends Error {
  readonly code: BulkParseErrorCode;
  readonly details?: BulkParseErrorDetails;

  constructor(
    code: BulkParseErrorCode,
    message: string,
    details?: BulkParseErrorDetails,
  ) {
    super(message);
    this.name = 'BulkParseError';
    this.code = code;
    this.details = details;
  }
}

export interface BulkTemplateDefinition {
  kind: BulkTemplateKind;
  title: string;
  sheetName: string;
  fileBaseName: string;
  headers: readonly string[];
  requiredHeaders: readonly string[];
  sampleRows: readonly (readonly string[])[];
}

export interface PickedBulkFile {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  file?: File;
  base64?: string;
}

export interface BulkParsedRow {
  /** Nomor baris 1-based pada file asli (baris header = 1, data dimulai dari 2). */
  rowIndex: number;
  /** Nilai string per kolom yang telah di-trim dengan key mengikuti nama header kanonik. */
  raw: Record<string, string>;
}

export interface BulkParseResult {
  fileName: string;
  format: BulkFileFormat;
  headers: string[];
  rows: BulkParsedRow[];
  totalRows: number;
}

export interface ParseBulkFileOptions {
  /** Daftar header wajib yang harus ada pada baris pertama file (case-insensitive). */
  requiredHeaders?: readonly string[];
  /** Daftar header kanonik tambahan (termasuk kolom opsional) agar casing key selalu konsisten. */
  expectedHeaders?: readonly string[];
  /** Batas maksimal baris data; default BULK_MAX_ROWS (500). */
  maxRows?: number;
}

export interface BulkReviewRow<T> {
  rowId: string;
  rowIndex: number;
  raw: Record<string, string>;
  data: T | null;
  status: BulkRowStatus;
  errors: string[];
  isDuplicateInFile: boolean;
  isDuplicateInDb: boolean;
  duplicateKey: string | null;
  selectedForCommit: boolean;
}

export interface BulkReviewSummary {
  total: number;
  accepted: number;
  denied: number;
  withErrors: number;
  duplicateInFile: number;
  duplicateInDb: number;
  selectedForCommit: number;
}

export type BulkFieldKeyboardType =
  | 'default'
  | 'email-address'
  | 'numeric'
  | 'decimal-pad';

export interface BulkFieldSpec {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  keyboardType?: BulkFieldKeyboardType;
  multiline?: boolean;
  validate?: (value: string, raw: Record<string, string>) => string | null;
}

export interface BulkRowParseOutput<T> {
  data: T | null;
  errors: string[];
}

export interface BulkValidationSchema<T> {
  fields: readonly BulkFieldSpec[];
  parseRow: (raw: Record<string, string>) => BulkRowParseOutput<T>;
  getDuplicateKey: (
    raw: Record<string, string>,
    parsed: T | null,
  ) => string | null;
  duplicateInFileMessage?: (
    rowIndex: number,
    firstRowIndex: number,
    duplicateKey: string,
  ) => string;
  duplicateInDbMessage?: (duplicateKey: string) => string;
}

export type BulkDbDuplicateChecker =
  | ReadonlySet<string>
  | ((keys: string[]) => Promise<ReadonlySet<string>> | ReadonlySet<string>);

export interface BulkToggleStatusResult<T> {
  rows: BulkReviewRow<T>[];
  changed: boolean;
  rejectedReason: string | null;
}
