import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={styles.tabList}>
        <TabTrigger name="schedule" href="/schedule" asChild>
          <Pressable style={styles.tab}>
            <Text style={styles.label}>Jadwal</Text>
          </Pressable>
        </TabTrigger>

        <TabTrigger name="explore" href="/explore" asChild>
          <Pressable style={styles.tab}>
            <Text style={styles.label}>Riwayat</Text>
          </Pressable>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabList: {
    alignItems: 'center',
    bottom: 16,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
  },
  tab: {
    backgroundColor: '#E5E5E5',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  label: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
