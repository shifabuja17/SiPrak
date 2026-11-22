/**
 * Nama tampilan kelas praktikum: nama praktikum diikuti kode kelas, dipisah spasi,
 * mis. "Praktikum Sistem Operasi E1". Kode kosong tidak ditambahkan.
 */
export function classLabel(item: { nama?: string | null; kode?: string | null }): string {
  const nama = item.nama?.trim() ?? '';
  const kode = item.kode?.trim() ?? '';
  return [nama, kode].filter(Boolean).join(' ') || 'Kelas praktikum';
}
