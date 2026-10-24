import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PracticumSession } from '../types';
import { SessionMetadataIcon } from './session-metadata-icon';
import { SessionStatusBadge } from './session-status-badge';

type SessionCardProps = {
  session: PracticumSession;
  onPress: () => void;
};

export function SessionCard({ session, onPress }: SessionCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.title}>{session.practicumName}</Text>
        <SessionStatusBadge status={session.status} />
      </View>
      <Text style={styles.module}>{session.moduleTitle.replace(/^Modul\s*(\d+)\s*:\s*/i, 'Pertemuan $1: ')}</Text>
      <View style={styles.metadata}>
        <View style={styles.metadataRow}>
          <SessionMetadataIcon type="location" />
          <Text style={styles.metaText}>{session.classRoom}</Text>
        </View>
        <View style={styles.metadataRow}>
          <SessionMetadataIcon type="time" />
          <Text style={styles.metaText}>{session.scheduleTime}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.attendance}>{session.attendances.length} praktikan hadir</Text>
        {/* <Text style={styles.openDetail}>Lihat detail</Text> */}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#D9D9D9', borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 },
  pressed: { opacity: 0.78 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  title: { color: '#000000', flex: 1, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  module: { color: '#404040', fontSize: 14, fontWeight: '600' },
  metadata: { gap: 7 },
  metadataRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  metaText: { color: '#666666', fontSize: 13 },
  footer: { alignItems: 'center', borderTopColor: '#E5E5E5', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12 },
  attendance: { color: '#404040', fontSize: 13, fontWeight: '600' },
  openDetail: { color: '#000000', fontSize: 13, fontWeight: '700' },
});
