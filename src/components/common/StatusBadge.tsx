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
    background: '#DCFCE7',
    color: '#15803D',
  },
  CLOSED: {
    label: 'SELESAI',
    background: '#FEE2E2',
    color: '#B91C1C',
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
