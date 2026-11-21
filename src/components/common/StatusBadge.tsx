import { StyleSheet, Text, View } from 'react-native';
import type { SessionStatus } from '@/context/PracticumContext';
import { FONT } from '@/constants/fonts';

export type StatusBadgeStatus = SessionStatus;

interface StatusBadgeProps {
  status: StatusBadgeStatus;
}

const BADGE_CONFIG: Record<
  SessionStatus,
  { label: string; background: string; color: string }
> = {
  dijadwalkan: {
    label: 'BELUM DIBUKA',
    background: '#F4F4F5',
    color: '#111014',
  },
  dibuka: {
    label: 'BERLANGSUNG',
    background: '#F47321',
    color: '#FFFFFF',
  },
  ditutup: {
    label: 'SELESAI',
    background: '#111014',
    color: '#FFFFFF',
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
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
