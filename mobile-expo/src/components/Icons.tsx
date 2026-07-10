/**
 * Icon Components
 * SVG icons matching the web application
 */

import React from 'react';
import Svg, { Path, Circle, Defs, Mask, Rect, G } from 'react-native-svg';
import { Colors } from '../../theme';

interface IconProps {
  size?: number;
  color?: string;
}

// MedGuard brand mark — a modernized shield with a checkmark punched out of it.
// Single-color (fills with `color`) so it tints correctly everywhere: white on
// gradients, muted on the health disclaimer, etc. The check is a negative-space
// hole (via a mask) so the background reads through it.
const SHIELD_PATH =
  'M256 84C322 111 374 119 404 121C411 214 398 333 256 431C114 333 101 214 108 121C138 119 190 111 256 84Z';
const CHECK_PATH = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';

// Unique mask id per instance (avoids id collisions when several render at once).
let shieldMaskSeq = 0;

export const ShieldIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => {
  const maskId = React.useMemo(() => `mg-shield-${shieldMaskSeq++}`, []);
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <Mask id={maskId}>
          <Rect x="0" y="0" width="512" height="512" fill="#fff" />
          <G transform="translate(146,131) scale(9.1)">
            <Path d={CHECK_PATH} fill="#000" />
          </G>
        </Mask>
      </Defs>
      <Path d={SHIELD_PATH} fill={color} mask={`url(#${maskId})`} />
    </Svg>
  );
};

export const BellIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
    <Path d="M221.8 175.94C216.25 166.38 208 139.33 208 104a80 80 0 1 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h40.81a40 40 0 0 0 78.38 0H208a16 16 0 0 0 13.8-24.06ZM128 216a24 24 0 0 1-22.62-16h45.24A24 24 0 0 1 128 216ZM48 184c7.7-13.24 16-43.92 16-80a64 64 0 1 1 128 0c0 36.05 8.28 66.73 16 80Z" />
  </Svg>
);

export const LocationIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
    <Path d="M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88Zm0 192.42C107.56 191.68 40 148.51 40 104a80 80 0 1 1 160 0c0 44.51-67.56 87.68-88 104.42Zm0-120.42a32 32 0 1 0 32-32a32.09 32.09 0 0 0-32 32Zm0 48a16 16 0 1 1 16-16a16 16 0 0 1-16 16Z" />
  </Svg>
);

export const ArrowBackIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M12 5l7 7-7 7" />
  </Svg>
);

export const EmailIcon: React.FC<IconProps> = ({ size = 24, color = Colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={4} />
    <Path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </Svg>
);

export const LockIcon: React.FC<IconProps> = ({ size = 24, color = Colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 17V9a6 6 0 1 1 12 0v8" />
    <Path d="M5 17a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2z" />
  </Svg>
);

export const PersonIcon: React.FC<IconProps> = ({ size = 24, color = Colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx={12} cy={7} r={4} />
  </Svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size = 24, color = Colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx={12} cy={13} r={4} />
  </Svg>
);

export const InfoCircleIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 16v-4M12 8h.01" />
  </Svg>
);

export const WarningIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
  </Svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size = 24, color = Colors.success }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <Path d="M22 4L12 14.01l-3-3" />
  </Svg>
);

export const PlusCircleIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textLight }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={10} />
    <Path d="M12 8v8M8 12h8" />
  </Svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 24, color = Colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </Svg>
);

export const HeartIcon: React.FC<IconProps> = ({ size = 24, color = Colors.danger }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const UserIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx={12} cy={7} r={4} />
  </Svg>
);

export const MailIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Path d="M22 6l-10 7L2 6" />
  </Svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ size = 24, color = Colors.danger }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps & { style?: any }> = ({ size = 24, color = Colors.textSecondary, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export const MenuIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12h18M3 6h18M3 18h18" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

export const SunIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={5} />
    <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const PencilIcon: React.FC<IconProps> = ({ size = 24, color = Colors.textSecondary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Svg>
);
