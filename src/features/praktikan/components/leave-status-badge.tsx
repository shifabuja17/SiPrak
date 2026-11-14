import { StyleSheet, Text, View } from 'react-native';

import type { LeaveRequestStatus } from '@/features/praktikan/types';

interface LeaveStatusBadgeProps {
  status: LeaveRequestStatus;
}

interface LeaveBadgeVisualConfig {
  label: string;
  background: string;
  color: string;
}

const LEAVE_STATUS_CONFIG: Record<LeaveRequestStatus, LeaveBadgeVisualConfig> = {
  menunggu: {
    label: 'MENUNGGU',
    background: '#FEF3C7',
    color: '#B45309',
  },
  diterima: {
    label: 'DITERIMA',
    background: '#DCFCE7',
    color: '#15803D',
  },
  ditolak: {
    label: 'DITOLAK',
    background: '#FEE2E2',
    color: '#B91C1C',
  },
};

/**
 * Badge status pengajuan izin Praktikan (`MENUNGGU`, `DITERIMA`, `DITOLAK`).
 */
export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
  const config = LEAVE_STATUS_CONFIG[status];

  return (
    <View style={[styles.badge, { backgroundColor: config.background }]}>
      <Text style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

export default LeaveStatusBadge;

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
