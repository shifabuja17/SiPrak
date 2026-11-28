import { StyleSheet, Text, View } from 'react-native';
import { FONT } from '@/constants/fonts';
import { BORDER_COLOR } from '@/constants/colors';

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
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiBadgeText: {
    fontFamily: FONT.bold,
    color: '#111014',
    fontSize: 12,
    lineHeight: 17,
  },
  aiHelperText: {
    fontFamily: FONT.regular,
    color: '#5F5F66',
    fontSize: 11,
    lineHeight: 16,
  },
  aiUnavailableBox: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER_COLOR,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  aiUnavailableText: {
    fontFamily: FONT.semibold,
    color: '#525252',
    fontSize: 12,
    lineHeight: 17,
  },
});
