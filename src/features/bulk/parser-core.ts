import * as XLSX from 'xlsx';

import {
  BULK_MAX_ROWS,
  BulkParseError,
  type BulkFileFormat,
  type BulkParsedRow,
  type BulkParseResult,
  type ParseBulkFileOptions,
} from './types';

function extractExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(dotIndex + 1);
}

/**
 * Menentukan format file (`.csv` atau `.xlsx`) dan menolak format lain secara eksplisit.
 */
export function detectBulkFileFormat(
  fileName: string,
  mimeType?: string,
): BulkFileFormat {
  const ext = extractExtension(fileName);
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';

  // Hanya gunakan MIME type apabila nama file tidak memiliki ekstensi.
  if (!ext && typeof mimeType === 'string') {
    const normalizedMime = mimeType.trim().toLowerCase();
    if (normalizedMime === 'text/csv' || normalizedMime === 'application/csv') {
      return 'csv';
    }
    if (
      normalizedMime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'xlsx';
    }
  }

  throw new BulkParseError(
    'INVALID_EXTENSION',
    `Format file "${fileName}" tidak didukung. Gunakan file berformat .csv atau .xlsx.`,
    { fileName },
  );
}

function stripBom(text: string): string {
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}

function detectCsvDelimiter(text: string): ',' | ';' {
  const firstLineEnd = text.search(/\r\n|\n|\r/);
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);

  let inQuotes = false;
  let commaCount = 0;
  let semicolonCount = 0;

  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i];
    if (char === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === ',') commaCount += 1;
      else if (char === ';') semicolonCount += 1;
    }
  }

  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Parser CSV sesuai RFC-4180 (mendukung BOM UTF-8, pemisah koma/titik koma, dan tanda kutip).
 */
