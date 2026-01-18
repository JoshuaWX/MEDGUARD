import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../theme';

interface MoonIconProps {
  size?: number;
  color?: string;
}

const MoonIcon: React.FC<MoonIconProps> = ({ size = 24, color = Colors.primary }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
};

export default MoonIcon;
