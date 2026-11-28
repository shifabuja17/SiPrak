import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { FONT } from '@/constants/fonts';

/**
 * Header biru "Riwayat Kehadiran" dengan bunga oranye dari Figma
 * (assets/icons/figma/FLOWERS.png, ekspor 3x 1500px dengan cahaya tepi kelopak bawaan Figma).
 */

const SKY = '#65D0F4';

/** Tinggi header & posisi pusat bunga pada desain (status bar iPhone 62pt). */
const DESIGN_HEIGHT = 140;
const DESIGN_STATUS_BAR = 62;
const FLOWER_CENTER_Y = 136;
/** Bunga sedikit lebih lebar dari layar (diukur dari desain). */
const FLOWER_SCALE = 1.0125;

const FLOWERS_IMAGE = require('../../../../assets/icons/figma/FLOWERS.png');

export default function HistoryHeader({ title }: { title: string }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Status bar yang lebih tinggi dari desain mendorong isi header ke bawah.
  const shift = Math.max(0, insets.top - DESIGN_STATUS_BAR);
  const height = DESIGN_HEIGHT + shift;
  const size = width * FLOWER_SCALE;

  return (
    <View style={[styles.header, { height }]}>
      <Image
        source={FLOWERS_IMAGE}
        contentFit="contain"
        style={[
          styles.flower,
          { height: size, left: (width - size) / 2, top: FLOWER_CENTER_Y + shift - size / 2, width: size },
        ]}
      />

      <Text style={[styles.title, { top: 82 + shift }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: SKY,
    borderBottomLeftRadius: 47,
    borderBottomRightRadius: 47,
    overflow: 'hidden',
  },
  flower: {
    position: 'absolute',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: FONT.bold,
    fontSize: 32,
    left: 0,
    letterSpacing: -1.6,
    lineHeight: 40,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
  },
});
