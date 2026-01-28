import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { LocationProvider } from './src/hooks/LocationContext';
import { ThemeProvider } from './src/hooks/useTheme';
import { I18nProvider } from './src/i18n';
import SplashScreen from './src/screens/SplashScreen';

// Prevent native splash from auto-hiding
ExpoSplashScreen.preventAutoHideAsync();

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
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <LocationProvider>
            <RootNavigator />
          </LocationProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
