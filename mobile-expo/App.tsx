import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
// ANDROID FIX: GestureHandlerRootView is required at root for proper gesture handling
// This ensures react-native-gesture-handler works correctly and prevents touch interception issues
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// ANDROID FIX: SafeAreaProvider is required at root for consistent safe area inset values
// across all screens, especially for bottom navigation bar avoidance
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { LocationProvider } from './src/hooks/LocationContext';
import { ThemeProvider } from './src/hooks/useTheme';
import { I18nProvider } from './src/i18n';
import SplashScreen from './src/screens/SplashScreen';
import { configureNotifications } from './src/services/notifications';
import VersionGate from './src/components/VersionGate';

// Prevent native splash from auto-hiding
ExpoSplashScreen.preventAutoHideAsync();

// Configure notifications early
configureNotifications();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter_24pt-Regular.ttf'),
    'Inter-Medium': require('./assets/fonts/Inter_24pt-Medium.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter_24pt-SemiBold.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter_24pt-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Hide native splash screen, show our custom animated one
      ExpoSplashScreen.hideAsync();
      setAppReady(true);
    }
  }, [fontsLoaded]);

  const handleSplashComplete = useCallback(() => {
    setSplashComplete(true);
  }, []);

  // Still loading fonts - native splash is showing
  if (!appReady) return null;

  // Show our custom animated splash screen
  if (!splashComplete) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  // Main app
  // ANDROID FIX: GestureHandlerRootView must wrap the entire app for gesture handler to work
  // SafeAreaProvider provides safe area insets to all child components
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <LocationProvider>
                <VersionGate>
                  <RootNavigator />
                </VersionGate>
              </LocationProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // ANDROID FIX: Root container must use flex: 1 to fill the screen properly
  root: {
    flex: 1,
  },
});
