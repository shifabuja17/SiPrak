import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Menghitung berapa item (kartu) yang muat di sebuah area setinggi layar tanpa perlu
 * menggulir. Pasang `onAreaLayout` di wadah ber-`flex: 1` dan `itemLayout(key)` di tiap
 * kartu.
 *
 * Tinggi yang dipakai = kartu tertinggi yang pernah terukur (minimal
 * `estimatedItemHeight`). Ukuran kartu yang sudah tidak tampil SENGAJA tetap disimpan:
 * kalau dibuang, kartu tinggi (mis. judul 2 baris) bisa membuat jumlah turun -> kartu itu
 * hilang -> jumlah naik -> kartu muncul lagi, berulang (berkedip). Dengan begini jumlahnya
 * hanya bisa turun, lalu dihitung ulang dari awal saat `resetKey` berubah (filter/data baru).
 *
 * @param estimatedItemHeight tinggi kartu terlengkap; dipakai sebagai batas bawah
 * @param gap jarak antar-kartu
 * @param options.fallback jumlah sebelum area terukur
 * @param options.min jumlah minimum walaupun ruang kurang
 * @param options.resetKey ganti nilainya untuk membuang ukuran lama (mis. filter berubah)
 */
export function useFitCount(
  estimatedItemHeight: number,
  gap: number,
  { fallback = 1, min = 1, resetKey = '' }: { fallback?: number; min?: number; resetKey?: string } = {},
) {
  const [areaHeight, setAreaHeight] = useState(0);
  const [itemHeights, setItemHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    setItemHeights({});
  }, [resetKey]);

  const onAreaLayout = useCallback((event: LayoutChangeEvent) => {
    setAreaHeight(event.nativeEvent.layout.height);
  }, []);

  const itemLayout = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      setItemHeights((previous) =>
        Math.abs((previous[key] ?? 0) - height) < 0.5 ? previous : { ...previous, [key]: height },
      );
    },
    [],
  );

  const itemHeight = useMemo(
    () => Math.max(estimatedItemHeight, ...Object.values(itemHeights)),
    [estimatedItemHeight, itemHeights],
  );

  const count =
    areaHeight > 0
      ? Math.max(min, Math.floor((areaHeight + gap) / (itemHeight + gap)))
      : Math.max(min, fallback);

  return { count, onAreaLayout, itemLayout };
}
