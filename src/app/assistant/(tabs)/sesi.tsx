import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AssistantLeaveRequestsScreen from '@/app/assistant/leave-requests';
import AssistantSessionsScreen from '@/app/assistant/sessions';
import TabScreen from '@/components/common/tab-screen';
import { FONT } from '@/constants/fonts';

type Section = 'sesi' | 'izin';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'sesi', label: 'Sesi & Presensi' },
  { key: 'izin', label: 'Pengajuan Izin' },
];

/**
 * Tab Sesi Asisten: Sesi & Presensi (FR-08, FR-12, FR-13) dan Pengajuan Izin
 * (FR-18, FR-19) dalam satu tab, dipilih lewat tombol di atas.
 */
export default function SesiTab() {
  const [section, setSection] = useState<Section>('sesi');

  return (
    <TabScreen>
      <SafeAreaView style={styles.switchArea} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.switch} accessibilityRole="tablist">
          {SECTIONS.map((item) => {
            const active = item.key === section;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSection(item.key)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {section === 'sesi' ? <AssistantSessionsScreen /> : <AssistantLeaveRequestsScreen />}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  switchArea: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  switch: {
    borderColor: '#8E8E93',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  option: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  optionActive: {
    backgroundColor: '#111014',
  },
  optionText: {
    fontFamily: FONT.semibold,
    color: '#111014',
    fontSize: 13,
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  body: {
    flex: 1,
  },
});
