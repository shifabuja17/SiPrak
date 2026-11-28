import Svg, { Path } from 'react-native-svg';

/**
 * Ikon Iconly yang diekspor dari Figma (assets/icons/figma). Path disalin apa adanya;
 * versi *Bold* berisi penuh, versi tanpa akhiran adalah garis (Border).
 * Dibuat dari SVG oleh skrip konversi; ubah SVG-nya lalu buat ulang bila ikon berganti.
 */
export type FigmaIconName =
  | 'arrowLeft2'
  | 'arrowRight2'
  | 'arrowRight'
  | 'calendarBold'
  | 'calendar'
  | 'locationBold'
  | 'location'
  | 'permitBold'
  | 'permit'
  | 'profileBold'
  | 'profile'
  | 'timeBold'
  | 'time'
  | 'homeBold'
  | 'home';

export function FigmaIcon({
  name,
  size = 24,
  color = '#000000',
}: {
  name: FigmaIconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderPaths(name, color)}
    </Svg>
  );
}

function renderPaths(name: FigmaIconName, color: string) {
  switch (name) {
    // ARROW LEFT 2 BORDER.svg
    case 'arrowLeft2':
      return (
        <>
          <Path d="M15.5 19L8.5 12L15.5 5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // ARROW RIGHT 2 BORDER.svg
    case 'arrowRight2':
      return (
        <>
          <Path d="M8.5 5L15.5 12L8.5 19" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // ARROW RIGHT BORDER.svg
    case 'arrowRight':
      return (
        <>
          <Path d="M19.75 11.7256L4.75 11.7256" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M13.7002 5.70124L19.7502 11.7252L13.7002 17.7502" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // CALENDAR BOLD.svg
    case 'calendarBold':
      return (
        <>
          <Path d="M16.4109 2.76862L16.4119 3.51824C19.1665 3.73414 20.9862 5.6112 20.9891 8.48975L21 16.9155C21.0039 20.054 19.0322 21.985 15.8718 21.99L8.15189 22C5.0112 22.004 3.01482 20.027 3.01087 16.8796L3.00001 8.55272C2.99606 5.65517 4.75153 3.78311 7.50618 3.53024L7.50519 2.78061C7.5042 2.34083 7.83002 2.01 8.26445 2.01C8.69887 2.009 9.02469 2.33883 9.02568 2.77861L9.02666 3.47826L14.8914 3.47027L14.8904 2.77062C14.8894 2.33084 15.2152 2.001 15.6497 2C16.0742 1.99901 16.4099 2.32884 16.4109 2.76862ZM4.52149 8.86157L19.4696 8.84158V8.49175C19.4272 6.34283 18.349 5.21539 16.4139 5.04748L16.4148 5.81709C16.4148 6.24688 16.0801 6.58771 15.6556 6.58771C15.2212 6.58871 14.8944 6.24888 14.8944 5.81909L14.8934 5.0095L9.02864 5.01749L9.02962 5.82609C9.02962 6.25687 8.70479 6.5967 8.27037 6.5967C7.83595 6.5977 7.50914 6.25887 7.50914 5.82809L7.50815 5.05847C5.58286 5.25138 4.51754 6.38281 4.5205 8.55072L4.52149 8.86157ZM15.2399 13.4043V13.4153C15.2498 13.8751 15.625 14.2239 16.0801 14.2139C16.5244 14.2029 16.8789 13.8221 16.869 13.3623C16.8483 12.9225 16.4918 12.5637 16.0485 12.5647C15.5944 12.5747 15.2389 12.9445 15.2399 13.4043ZM16.0554 17.892C15.6013 17.882 15.235 17.5032 15.234 17.0435C15.2241 16.5837 15.5884 16.2029 16.0426 16.1919H16.0525C16.5165 16.1919 16.8927 16.5707 16.8927 17.0405C16.8937 17.5102 16.5185 17.891 16.0554 17.892ZM11.1721 13.4203C11.1919 13.8801 11.568 14.2389 12.0222 14.2189C12.4665 14.1979 12.821 13.8181 12.8012 13.3583C12.7904 12.9085 12.425 12.5587 11.9807 12.5597C11.5266 12.5797 11.1711 12.9605 11.1721 13.4203ZM12.0262 17.8471C11.572 17.8671 11.1968 17.5082 11.1761 17.0485C11.1761 16.5887 11.5305 16.2089 11.9847 16.1879C12.429 16.1869 12.7953 16.5367 12.8052 16.9855C12.8259 17.4463 12.4705 17.8261 12.0262 17.8471ZM7.10434 13.4553C7.12408 13.915 7.50025 14.2749 7.95442 14.2539C8.39872 14.2339 8.75317 13.8531 8.73244 13.3933C8.72257 12.9435 8.35725 12.5937 7.91197 12.5947C7.4578 12.6147 7.10335 12.9955 7.10434 13.4553ZM7.95837 17.8521C7.5042 17.8731 7.12902 17.5132 7.10828 17.0535C7.1073 16.5937 7.46274 16.2129 7.91691 16.1929C8.3612 16.1919 8.7275 16.5417 8.73738 16.9915C8.75811 17.4513 8.40366 17.8321 7.95837 17.8521Z" fillRule="evenodd" clipRule="evenodd" fill={color} />
        </>
      );
    // CALENDAR BORDER.svg
    case 'calendar':
      return (
        <>
          <Path d="M3.09277 9.40421H20.9167" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M16.442 13.3097H16.4512" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M12.0045 13.3097H12.0137" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M7.55818 13.3097H7.56744" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M16.442 17.1962H16.4512" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M12.0045 17.1962H12.0137" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M7.55818 17.1962H7.56744" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M16.0433 2V5.29078" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M7.96515 2V5.29078" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M16.2383 3.5791H7.77096C4.83427 3.5791 3 5.21504 3 8.22213V17.2718C3 20.3261 4.83427 21.9999 7.77096 21.9999H16.229C19.175 21.9999 21 20.3545 21 17.3474V8.22213C21.0092 5.21504 19.1842 3.5791 16.2383 3.5791Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // LOCATION BOLD.svg
    case 'locationBold':
      return (
        <>
          <Path d="M3.5 10.3178C3.5 5.71789 7.34388 2 11.9934 2C16.6561 2 20.5 5.71789 20.5 10.3178C20.5 12.6357 19.657 14.7876 18.2695 16.6116C16.7388 18.6235 14.8522 20.3765 12.7285 21.7524C12.2425 22.0704 11.8039 22.0944 11.2704 21.7524C9.13474 20.3765 7.24809 18.6235 5.7305 16.6116C4.34198 14.7876 3.5 12.6357 3.5 10.3178ZM9.19423 10.5768C9.19423 12.1177 10.4517 13.3297 11.9934 13.3297C13.5362 13.3297 14.8058 12.1177 14.8058 10.5768C14.8058 9.0478 13.5362 7.77683 11.9934 7.77683C10.4517 7.77683 9.19423 9.0478 9.19423 10.5768Z" fillRule="evenodd" clipRule="evenodd" fill={color} />
        </>
      );
    // LOCATION BORDER.svg
    case 'location':
      return (
        <>
          <Path d="M14.5 10.5005C14.5 9.11924 13.3808 8 12.0005 8C10.6192 8 9.5 9.11924 9.5 10.5005C9.5 11.8808 10.6192 13 12.0005 13C13.3808 13 14.5 11.8808 14.5 10.5005Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M11.9995 21C10.801 21 4.5 15.8984 4.5 10.5633C4.5 6.38664 7.8571 3 11.9995 3C16.1419 3 19.5 6.38664 19.5 10.5633C19.5 15.8984 13.198 21 11.9995 21Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // PERMIT BOLD.svg
    case 'permitBold':
      return (
        <>
          <Path d="M7.81 2H16.191C19.28 2 21 3.78 21 6.83V17.16C21 20.26 19.28 22 16.191 22H7.81C4.77 22 3 20.26 3 17.16V6.83C3 3.78 4.77 2 7.81 2ZM8.08 6.66V6.65H11.069C11.5 6.65 11.85 7 11.85 7.429C11.85 7.87 11.5 8.22 11.069 8.22H8.08C7.649 8.22 7.3 7.87 7.3 7.44C7.3 7.01 7.649 6.66 8.08 6.66ZM8.08 12.74H15.92C16.35 12.74 16.7 12.39 16.7 11.96C16.7 11.53 16.35 11.179 15.92 11.179H8.08C7.649 11.179 7.3 11.53 7.3 11.96C7.3 12.39 7.649 12.74 8.08 12.74ZM8.08 17.31H15.92C16.319 17.27 16.62 16.929 16.62 16.53C16.62 16.12 16.319 15.78 15.92 15.74H8.08C7.78 15.71 7.49 15.85 7.33 16.11C7.17 16.36 7.17 16.69 7.33 16.95C7.49 17.2 7.78 17.35 8.08 17.31Z" fillRule="evenodd" clipRule="evenodd" fill={color} />
        </>
      );
    // PERMIT BORDER.svg
    case 'permit':
      return (
        <>
          <Path d="M15.7161 16.2234H8.49609" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M15.7161 12.0369H8.49609" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M11.2521 7.86011H8.49707" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M15.909 2.74976C15.909 2.74976 8.23198 2.75376 8.21998 2.75376C5.45998 2.77076 3.75098 4.58676 3.75098 7.35676V16.5528C3.75098 19.3368 5.47298 21.1598 8.25698 21.1598C8.25698 21.1598 15.933 21.1568 15.946 21.1568C18.706 21.1398 20.416 19.3228 20.416 16.5528V7.35676C20.416 4.57276 18.693 2.74976 15.909 2.74976Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // PROFILE OR PERSON BOLD.svg
    case 'profileBold':
      return (
        <>
          <Path d="M12 15.1738C16.3384 15.1738 19.9997 15.8789 20 18.5986C20 21.3197 16.3146 22 12 22C7.6625 22 4.00021 21.295 4 18.5752C4 15.8542 7.68538 15.1738 12 15.1738ZM12 2C14.9391 2 17.2939 4.354 17.2939 7.29102C17.2939 10.228 14.9391 12.583 12 12.583C9.0619 12.583 6.70605 10.228 6.70605 7.29102C6.70607 4.354 9.06191 2 12 2Z" fill={color} />
        </>
      );
    // PROFILE OR PERSON BORDER.svg
    case 'profile':
      return (
        <>
          <Path d="M11.9849 15.3462C8.11731 15.3462 4.81445 15.931 4.81445 18.2729C4.81445 20.6148 8.09636 21.2205 11.9849 21.2205C15.8525 21.2205 19.1545 20.6348 19.1545 18.2938C19.1545 15.9529 15.8735 15.3462 11.9849 15.3462Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M11.9849 12.0059C14.523 12.0059 16.5801 9.94779 16.5801 7.40969C16.5801 4.8716 14.523 2.81445 11.9849 2.81445C9.44679 2.81445 7.3887 4.8716 7.3887 7.40969C7.38013 9.93922 9.42394 11.9973 11.9525 12.0059H11.9849Z" strokeWidth={1.42857} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // TIME BOLD.svg
    case 'timeBold':
      return (
        <>
          <Path d="M12 22C6.48 22 2 17.53 2 12C2 6.48 6.48 2 12 2C17.53 2 22 6.48 22 12C22 17.53 17.53 22 12 22ZM15.19 15.71C15.31 15.78 15.44 15.82 15.58 15.82C15.83 15.82 16.08 15.69 16.22 15.45C16.43 15.1 16.32 14.64 15.96 14.42L12.4 12.3V7.68C12.4 7.26 12.06 6.93 11.65 6.93C11.24 6.93 10.9 7.26 10.9 7.68V12.73C10.9 12.99 11.04 13.23 11.27 13.37L15.19 15.71Z" fillRule="evenodd" clipRule="evenodd" fill={color} />
        </>
      );
    // TIME BORDER.svg
    case 'time':
      return (
        <>
          <Path d="M21.25 12.0005C21.25 17.1095 17.109 21.2505 12 21.2505C6.891 21.2505 2.75 17.1095 2.75 12.0005C2.75 6.89149 6.891 2.75049 12 2.75049C17.109 2.75049 21.25 6.89149 21.25 12.0005Z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
          <Path d="M15.4311 14.9429L11.6611 12.6939V7.84692" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
    // HOME BOLD.svg
    case 'homeBold':
      return (
        <>
          <Path d="M9.13478 20.7733V17.7156C9.13478 16.9351 9.77217 16.3023 10.5584 16.3023H13.4326C13.8102 16.3023 14.1723 16.4512 14.4393 16.7163C14.7063 16.9813 14.8563 17.3408 14.8563 17.7156V20.7733C14.8539 21.0978 14.9821 21.4099 15.2124 21.6402C15.4427 21.8705 15.7561 22 16.0829 22H18.0438C18.9596 22.0023 19.8388 21.6428 20.4872 21.0008C21.1356 20.3588 21.5 19.487 21.5 18.5778V9.86686C21.5 9.13246 21.1721 8.43584 20.6046 7.96467L13.934 2.67587C12.7737 1.74856 11.1111 1.7785 9.98539 2.74698L3.46701 7.96467C2.87274 8.42195 2.51755 9.12064 2.5 9.86686V18.5689C2.5 20.4639 4.04738 22 5.95617 22H7.87229C8.55123 22 9.103 21.4562 9.10792 20.7822L9.13478 20.7733Z" fill={color} />
        </>
      );
    // HOME BORDER.svg
    case 'home':
      return (
        <>
          <Path d="M9.15722 20.7714V17.7047C9.1572 16.9246 9.79312 16.2908 10.581 16.2856H13.4671C14.2587 16.2856 14.9005 16.9209 14.9005 17.7047V17.7047V20.7809C14.9003 21.4432 15.4343 21.9845 16.103 22H18.0271C19.9451 22 21.5 20.4607 21.5 18.5618V18.5618V9.83784C21.4898 9.09083 21.1355 8.38935 20.538 7.93303L13.9577 2.6853C12.8049 1.77157 11.1662 1.77157 10.0134 2.6853L3.46203 7.94256C2.86226 8.39702 2.50739 9.09967 2.5 9.84736V18.5618C2.5 20.4607 4.05488 22 5.97291 22H7.89696C8.58235 22 9.13797 21.4499 9.13797 20.7714V20.7714" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" stroke={color} />
        </>
      );
  }
}
