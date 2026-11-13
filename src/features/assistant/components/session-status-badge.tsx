import { StyleSheet, Text, View } from 'react-native';

import type { SessionStatus } from '../types';

const STATUS_LABEL: Record<SessionStatus, string> = {
  dijadwalkan: 'BELUM DIBUKA',
  dibuka: 'BERLANGSUNG',
  ditutup: 'SELESAI',
};

const STATUS_COLORS: Record<
  SessionStatus,
  { background: string; text: string }
> = {
  dijadwalkan: {
    background: '#F2F2F2',
    text: '#404040',
  },
  dibuka: {
    background: '#E5E5E5',
    text: '#000000',
  },
  ditutup: {
    background: '#D9D9D9',
    text: '#000000',
  },
};

export function SessionStatusBadge({
  status,
}: {
  status: SessionStatus;
}) {
  const colors = STATUS_COLORS[status];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.label, { color: colors.text }]}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});