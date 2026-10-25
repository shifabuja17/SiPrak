import Svg, { Path } from 'react-native-svg';

type MetadataIconProps = { type: 'location' | 'time' };

export function SessionMetadataIcon({ type }: MetadataIconProps) {
  const stroke = '#666666';

  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      {type === 'location' ? (
        <>
          <Path d="M14.5 10.5005C14.5 9.11924 13.3808 8 12.0005 8C10.6192 8 9.5 9.11924 9.5 10.5005C9.5 11.8808 10.6192 13 12.0005 13C13.3808 13 14.5 11.8808 14.5 10.5005Z" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M11.9995 21C10.801 21 4.5 15.8984 4.5 10.5633C4.5 6.38664 7.8571 3 11.9995 3C16.1419 3 19.5 6.38664 19.5 10.5633C19.5 15.8984 13.198 21 11.9995 21Z" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <Path d="M21.2498 12.0005C21.2498 17.1095 17.1088 21.2505 11.9998 21.2505C6.89076 21.2505 2.74976 17.1095 2.74976 12.0005C2.74976 6.89149 6.89076 2.75049 11.9998 2.75049C17.1088 2.75049 21.2498 6.89149 21.2498 12.0005Z" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15.4314 14.9429L11.6614 12.6939V7.84686" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}
