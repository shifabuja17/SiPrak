import { StyleSheet, Text, View } from 'react-native';
import type { SessionStatus } from '@/context/PracticumContext';

interface StatusBadgeProps {
  status: SessionStatus;
}

const BADGE_CONFIG: Record<
  SessionStatus,
  { label: string; background: string; color: string }
> = {
  UPCOMING: {
    label: 'BELUM DIBUKA',
    background: '#F2F2F2',
    color: '#404040',
  },
  OPEN: {
    label: 'BERLANGSUNG',
    background: '#E5E5E5',
    color: '#000000',
  },
  CLOSED: {
    label: 'SELESAI',
    background: '#D9D9D9',
    color: '#000000',
  },
};

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config = BADGE_CONFIG[status];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.background },
      ]}
    >
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
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