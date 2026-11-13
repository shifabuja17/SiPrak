import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Svg, { Path } from 'react-native-svg';

export default function AssistantHeader() {
  return (
    <View style={styles.topBar}>
      {/* TOMBOL KEMBALI */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.pressed,
        ]}
        hitSlop={8}
      >
        <Svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
        >
          <Path
            d="M15 18L9 12L15 6"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      {/* LOGO SIPRAK */}
      <Text style={styles.brand}>
        SiPrak
      </Text>

      {/* PENYEIMBANG POSISI */}
      <View style={styles.rightSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 85,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  backButton: {
    alignItems: 'center',
    backgroundColor: '#292929',
    borderRadius: 22,
    height: 40,
    justifyContent: 'center',
    width: 40,
    marginTop: 28,
  },

  brand: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 28,
  },

  rightSpacer: {
    width: 40,
  },

  pressed: {
    opacity: 0.65,
  },
});