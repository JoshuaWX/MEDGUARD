const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

module.exports = ({ config: baseConfig }) => {
  // Expo passes the normalized app.json values here. Keeping them in the
  // dynamic config prevents environment-specific secrets from replacing the
  // native permission, version, or signing configuration.
  const config = {
    ...baseConfig,
    extra: {
      ...(baseConfig.extra || {}),
      ...(supabaseUrl ? { supabaseUrl } : {}),
      ...(supabasePublishableKey ? { supabasePublishableKey } : {}),
      ...(supabaseAnonKey ? { supabaseAnonKey } : {}),
    },
  };

  if (googleMapsApiKey) {
    config.ios = {
      ...(config.ios || {}),
      config: {
        ...((config.ios && config.ios.config) || {}),
        googleMapsApiKey,
      },
    };

    config.android = {
      ...(config.android || {}),
      config: {
        ...((config.android && config.android.config) || {}),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    };
  }

  return config;
};
