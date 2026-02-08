/**
 * MedGuard Tab Navigator
 * Preserves exact bottom navigation from web
 * Optimized for low-end Android devices
 * 
 * ANDROID FIXES (responsiveness):
 * - Uses safe area insets to avoid overlap with Android gesture navigation bar
 * - Removed fixed heights, uses flexbox for proper layout
 * - Tab bar properly positioned above system navigation
 */

import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
// ANDROID FIX: Import useSafeAreaInsets to respect bottom navigation bar
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polyline, Polygon, Line, Circle } from 'react-native-svg';

import { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import MyHealthScreen from '../screens/MyHealthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Detect low-end Android devices (API level < 28 = Android 9)
const isLowEndDevice = Platform.OS === 'android' && Platform.Version < 28;

// Icon components matching web SVGs exactly
const HomeIcon = memo(({ focused, isDark }: { focused: boolean; isDark: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : (isDark ? '#9ca3af' : Colors.textSecondary)}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
));

const MapIcon = memo(({ focused, isDark }: { focused: boolean; isDark: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : (isDark ? '#9ca3af' : Colors.textSecondary)}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <Line x1={8} y1={2} x2={8} y2={18} />
    <Line x1={16} y1={6} x2={16} y2={22} />
  </Svg>
));

const HealthIcon = memo(({ focused, isDark }: { focused: boolean; isDark: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : (isDark ? '#9ca3af' : Colors.textSecondary)}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
));

const ProfileIcon = memo(({ focused, isDark }: { focused: boolean; isDark: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : (isDark ? '#9ca3af' : Colors.textSecondary)}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx={12} cy={7} r={4} />
  </Svg>
));

interface TabIconWrapperProps {
  focused: boolean;
  children: React.ReactNode;
}

const TabIconWrapper: React.FC<TabIconWrapperProps> = memo(({ focused, children }) => {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    // Disable spring animation on low-end devices
    const scaleValue = isLowEndDevice ? 1 : withSpring(focused ? 1 : 1, { damping: 15 });
    return {
      transform: [{ scale: scaleValue }],
    };
  });

  return (
    <Animated.View style={[styles.iconWrapper, animatedStyle]}>
      {focused ? (
        <LinearGradient
          colors={[Colors.primary, Colors.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrapperActive}
        >
          {children}
        </LinearGradient>
      ) : (
        <View style={styles.iconWrapperInactive}>{children}</View>
      )}
    </Animated.View>
  );
});

// Tab bar background component - uses solid background on low-end devices instead of expensive blur
const TabBarBackground = memo(({ isDark }: { isDark: boolean }) => {
  if (isLowEndDevice) {
    // Use solid background on low-end devices to avoid expensive blur effect
    return (
      <View style={[StyleSheet.absoluteFill, styles.tabBarBg, { 
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        borderColor: isDark ? '#374151' : Colors.borderLight,
      }]} />
    );
  }
  return (
    <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
      <View style={[styles.tabBarBg, { 
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : Colors.whiteAlpha90,
        borderColor: isDark ? '#374151' : Colors.borderLight,
      }]} />
    </BlurView>
  );
});

function TabNavigator() {
  const { isDark, colors } = useTheme();
  // ANDROID FIX: Get safe area insets to properly position tab bar above gesture navigation
  const insets = useSafeAreaInsets();
  
  // ANDROID FIX: Calculate dynamic bottom margin to respect system navigation bar
  // This prevents the tab bar from overlapping with Android's gesture navigation
  const tabBarBottomMargin = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // ANDROID FIX: Use dynamic positioning based on safe area insets
        tabBarStyle: [
          styles.tabBar,
          {
            // Position tab bar above system navigation with proper margin
            bottom: tabBarBottomMargin,
            // ANDROID FIX: Ensure minimum height but allow flexbox to handle content
            minHeight: 64,
          },
        ],
        tabBarBackground: () => <TabBarBackground isDark={isDark} />,
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDark ? '#9ca3af' : Colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconWrapper focused={focused}>
              <HomeIcon focused={focused} isDark={isDark} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconWrapper focused={focused}>
              <MapIcon focused={focused} isDark={isDark} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tab.Screen
        name="MyHealth"
        component={MyHealthScreen}
        options={{
          tabBarLabel: 'Health',
          tabBarIcon: ({ focused }) => (
            <TabIconWrapper focused={focused}>
              <HealthIcon focused={focused} isDark={isDark} />
            </TabIconWrapper>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconWrapper focused={focused}>
              <ProfileIcon focused={focused} isDark={isDark} />
            </TabIconWrapper>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    // ANDROID FIX: bottom is now set dynamically via screenOptions based on safe area insets
    left: 12,
    right: 12,
    // ANDROID FIX: Use minHeight instead of fixed height for flexibility on different screen sizes
    minHeight: 64,
    borderRadius: BorderRadius.xl,
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.whiteAlpha90,
    borderRadius: BorderRadius.xl,
    borderWidth: 0.5,
    borderColor: Colors.borderLight,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperInactive: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    marginTop: 2,
  },
});

export default TabNavigator;
