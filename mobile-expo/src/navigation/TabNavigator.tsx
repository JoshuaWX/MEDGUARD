/**
 * MedGuard Tab Navigator
 * Preserves exact bottom navigation from web
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
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
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Icon components matching web SVGs exactly
const HomeIcon = ({ focused }: { focused: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : Colors.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Polyline points="9 22 9 12 15 12 15 22" />
  </Svg>
);

const MapIcon = ({ focused }: { focused: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : Colors.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <Line x1={8} y1={2} x2={8} y2={18} />
    <Line x1={16} y1={6} x2={16} y2={22} />
  </Svg>
);

const HealthIcon = ({ focused }: { focused: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : Colors.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

const ProfileIcon = ({ focused }: { focused: boolean }) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke={focused ? Colors.textLight : Colors.textSecondary}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx={12} cy={7} r={4} />
  </Svg>
);

interface TabIconWrapperProps {
  focused: boolean;
  children: React.ReactNode;
}

const TabIconWrapper: React.FC<TabIconWrapperProps> = ({ focused, children }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1 : 1, { damping: 15 }) }],
  }));

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
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill}>
            <View style={styles.tabBarBg} />
          </BlurView>
        ),
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIconWrapper focused={focused}>
              <HomeIcon focused={focused} />
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
              <MapIcon focused={focused} />
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
              <HealthIcon focused={focused} />
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
              <ProfileIcon focused={focused} />
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
    bottom: 12,
    left: 12,
    right: 12,
    height: 64,
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
