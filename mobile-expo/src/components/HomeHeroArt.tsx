/**
 * HomeHeroArt — bespoke decorative backdrop for the Home header.
 *
 * A soft radial glow, concentric "signal" rings, and a faint ECG pulse line —
 * all drawn in the brand color at low opacity so it adds personality without
 * fighting the content. Pure SVG: crisp at any size, themeable, no raster asset.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

interface HomeHeroArtProps {
  height?: number;
}

const HomeHeroArt: React.FC<HomeHeroArtProps> = ({ height = 260 }) => {
  const { isDark, colors } = useTheme();
  const c = colors.primary;
  const ringOpacity = isDark ? 0.16 : 0.1;

  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 260" preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id="glow" cx="82%" cy="12%" r="60%">
            <Stop offset="0%" stopColor={c} stopOpacity={isDark ? 0.22 : 0.14} />
            <Stop offset="100%" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Soft glow top-right */}
        <Circle cx="330" cy="30" r="180" fill="url(#glow)" />

        {/* Concentric signal rings */}
        <Circle cx="342" cy="18" r="46" stroke={c} strokeOpacity={ringOpacity} strokeWidth={1.5} fill="none" />
        <Circle cx="342" cy="18" r="82" stroke={c} strokeOpacity={ringOpacity * 0.75} strokeWidth={1.5} fill="none" />
        <Circle cx="342" cy="18" r="120" stroke={c} strokeOpacity={ringOpacity * 0.5} strokeWidth={1.5} fill="none" />

        {/* Faint ECG pulse line */}
        <Path
          d="M -10 150 H 90 l 12 -34 l 16 64 l 14 -84 l 16 96 l 12 -42 H 210 l 10 -22 l 12 40 H 420"
          stroke={c}
          strokeOpacity={isDark ? 0.14 : 0.09}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});

export default HomeHeroArt;
