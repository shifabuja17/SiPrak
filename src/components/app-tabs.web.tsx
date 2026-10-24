import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={styles.tabList}>
        <TabTrigger name="home" href="/" asChild>
          <Pressable style={styles.tab}><View><Text style={styles.label}>Jadwal</Text></View></Pressable>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabList: { alignItems: 'center', bottom: 16, flexDirection: 'row', justifyContent: 'center', position: 'absolute', width: '100%' },
  tab: { backgroundColor: '#E5E5E5', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10 },
  label: { color: '#000000', fontSize: 14, fontWeight: '700' },
});
