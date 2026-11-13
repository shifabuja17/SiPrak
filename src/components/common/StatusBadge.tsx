import { StyleSheet, Text, View } from 'react-native';

import type { SessionStatus as LegacySessionStatus } from '@/context/PracticumContext';
import type { FirestoreSessionStatus } from '@/features/praktikan/types';

export type StatusBadgeStatus = FirestoreSessionStatus | LegacySessionStatus;

interface StatusBadgeProps {
  status: StatusBadgeStatus;
}

interface BadgeVisualConfig {
  label: string;
  background: string;
  color: string;
}

const SPRINT2_BADGE_CONFIG: Record<FirestoreSessionStatus, BadgeVisualConfig> = {
  dijadwalkan: {
    label: 'BELUM DIBUKA',
    background: '#F2F2F2',
    color: '#404040',
  },
  dibuka: {
    label: 'BERLANGSUNG',
    background: '#DCFCE7',
    color: '#15803D',
  },
  ditutup: {
    label: 'SELESAI',
    background: '#FEE2E2',
    color: '#B91C1C',
  },
};

// Alias sementara untuk kompatibilitas layar Sprint 1 sebelum integrasi penuh.
const BADGE_CONFIG: Record<StatusBadgeStatus, BadgeVisualConfig> = {
  ...SPRINT2_BADGE_CONFIG,
  UPCOMING: SPRINT2_BADGE_CONFIG.dijadwalkan,
  OPEN: SPRINT2_BADGE_CONFIG.dibuka,
  CLOSED: SPRINT2_BADGE_CONFIG.ditutup,
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
