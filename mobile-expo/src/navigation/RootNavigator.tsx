/**
 * MedGuard Root Navigator
 */

import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './types';
import TabNavigator from './TabNavigator';
import WelcomeScreen from '../screens/WelcomeScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignUp2Screen from '../screens/SignUp2Screen';
import AlertsScreen from '../screens/AlertsScreen';
import ChatbotScreen from '../screens/ChatbotScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAuth } from '../hooks/useAuth';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const { user, initialized, loading } = useAuth();
  const lastRoutedRef = React.useRef<string>('');
  const hasShownWelcomeThisRunRef = React.useRef(false);
  const navReadyRef = React.useRef(false);

  React.useEffect(() => {
    if (!initialized || loading) return;
    if (!navReadyRef.current) return;

    const isAuthed = Boolean(user?.id);
    const profileComplete = Boolean((user as any)?.user_metadata?.profile_complete === true);
    const unauthTarget = hasShownWelcomeThisRunRef.current ? 'SignIn' : 'Welcome';
    const target = isAuthed ? (profileComplete ? 'MainTabs' : 'SignUp2') : unauthTarget;

    const current = navigationRef.getCurrentRoute()?.name;
    if (!current) return;
    if (!isAuthed && (current === 'SignIn' || current === 'SignUp')) {
      // User is actively in the auth flow; don't bounce them back to Welcome.
      return;
    }

    const marker = `${user?.id || 'anon'}:${target}`;
    if (lastRoutedRef.current === marker) return;
    lastRoutedRef.current = marker;

    // Avoid resetting to the route we're already on (causes double-mount flash on startup).
    if (current === target) {
      if (!isAuthed && target === 'Welcome') {
        hasShownWelcomeThisRunRef.current = true;
      }
      return;
    }

    if (!isAuthed && target === 'Welcome') {
      hasShownWelcomeThisRunRef.current = true;
    }

    try {
      navigationRef.resetRoot({ index: 0, routes: [{ name: target as any }] });
    } catch {
      // If navigation isn't ready yet, don't hard-fail.
    }
  }, [initialized, loading, user, navigationRef]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        navReadyRef.current = true;
      }}
    >
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="SignUp2" component={SignUp2Screen} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="Alerts" component={AlertsScreen} />
        <Stack.Screen name="Chatbot" component={ChatbotScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default RootNavigator;
