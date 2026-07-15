/**
 * Expo config plugin — register the Health Connect permission delegate.
 *
 * react-native-health-connect requires the host app to call
 *   HealthConnectPermissionDelegate.setPermissionDelegate(this)
 * inside MainActivity.onCreate (it registers the ActivityResultLauncher that
 * `requestPermission()` later launches). The library does NOT do this itself,
 * and its bundled config plugin only adds the rationale intent-filter — so in an
 * Expo managed app the launcher is never initialized and the first permission
 * request crashes with:
 *   UninitializedPropertyAccessException: lateinit property requestPermission
 *   has not been initialized   (Sentry MEDGUARD-2)
 *
 * This plugin injects the import + the setPermissionDelegate(this) call into the
 * generated Kotlin MainActivity during prebuild. Idempotent.
 */

const { withMainActivity } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

function ensureImport(src) {
  if (src.includes(IMPORT_LINE)) return src;
  // Place the import directly after the package declaration.
  return src.replace(/^(package .+)$/m, `$1\n\n${IMPORT_LINE}`);
}

function ensureDelegateCall(src) {
  if (src.includes(DELEGATE_CALL)) return src;
  // Insert right after super.onCreate(...) inside onCreate. registerForActivityResult
  // must run before the activity is STARTED — onCreate satisfies that.
  return src.replace(
    /(super\.onCreate\([^)]*\)\s*)/,
    `$1\n    ${DELEGATE_CALL}\n`,
  );
}

module.exports = function withHealthConnectPermissionDelegate(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error(
        '[withHealthConnectPermissionDelegate] expected a Kotlin MainActivity; got ' +
          cfg.modResults.language,
      );
    }
    let src = cfg.modResults.contents;
    src = ensureImport(src);
    src = ensureDelegateCall(src);
    cfg.modResults.contents = src;
    return cfg;
  });
};
