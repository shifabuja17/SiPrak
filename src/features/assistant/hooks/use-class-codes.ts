import { useEffect, useState } from 'react';

import { subscribeClasses } from '@/features/assistant/services/class-service';

/** Kode kelas per id kelas (real-time), untuk melengkapi nama praktikum di kartu sesi. */
export function useClassCodes(enabled = true): Map<string, string> {
  const [codes, setCodes] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    if (!enabled) return;

    return subscribeClasses(
      (classes) => setCodes(new Map(classes.map((item) => [item.id, item.kode]))),
      (error) => console.error('Gagal mengambil kode kelas:', error),
    );
  }, [enabled]);

  return codes;
}
