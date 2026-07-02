/**
 * MedGuard Tab Navigator — "Calm Clinical" bottom bar.
 *
 * Clean, floating, solid surface with a hairline border + soft shadow (no heavy
 * blur/gradient pills). Lucide icons; the active tab reads via a soft tinted
 * icon chip + primary label.
 */

import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Map as MapIcon, HeartPulse, User, type LucideIcon } from 'lucide-react-native';

import { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import MyHealthScreen from '../screens/MyHealthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useTheme } from '../hooks/useTheme';
import { Colors, BorderRadius, FontSize, FontFamily, Shadows } from '../../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon = memo(({ Cmp, focused, color }: { Cmp: LucideIcon; focused: boolean; color: string }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconChip, focused && { backgroundColor: colors.primaryTint }]}>
      <Cmp size={21} color={color} strokeWidth={focused ? 2.1 : 1.8} />
    </View>
  );
});

function TabNavigator() {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarBottomMargin = Math.max(insets.bottom, 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            bottom: tabBarBottomMargin,
            height: 64,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: isDark ? '#000' : colors.shadow,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Cmp={Home} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Cmp={MapIcon} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="MyHealth"
        component={MyHealthScreen}
        options={{
          tabBarLabel: 'Health',
          tabBarIcon: ({ focused, color }) => <TabIcon Cmp={HeartPulse} focused={focused} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => <TabIcon Cmp={User} focused={focused} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 64,
    borderRadius: BorderRadius.card,
    borderTopWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    // Symmetric padding keeps the icon+label column vertically centered.
    paddingTop: 10,
    paddingBottom: 10,
    elevation: 0,
    ...Shadows.md,
  },
  tabItem: {
    height: 64,
    paddingVertical: 0,
    justifyContent: 'center',
  },
  tabIcon: {
    marginTop: 0,
  },
  iconChip: {
    width: 44,
    height: 28,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.overline,
    marginTop: 3,
    marginBottom: 0,
    letterSpacing: 0.2,
  },
});

export default TabNavigator;
