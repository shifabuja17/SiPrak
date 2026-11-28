import type {
  BulkFieldSpec,
  BulkRowParseOutput,
  BulkValidationSchema,
} from './types';

export interface BulkLaboratoryItem {
  nama: string;
  mataKuliahId: string;
  lokasi: string;
  lat: number;
  lng: number;
  radius: number;
  gracePeriodMenit: number;
  nominalDenda: number;
}

const NUMBER_PATTERN = /^[+-]?\d+(\.\d+)?$/;

/**
 * Mengurai angka dari input string CSV/XLSX (mendukung koma desimal maupun titik).
 */
export function parseLocaleNumber(rawValue: string): number {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Nilai angka kosong.');
  }

  const normalized = !trimmed.includes('.')
    ? trimmed.replace(',', '.')
    : trimmed;

  if (!NUMBER_PATTERN.test(normalized)) {
    throw new Error(`"${rawValue}" bukan angka yang valid.`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`"${rawValue}" bukan angka yang valid.`);
  }

  return parsed === 0 ? 0 : parsed;
}

function tryParseLocaleNumber(rawValue: string): number | null {
  try {
    return parseLocaleNumber(rawValue);
  } catch {
    return null;
  }
}

/**
 * Kunci normalisasi deteksi duplikat laboratorium: nama lab + mataKuliahId.
 */
export function normalizeLabDuplicateKey(
  nama: string,
  mataKuliahId: string,
): string | null {
  const cleanName = nama.trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanCourse = mataKuliahId.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!cleanName || !cleanCourse) {
    return null;
  }
  return `${cleanCourse}::${cleanName}`;
}

export const LAB_BULK_REQUIRED_HEADERS: readonly string[] = [
  'nama',
  'lat',
  'lng',
  'radius',
  'gracePeriodMenit',
  'nominalDenda',
];

export const LAB_BULK_FIELDS: readonly BulkFieldSpec[] = [
  {
    key: 'nama',
    label: 'Nama Laboratorium',
    required: true,
    placeholder: 'Contoh: Lab E Informatika',
    validate: (value) =>
      value.trim().length < 2
        ? 'Nama laboratorium minimal 2 karakter.'
        : null,
  },
  {
    key: 'lokasi',
    label: 'Lokasi / Gedung',
    required: false,
    placeholder: 'Contoh: Gedung E FSM Lantai 2',
  },
  {
    key: 'lat',
    label: 'Latitude',
    required: true,
    placeholder: '-7.0482375',
    keyboardType: 'decimal-pad',
    validate: (value) => {
      const parsed = tryParseLocaleNumber(value);
      if (parsed === null || parsed < -90 || parsed > 90) {
        return 'Latitude harus berupa angka antara -90 sampai 90.';
      }
      return null;
    },
  },
  {
    key: 'lng',
    label: 'Longitude',
    required: true,
    placeholder: '110.4407656',
    keyboardType: 'decimal-pad',
    validate: (value) => {
      const parsed = tryParseLocaleNumber(value);
      if (parsed === null || parsed < -180 || parsed > 180) {
        return 'Longitude harus berupa angka antara -180 sampai 180.';
      }
      return null;
    },
  },
  {
    key: 'radius',
    label: 'Radius (meter)',
    required: true,
    placeholder: '50',
    keyboardType: 'numeric',
    validate: (value) => {
      const parsed = tryParseLocaleNumber(value);
      if (parsed === null || parsed <= 0) {
        return 'Radius presensi harus berupa angka lebih dari 0 meter.';
      }
      return null;
    },
  },
  {
    key: 'gracePeriodMenit',
    label: 'Grace Period (menit)',
    required: true,
    placeholder: '15',
    keyboardType: 'numeric',
    validate: (value) => {
      const parsed = tryParseLocaleNumber(value);
      if (parsed === null || parsed < 0) {
        return 'Grace period harus berupa angka minimal 0 menit.';
      }
      return null;
    },
  },
  {
    key: 'nominalDenda',
    label: 'Nominal Denda (Rp)',
    required: true,
    placeholder: '5000',
    keyboardType: 'numeric',
    validate: (value) => {
      const parsed = tryParseLocaleNumber(value);
      if (parsed === null || parsed < 0) {
        return 'Nominal denda harus berupa angka minimal 0.';
      }
      return null;
    },
  },
];

/**
 * Membuat skema validasi baris bulk insert laboratorium untuk satu `mataKuliahId` tujuan (FR-03).
 */
export function createLabBulkValidationSchema(
  selectedMataKuliahId: string,
): BulkValidationSchema<BulkLaboratoryItem> {
  const courseId = selectedMataKuliahId.trim();
  if (!courseId) {
    throw new Error('Mata kuliah tujuan (mataKuliahId) wajib dipilih terlebih dahulu.');
  }

  return {
    fields: LAB_BULK_FIELDS,
    parseRow(raw: Record<string, string>): BulkRowParseOutput<BulkLaboratoryItem> {
      const errors: string[] = [];
      const nama = (raw.nama ?? '').trim();
      const lokasi = (raw.lokasi ?? '').trim();

      if (nama.length < 2) {
        errors.push('Nama laboratorium minimal 2 karakter.');
      }

      const lat = tryParseLocaleNumber(raw.lat ?? '');
      if (lat === null || lat < -90 || lat > 90) {
        errors.push('Latitude harus berupa angka antara -90 sampai 90.');
      }

      const lng = tryParseLocaleNumber(raw.lng ?? '');
      if (lng === null || lng < -180 || lng > 180) {
        errors.push('Longitude harus berupa angka antara -180 sampai 180.');
      }

      const radius = tryParseLocaleNumber(raw.radius ?? '');
      if (radius === null || radius <= 0) {
        errors.push('Radius presensi harus berupa angka lebih dari 0 meter.');
      }

      const gracePeriodMenit = tryParseLocaleNumber(raw.gracePeriodMenit ?? '');
      if (gracePeriodMenit === null || gracePeriodMenit < 0) {
        errors.push('Grace period harus berupa angka minimal 0 menit.');
      }

      const nominalDenda = tryParseLocaleNumber(raw.nominalDenda ?? '');
      if (nominalDenda === null || nominalDenda < 0) {
        errors.push('Nominal denda harus berupa angka minimal 0.');
      }

      if (
        errors.length > 0 ||
        lat === null ||
        lng === null ||
        radius === null ||
        gracePeriodMenit === null ||
        nominalDenda === null
      ) {
        return { data: null, errors };
      }

      return {
        data: {
          nama,
          mataKuliahId: courseId,
          lokasi,
          lat,
          lng,
          radius: Math.round(radius),
          gracePeriodMenit: Math.round(gracePeriodMenit),
          nominalDenda: Math.round(nominalDenda),
        },
        errors: [],
      };
    },
    getDuplicateKey(raw: Record<string, string>): string | null {
      return normalizeLabDuplicateKey(raw.nama ?? '', courseId);
    },
    duplicateInFileMessage: (_rowIndex, firstRowIndex) =>
      `Nama laboratorium duplikat dengan baris #${firstRowIndex} pada mata kuliah ${courseId}.`,
    duplicateInDbMessage: () =>
      `Laboratorium dengan nama ini sudah terdaftar pada mata kuliah ${courseId} di Firestore.`,
  };
}
