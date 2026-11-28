import {
  DEFAULT_FINE_NOMINAL,
  DEFAULT_GRACE_PERIOD_MINUTES,
  DEFAULT_LABORATORY_RADIUS_METERS,
  validateLaboratoryPayload,
  validateLatePolicyInput,
  type Laboratory,
  type LaboratoryPayload,
  type LatePolicyInput,
} from '@/types/laboratory';

export interface LaboratoryFormValues {
  nama: string;
  mataKuliahId: string;
  lokasi: string;
  lat: string;
  lng: string;
  radius: string;
  gracePeriodMenit: string;
  nominalDenda: string;
}

export type LaboratoryFormErrors = Partial<Record<keyof LaboratoryFormValues, string>>;

export interface LatePolicyFormValues {
  mataKuliahId: string;
  gracePeriodMenit: string;
  nominalDenda: string;
}

export type LatePolicyFormErrors = Partial<Record<keyof LatePolicyFormValues, string>>;

export const COURSE_FILTER_ALL = 'ALL';
export const COURSE_FILTER_UNASSIGNED = 'UNASSIGNED';

export const EMPTY_LABORATORY_FORM: LaboratoryFormValues = {
  nama: '',
  mataKuliahId: '',
  lokasi: '',
  lat: '',
  lng: '',
  radius: String(DEFAULT_LABORATORY_RADIUS_METERS),
  gracePeriodMenit: String(DEFAULT_GRACE_PERIOD_MINUTES),
  nominalDenda: String(DEFAULT_FINE_NOMINAL),
};

const NUMERIC_PATTERN = /^[+-]?\d+(\.\d+)?$/;

export function parseNumericString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
  if (!NUMERIC_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function laboratoryToFormValues(lab: Laboratory): LaboratoryFormValues {
  return {
    nama: lab.nama,
    mataKuliahId: lab.mataKuliahId,
    lokasi: lab.lokasi,
    lat: String(lab.lat),
    lng: String(lab.lng),
    radius: String(lab.radius),
    gracePeriodMenit: String(lab.gracePeriodMenit),
    nominalDenda: String(lab.nominalDenda),
  };
}

export function validateLaboratoryForm(values: LaboratoryFormValues): {
  errors: LaboratoryFormErrors;
  payload: LaboratoryPayload | null;
} {
  const errors: LaboratoryFormErrors = {};

  const nama = values.nama.trim();
  if (!nama) {
    errors.nama = 'Nama laboratorium wajib diisi.';
  } else if (nama.length > 100) {
    errors.nama = 'Nama laboratorium maksimal 100 karakter.';
  }

  const mataKuliahId = values.mataKuliahId.trim();
  if (!mataKuliahId) {
    errors.mataKuliahId = 'Mata kuliah wajib diisi.';
  } else if (mataKuliahId.length > 100) {
    errors.mataKuliahId = 'ID mata kuliah maksimal 100 karakter.';
  }

  const lokasi = values.lokasi.trim();
  if (lokasi.length > 200) {
    errors.lokasi = 'Nama lokasi maksimal 200 karakter.';
  }

  const lat = parseNumericString(values.lat);
  if (lat === null || lat < -90 || lat > 90) {
    errors.lat = 'Latitude harus berupa angka antara -90 s.d. 90.';
  }

  const lng = parseNumericString(values.lng);
  if (lng === null || lng < -180 || lng > 180) {
    errors.lng = 'Longitude harus berupa angka antara -180 s.d. 180.';
  }

  const radius = parseNumericString(values.radius);
  if (radius === null || radius <= 0) {
    errors.radius = 'Radius harus berupa angka lebih dari 0 meter.';
  }

  const gracePeriodMenit = parseNumericString(values.gracePeriodMenit);
  if (gracePeriodMenit === null || gracePeriodMenit < 0) {
    errors.gracePeriodMenit = 'Grace period harus berupa angka minimal 0 menit.';
  }

  const nominalDenda = parseNumericString(values.nominalDenda);
  if (nominalDenda === null || nominalDenda < 0) {
    errors.nominalDenda = 'Nominal denda harus berupa angka minimal 0 rupiah.';
  }

  if (
    Object.keys(errors).length > 0 ||
    lat === null ||
    lng === null ||
    radius === null ||
    gracePeriodMenit === null ||
    nominalDenda === null
  ) {
    return { errors, payload: null };
  }

  const payload: LaboratoryPayload = {
    nama,
    mataKuliahId,
    lokasi,
    lat,
    lng,
    radius,
    gracePeriodMenit,
    nominalDenda,
  };

  // Pastikan sinkron dengan validator service sebelum dikirim ke Firestore.
  validateLaboratoryPayload(payload);

  return { errors: {}, payload };
}

export function validateLatePolicyForm(values: LatePolicyFormValues): {
  errors: LatePolicyFormErrors;
  data: { mataKuliahId: string; policy: LatePolicyInput } | null;
} {
  const errors: LatePolicyFormErrors = {};

  const mataKuliahId = values.mataKuliahId.trim();
  if (!mataKuliahId) {
    errors.mataKuliahId = 'Pilih atau isi ID mata kuliah terlebih dahulu.';
  } else if (mataKuliahId.length > 100) {
    errors.mataKuliahId = 'ID mata kuliah maksimal 100 karakter.';
  }

  const gracePeriodMenit = parseNumericString(values.gracePeriodMenit);
  if (gracePeriodMenit === null || gracePeriodMenit < 0) {
    errors.gracePeriodMenit = 'Grace period harus berupa angka minimal 0 menit.';
  }

  const nominalDenda = parseNumericString(values.nominalDenda);
  if (nominalDenda === null || nominalDenda < 0) {
    errors.nominalDenda = 'Nominal denda harus berupa angka minimal 0 rupiah.';
  }

  if (
    Object.keys(errors).length > 0 ||
    gracePeriodMenit === null ||
    nominalDenda === null
  ) {
    return { errors, data: null };
  }

  const policy: LatePolicyInput = {
    gracePeriodMenit,
    nominalDenda,
  };
  validateLatePolicyInput(policy);

  return {
    errors: {},
    data: {
      mataKuliahId,
      policy,
    },
  };
}

export function formatRupiah(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

export function formatShortCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function extractUniqueCourses(labs: Laboratory[]): string[] {
  const unique = new Set<string>();
  for (const lab of labs) {
    const course = lab.mataKuliahId.trim();
    if (course) {
      unique.add(course);
    }
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b, 'id'));
}

export function filterLaboratories(
  labs: Laboratory[],
  searchQuery: string,
  courseFilter: string,
): Laboratory[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return labs.filter((lab) => {
    if (courseFilter === COURSE_FILTER_UNASSIGNED) {
      if (lab.mataKuliahId.trim().length > 0) {
        return false;
      }
    } else if (courseFilter !== COURSE_FILTER_ALL) {
      if (lab.mataKuliahId.trim() !== courseFilter) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${lab.nama} ${lab.lokasi} ${lab.mataKuliahId}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
