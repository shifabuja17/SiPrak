import * as XLSX from 'xlsx';

import type { BulkTemplateDefinition, BulkTemplateKind } from './types';

export const LAB_TEMPLATE_DEFINITION: BulkTemplateDefinition = {
  kind: 'laboratories',
  title: 'Template Bulk Laboratorium',
  sheetName: 'Laboratorium',
  fileBaseName: 'template_bulk_laboratorium',
  headers: [
    'nama',
    'mataKuliahId',
    'lokasi',
    'lat',
    'lng',
    'radius',
    'gracePeriodMenit',
    'nominalDenda',
  ],
  requiredHeaders: [
    'nama',
    'mataKuliahId',
    'lat',
    'lng',
    'radius',
    'gracePeriodMenit',
    'nominalDenda',
  ],
  sampleRows: [
    [
      'Lab E Informatika',
      'IF201-PBO',
      'Gedung E FSM Lantai 2',
      '-7.0482375',
      '110.4407656',
      '50',
      '15',
      '5000',
    ],
    [
      'Lab F Jaringan Komputer',
      'IF305-JARKOM',
      'Gedung E FSM Lantai 3',
      '-7.0483100',
      '110.4408120',
      '60',
      '10',
      '10000',
    ],
    [
      'Lab Riset Kecerdasan Buatan',
      'IF402-AI',
      'Gedung AP FSM Lantai 1',
      '-7.0490375',
      '110.4414844',
      '55',
      '0',
      '0',
    ],
  ],
};

export const PRAKTIKAN_TEMPLATE_DEFINITION: BulkTemplateDefinition = {
  kind: 'praktikan',
  title: 'Template Bulk Praktikan',
  sheetName: 'Praktikan',
  fileBaseName: 'template_bulk_praktikan',
  headers: ['nim', 'email', 'nama', 'catatan'],
  requiredHeaders: ['nim', 'email', 'nama'],
  sampleRows: [
    [
      '24060122120001',
      'budi.santoso@students.undip.ac.id',
      'Budi Santoso',
      'Shift A Pagi',
    ],
    [
      '24060122120002',
      'siti.rahma@students.undip.ac.id',
      'Siti Rahma',
      'Shift B Siang',
    ],
    [
      '24060122120003',
      'dimas.pratama@students.undip.ac.id',
      'Dimas Pratama',
      '',
    ],
  ],
};

export const ASPRAK_TEMPLATE_DEFINITION: BulkTemplateDefinition = {
  kind: 'asprak',
  title: 'Template Bulk Asprak',
  sheetName: 'Asprak',
  fileBaseName: 'template_bulk_asprak',
  headers: ['email', 'nama', 'nim', 'catatan'],
  requiredHeaders: ['email', 'nama'],
  sampleRows: [
    [
      'andi.wijaya@asprak.undip.ac.id',
      'Andi Wijaya',
      '24060121130010',
      'Koordinator Kelas A',
    ],
    [
      'dewi.lestari@asprak.undip.ac.id',
      'Dewi Lestari',
      '24060121140021',
      'Asisten Modul 1-4',
    ],
    [
      'farhan.hakim@asprak.undip.ac.id',
      'Farhan Hakim',
      '',
      '',
    ],
  ],
};

export const BULK_TEMPLATE_DEFINITIONS: Record<
  BulkTemplateKind,
  BulkTemplateDefinition
> = {
  laboratories: LAB_TEMPLATE_DEFINITION,
  praktikan: PRAKTIKAN_TEMPLATE_DEFINITION,
  asprak: ASPRAK_TEMPLATE_DEFINITION,
};

function escapeCsvCell(value: string): string {
  const needsQuotes = /[",\r\n;]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Menghasilkan konten CSV (dengan UTF-8 BOM agar Excel langsung membaca UTF-8 dengan benar).
 */
export function buildTemplateCsv(definition: BulkTemplateDefinition): string {
  const matrix: readonly (readonly string[])[] = [
    definition.headers,
    ...definition.sampleRows,
  ];
  const body = matrix
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
  return `\uFEFF${body}\r\n`;
}

function buildTemplateWorkbook(
  definition: BulkTemplateDefinition,
): XLSX.WorkBook {
  const matrix: string[][] = [
    [...definition.headers],
    ...definition.sampleRows.map((row) => [...row]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, definition.sheetName);
  return workbook;
}

/**
 * Menghasilkan file XLSX dalam representasi Base64 (untuk tulis cache native / test).
 */
export function buildTemplateXlsxBase64(
  definition: BulkTemplateDefinition,
): string {
  const workbook = buildTemplateWorkbook(definition);
  return XLSX.write(workbook, {
    type: 'base64',
    bookType: 'xlsx',
  }) as string;
}

/**
 * Menghasilkan file XLSX dalam representasi Uint8Array (untuk Blob download di web).
 */
export function buildTemplateXlsxBytes(
  definition: BulkTemplateDefinition,
): Uint8Array {
  const workbook = buildTemplateWorkbook(definition);
  const output: unknown = XLSX.write(workbook, {
    type: 'array',
    bookType: 'xlsx',
  });

  if (output instanceof Uint8Array) {
    return output;
  }
  if (output instanceof ArrayBuffer) {
    return new Uint8Array(output);
  }
  if (ArrayBuffer.isView(output)) {
    return new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
  }
  if (Array.isArray(output)) {
    return Uint8Array.from(output);
  }

  throw new Error('Gagal menghasilkan biner file XLSX yang valid.');
}
