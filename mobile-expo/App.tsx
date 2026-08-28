import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
// ANDROID FIX: GestureHandlerRootView is required at root for proper gesture handling
// This ensures react-native-gesture-handler works correctly and prevents touch interception issues
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// ANDROID FIX: SafeAreaProvider is required at root for consistent safe area inset values
// across all screens, especially for bottom navigation bar avoidance
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { LocationProvider } from './src/hooks/LocationContext';
import { IntelProvider } from './src/hooks/useIntel';
import { ThemeProvider } from './src/hooks/useTheme';
import { PersonalHealthDataProvider } from './src/hooks/PersonalHealthDataContext';
import { I18nProvider } from './src/i18n';
import { configureNotifications } from './src/services/notifications';
import { initSentry } from './src/services/sentry';
import VersionGate from './src/components/VersionGate';
import { FeedbackProvider } from './src/components';

// Start crash/error reporting as early as possible so startup errors are caught.
initSentry();

// Prevent native splash from auto-hiding
ExpoSplashScreen.preventAutoHideAsync();

// Configure notifications early
configureNotifications();

function App() {
  const [appReady, setAppReady] = useState(false);

  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter_24pt-Regular.ttf'),
    'Inter-Medium': require('./assets/fonts/Inter_24pt-Medium.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter_24pt-SemiBold.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter_24pt-Bold.ttf'),
    // Display / heading face — Schibsted Grotesk (static instances)
    'SchibstedGrotesk-SemiBold': require('./assets/fonts/SchibstedGrotesk-SemiBold.ttf'),
    'SchibstedGrotesk-Bold': require('./assets/fonts/SchibstedGrotesk-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Fonts ready → hide the native splash (the logo) and go straight to the
      // app. No custom animated splash: the native logo splash IS the intro,
      // and the version check happens invisibly inside VersionGate.
      ExpoSplashScreen.hideAsync();
      setAppReady(true);
    }
  }, [fontsLoaded]);

  // Still loading fonts — the native splash (logo) is showing.
  if (!appReady) return null;

  // Main app
  // ANDROID FIX: GestureHandlerRootView must wrap the entire app for gesture handler to work
  // SafeAreaProvider provides safe area insets to all child components
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <FeedbackProvider>
              <AuthProvider>
                <PersonalHealthDataProvider>
                  <LocationProvider>
                    <IntelProvider>
                      <VersionGate>
                        <RootNavigator />
                      </VersionGate>
                    </IntelProvider>
                  </LocationProvider>
                </PersonalHealthDataProvider>
              </AuthProvider>
            </FeedbackProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Wrap the root so Sentry catches render crashes and instruments the app.
export default Sentry.wrap(App);

const styles = StyleSheet.create({
  // ANDROID FIX: Root container must use flex: 1 to fill the screen properly
  root: {
    flex: 1,
  },
});
