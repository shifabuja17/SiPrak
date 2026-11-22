/**
 * Kode kelas singkat untuk ditampilkan: bagian terakhir kode, mis. "SO-E2" → "E2".
 * Kode tanpa pemisah dipakai apa adanya ("E2" → "E2").
 */
export function shortClassCode(kode?: string | null): string {
  const code = kode?.trim() ?? '';
  return code.split(/[-_/\s]+/).filter(Boolean).pop() ?? '';
}

/**
 * Nama tampilan kelas praktikum: nama praktikum diikuti kode kelas singkat, dipisah
 * spasi, mis. "Praktikum Sistem Operasi E1". Kode kosong tidak ditambahkan.
 */
export function classLabel(item: { nama?: string | null; kode?: string | null }): string {
  return withClassCode(item.nama ?? '', item.kode) || 'Kelas praktikum';
}

/**
 * Nama praktikum lengkap dengan kode kelas singkat, mis. "Praktikum Sistem Operasi"
 * + "SO-E2" menjadi "Praktikum Sistem Operasi E2". Nama yang sudah diakhiri kode
 * (singkat maupun penuh, mis. data lama "… SO-E2") dirapikan menjadi "… E2".
 */
export function withClassCode(practicumName: string, kode?: string | null): string {
  const name = practicumName.trim();
  const fullCode = kode?.trim() ?? '';
  const code = shortClassCode(fullCode);
  if (!code || !name || name === '-') return name;

  const words = name.split(/\s+/);
  const last = words[words.length - 1].toLowerCase();
  if (last === code.toLowerCase()) return name;
  if (last === fullCode.toLowerCase()) {
    return [...words.slice(0, -1), code].join(' ');
  }
  return `${name} ${code}`;
}
