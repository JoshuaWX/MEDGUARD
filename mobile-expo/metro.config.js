// Metro configuration for MedGuard (Expo).
//
// We use Sentry's Expo Metro wrapper (`getSentryExpoConfig`) instead of the
// default `getDefaultConfig`. It behaves identically for bundling but also
// stamps each JS bundle with a "debug ID" and emits source maps, so crashes in
// a release build resolve to the real .tsx file/line in Sentry (instead of
// minified gibberish). Source maps are uploaded at build time by the
// `@sentry/react-native` config plugin using SENTRY_AUTH_TOKEN.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
