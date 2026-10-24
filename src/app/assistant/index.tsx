import { FlatList, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { SessionCard } from '@/features/assistant/components/session-card';
import { useAssistantSessions } from '@/features/assistant/state/assistant-sessions-context';

export default function AssistantScheduleScreen() {
  const { sessions } = useAssistantSessions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SessionCard session={item} onPress={() => router.push({ pathname: '/assistant/session/[sessionId]', params: { sessionId: item.id } })} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Jadwal Praktikum</Text>
            <Text style={styles.subtitle}>Kelola sesi dan pantau kehadiran praktikan.</Text>
            <View style={styles.profile}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>B</Text></View><View><Text style={styles.profileName}>Budi Santoso</Text><Text style={styles.profileRole}>Asisten Praktikum</Text></View><Text style={styles.switch}>Ganti akun</Text></View>
            <Text style={styles.sectionTitle}>Sesi Praktikum</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFFFFF', flex: 1 },
  content: { padding: 20, paddingTop: 48, paddingBottom: 40 },
  header: { gap: 8, marginBottom: 20 },
  title: { color: '#000000', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#666666', fontSize: 14, lineHeight: 21 },
  profile: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D9D9D9', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 11, marginTop: 12, padding: 13 },
  profileAvatar: { alignItems: 'center', backgroundColor: '#E5E5E5', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  profileInitial: { color: '#000000', fontWeight: '800' },
  profileName: { color: '#000000', fontSize: 13, fontWeight: '700' },
  profileRole: { color: '#666666', fontSize: 12, marginTop: 2 },
  switch: { color: '#000000', fontSize: 12, fontWeight: '700', marginLeft: 'auto' },
  sectionTitle: { color: '#000000', fontSize: 18, fontWeight: '700', marginTop: 16 },
  separator: { height: 12 },
});
