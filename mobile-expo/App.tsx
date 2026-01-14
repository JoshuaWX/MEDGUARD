import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { LocationProvider } from './src/hooks/LocationContext';
import { I18nProvider } from './src/i18n';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter_24pt-Regular.ttf'),
    'Inter-Medium': require('./assets/fonts/Inter_24pt-Medium.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter_24pt-SemiBold.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter_24pt-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <I18nProvider>
      <AuthProvider>
        <LocationProvider>
          <RootNavigator />
        </LocationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
