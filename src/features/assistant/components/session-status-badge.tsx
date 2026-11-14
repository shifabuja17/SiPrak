import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { SessionStatus } from '../types';

const STATUS_LABEL: Record<SessionStatus, string> = {
  dijadwalkan: 'BELUM DIBUKA',
  dibuka: 'BERLANGSUNG',
  ditutup: 'SELESAI',
};

const STATUS_COLORS: Record<
  SessionStatus,
  { background: string; text: string; icon: string }
> = {
  dijadwalkan: {
    background: '#F2F2F2',
    text: '#404040',
    icon: '#666666',
  },
  dibuka: {
    background: '#E5E5E5',
    text: '#000000',
    icon: '#000000',
  },
  ditutup: {
    background: '#D9D9D9',
    text: '#000000',
    icon: '#000000',
  },
};

function StatusIcon({
  status,
  color,
}: {
  status: SessionStatus;
  color: string;
}) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
    >
      {status === 'dijadwalkan' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M12 7V12L15 14"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {status === 'dibuka' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M10 8L16 12L10 16V8Z"
            fill={color}
            stroke={color}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </>
      )}

      {status === 'ditutup' && (
        <>
          <Circle
            cx={12}
            cy={12}
            r={9}
            stroke={color}
            strokeWidth={1.8}
          />
          <Path
            d="M8 12L10.5 14.5L16 9"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

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
      <StatusIcon
        status={status}
        color={colors.icon}
      />

      <Text
        style={[
          styles.label,
          { color: colors.text },
        ]}
        numberOfLines={1}
      >
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});