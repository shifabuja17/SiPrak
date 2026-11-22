import Svg, { Circle, Path } from 'react-native-svg';

/** Ikon orang untuk bingkai profil (pengganti inisial nama). */
export default function PersonIcon({
  size = 22,
  color = '#111014',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <Path
        d="M4 21C4 16.8 7.2 14 12 14C16.8 14 20 16.8 20 21"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