export function parseCsvMatrix(rawText: string): string[][] {
  const text = stripBom(rawText);
  if (text.trim().length === 0) {
    return [];
  }

  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (inQuotes) {
    throw new BulkParseError(
      'PARSE_FAILED',
      'Format CSV tidak valid: terdapat tanda kutip ganda yang belum ditutup.',
    );
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Membaca sheet pertama dari file `.xlsx` (Base64 atau Uint8Array/ArrayBuffer) menjadi matriks string.
 */
export function parseXlsxMatrix(
  content: string | Uint8Array | ArrayBuffer,
): string[][] {
  let workbook: XLSX.WorkBook;
  try {
    workbook =
      typeof content === 'string'
        ? XLSX.read(content, { type: 'base64' })
        : XLSX.read(content instanceof Uint8Array ? content : new Uint8Array(content), {
            type: 'array',
          });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Struktur file rusak.';
    throw new BulkParseError(
      'PARSE_FAILED',
      `Gagal membaca isi file XLSX: ${reason}`,
    );
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new BulkParseError(
      'EMPTY_FILE',
      'File XLSX tidak memiliki worksheet.',
    );
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new BulkParseError(
      'EMPTY_FILE',
      'Worksheet pertama pada file XLSX kosong.',
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  return rawRows.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
      : [],
  );
}

function buildCanonicalHeaderLookup(
  options: ParseBulkFileOptions,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const header of options.expectedHeaders ?? []) {
    const trimmed = header.trim();
    if (trimmed) {
      map.set(trimmed.toLowerCase(), trimmed);
    }
  }
  for (const header of options.requiredHeaders ?? []) {
    const trimmed = header.trim();
    if (trimmed) {
      map.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return map;
}

/**
 * Memvalidasi header wajib, memetakan baris data, dan menegakkan batas maksimal 500 baris (NFR-02).
 */
export function parseBulkMatrix(
  matrix: readonly (readonly string[])[],
  meta: { fileName: string; format: BulkFileFormat },
  options: ParseBulkFileOptions = {},
): BulkParseResult {
  const maxRows = options.maxRows ?? BULK_MAX_ROWS;
  if (!Number.isInteger(maxRows) || maxRows <= 0) {
    throw new Error('Opsi maxRows harus berupa bilangan bulat positif.');
  }

  if (matrix.length === 0) {
    throw new BulkParseError(
      'EMPTY_FILE',
      `File "${meta.fileName}" kosong. Silakan gunakan template yang tersedia.`,
      { fileName: meta.fileName },
    );
  }

  const rawHeaderRow = matrix[0].map((cell) => cell.trim());
  const nonEmptyHeaderCount = rawHeaderRow.filter((cell) => cell.length > 0).length;
  if (nonEmptyHeaderCount === 0) {
    throw new BulkParseError(
      'EMPTY_FILE',
      `Baris header pada file "${meta.fileName}" kosong.`,
      { fileName: meta.fileName },
    );
  }

  const canonicalLookup = buildCanonicalHeaderLookup(options);
  const columnKeys: string[] = [];
  const presentNormalizedHeaders = new Set<string>();

  rawHeaderRow.forEach((header) => {
    if (!header) {
      columnKeys.push('');
      return;
    }

    const normalized = header.toLowerCase();
    if (presentNormalizedHeaders.has(normalized)) {
      throw new BulkParseError(
        'PARSE_FAILED',
        `Terdapat nama kolom duplikat "${header}" pada baris header file "${meta.fileName}".`,
        { fileName: meta.fileName },
      );
    }

    presentNormalizedHeaders.add(normalized);
    columnKeys.push(canonicalLookup.get(normalized) ?? header);
  });

  const missingHeaders = (options.requiredHeaders ?? [])
    .map((header) => header.trim())
    .filter((header) => header.length > 0 && !presentNormalizedHeaders.has(header.toLowerCase()));

  if (missingHeaders.length > 0) {
    throw new BulkParseError(
      'MISSING_HEADERS',
      `Kolom wajib tidak ditemukan pada file "${meta.fileName}": ${missingHeaders.join(', ')}.`,
      { missingHeaders, fileName: meta.fileName },
    );
  }

  const parsedRows: BulkParsedRow[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const sourceRow = matrix[i];
    const isBlankRow = sourceRow.every((cell) => cell.trim().length === 0);
    if (isBlankRow) {
      continue;
    }

    const rawRecord: Record<string, string> = {};
    for (let colIndex = 0; colIndex < columnKeys.length; colIndex += 1) {
      const key = columnKeys[colIndex];
      if (!key) continue;
      rawRecord[key] = (sourceRow[colIndex] ?? '').trim();
    }

    parsedRows.push({
      rowIndex: i + 1,
      raw: rawRecord,
    });
  }

  if (parsedRows.length === 0) {
    throw new BulkParseError(
      'EMPTY_FILE',
      `File "${meta.fileName}" hanya berisi header tanpa baris data.`,
      { fileName: meta.fileName },
    );
  }

  if (parsedRows.length > maxRows) {
    throw new BulkParseError(
      'ROW_LIMIT_EXCEEDED',
      `Jumlah baris data (${parsedRows.length} baris) melebihi batas maksimal ${maxRows} baris per unggahan. Pecah file menjadi beberapa bagian lalu unggah ulang.`,
      {
        rowCount: parsedRows.length,
        maxRows,
        fileName: meta.fileName,
      },
    );
  }

  const headers = columnKeys.filter((key) => key.length > 0);
  return {
    fileName: meta.fileName,
    format: meta.format,
    headers,
    rows: parsedRows,
    totalRows: parsedRows.length,
  };
}

/**
 * Mem-parsing konten teks CSV menjadi hasil tervalidasi struktur & batas 500 baris.
 */
export function parseBulkCsvText(
  csvText: string,
  fileName = 'upload.csv',
  options: ParseBulkFileOptions = {},
): BulkParseResult {
  const matrix = parseCsvMatrix(csvText);
  return parseBulkMatrix(matrix, { fileName, format: 'csv' }, options);
}

/**
 * Mem-parsing konten XLSX (Base64 atau Uint8Array/ArrayBuffer) menjadi hasil tervalidasi struktur & batas 500 baris.
 */
export function parseBulkXlsxContent(
  xlsxContent: string | Uint8Array | ArrayBuffer,
  fileName = 'upload.xlsx',
  options: ParseBulkFileOptions = {},
): BulkParseResult {
  const matrix = parseXlsxMatrix(xlsxContent);
  return parseBulkMatrix(matrix, { fileName, format: 'xlsx' }, options);
}
