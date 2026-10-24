import { router } from 'expo-router';
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HeaderProfileBar from '@/components/common/HeaderProfileBar';
import StatusBadge from '@/components/common/StatusBadge';
import { usePracticum } from '@/context/PracticumContext';

export default function ScheduleScreen() {
  const { sessions } = usePracticum();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <FlatList
        contentContainerStyle={styles.content}
        data={sessions}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>
              Jadwal Praktikum
            </Text>

            <Text style={styles.subtitle}>
              Kelola sesi dan pantau kehadiran praktikan.
            </Text>

            <HeaderProfileBar />

            <Text style={styles.sectionTitle}>
              Sesi Praktikum
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/session/[id]',
                params: { id: item.id },
              })
            }
            style={({ pressed }) => [
              styles.card,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.sessionName}>
                {item.practicumName}
              </Text>

              <StatusBadge status={item.status} />
            </View>

            <Text style={styles.module}>
              {item.moduleTitle.replace(
                /^Modul\s*(\d+)\s*:\s*/i,
                'Pertemuan $1: ',
              )}
            </Text>

            <View style={styles.metadata}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>
                  Lokasi
                </Text>

                <Text style={styles.metadataValue}>
                  {item.classRoom}
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>
                  Jadwal
                </Text>

                <Text style={styles.metadataValue}>
                  {item.scheduleTime}
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.attendance}>
                {item.attendances.length} praktikan hadir
              </Text>

              <Text style={styles.detailText}>
                Lihat detail ›
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Belum Ada Sesi
            </Text>

            <Text style={styles.emptyText}>
              Jadwal praktikum belum tersedia.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    gap: 8,
    marginBottom: 20,
  },
  title: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  pressed: {
    opacity: 0.78,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sessionName: {
    color: '#000000',
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  module: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  metadata: {
    gap: 10,
  },
  metadataRow: {
    gap: 4,
  },
  metadataLabel: {
    color: '#666666',
    fontSize: 12,
  },
  metadataValue: {
    color: '#404040',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    alignItems: 'center',
    borderTopColor: '#E5E5E5',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 12,
  },
  attendance: {
    color: '#404040',
    fontSize: 13,
    fontWeight: '600',
  },
  detailText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    borderColor: '#D9D9D9',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#666666',
    fontSize: 13,
    textAlign: 'center',
  },
});