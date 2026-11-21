import { StyleSheet, Text, View } from 'react-native';

import type { LeaveRequestStatus } from '@/features/praktikan/types';
import { FONT } from '@/constants/fonts';

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
    background: '#F4F4F5',
    color: '#111014',
  },
  diterima: {
    label: 'DITERIMA',
    background: '#111014',
    color: '#FFFFFF',
  },
  ditolak: {
    label: 'DITOLAK',
    background: '#E00000',
    color: '#FFFFFF',
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
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
