import { StyleSheet, Text, View } from 'react-native';

export interface LeaveAiInfoBoxProps {
  kategoriAI?: string | null;
}

/**
 * Menampilkan informasi kategori klasifikasi AI (pendukung) atau status
 * fallback saat klasifikasi AI belum tersedia (FR-16, FR-21, NFR-06).
 */
export function LeaveAiInfoBox({ kategoriAI }: LeaveAiInfoBoxProps) {
  const normalizedCategory =
    typeof kategoriAI === 'string' && kategoriAI.trim().length > 0
      ? kategoriAI.trim()
      : null;

  if (normalizedCategory) {
    return (
      <View style={styles.aiBadgeBox}>
        <Text style={styles.aiBadgeText}>
          Kategori AI (Info Pendukung): {normalizedCategory}
        </Text>
        <Text style={styles.aiHelperText}>
          Kategori ini hanya sebagai informasi pendukung dan tidak menentukan persetujuan atau penolakan Asisten.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.aiUnavailableBox}>
      <Text style={styles.aiUnavailableText}>
        Kategori AI: Tidak tersedia — menunggu pemeriksaan langsung Asisten
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aiBadgeBox: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiBadgeText: {
    color: '#3730A3',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  aiHelperText: {
    color: '#4338CA',
    fontSize: 11,
    lineHeight: 16,
  },
  aiUnavailableBox: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiUnavailableText: {
    color: '#525252',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
