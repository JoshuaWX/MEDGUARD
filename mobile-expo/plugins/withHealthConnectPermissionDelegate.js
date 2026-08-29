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

const fs = require('fs');
const path = require('path');
const { withMainActivity, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
const READ_STEPS = 'android.permission.health.READ_STEPS';
const RATIONALE_ACTIVITY = '.HealthConnectPrivacyActivity';
const PERMISSION_USAGE_ALIAS = '.HealthConnectPermissionUsageActivity';

function ensureManifestEntry(application, entry) {
  const existing = application[entry.key] || [];
  if (!existing.some((item) => item.$?.['android:name'] === entry.value.$['android:name'])) {
    application[entry.key] = [...existing, entry.value];
  }
}

function privacyActivitySource(packageName) {
  return `package ${packageName}

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

/** Local Health Connect permission-usage explanation for internal builds. */
class HealthConnectPrivacyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    title = "MedGuard and Health Connect"
    val padding = (24 * resources.displayMetrics.density).toInt()
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
      gravity = Gravity.CENTER_VERTICAL
    }
    layout.addView(TextView(this).apply {
      textSize = 22f
      text = "How MedGuard uses Health Connect"
    })
    layout.addView(TextView(this).apply {
      textSize = 16f
      setPadding(0, padding, 0, 0)
      text = "When you choose Connect all-day steps, MedGuard asks to read step totals only. It does not write Health Connect data, and it never reads diagnoses, medications, heart rate, or other health records. You can remove this permission any time in Health Connect."
    })
    setContentView(layout)
  }
}
`;
}

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
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) throw new Error('[withHealthConnectPermissionDelegate] Android application node is missing.');
    const permissions = manifest['uses-permission'] || [];
    if (!permissions.some((item) => item.$?.['android:name'] === READ_STEPS)) {
      permissions.push({ $: { 'android:name': READ_STEPS } });
      manifest['uses-permission'] = permissions;
    }
    ensureManifestEntry(application, {
      key: 'activity',
      value: { $: { 'android:name': RATIONALE_ACTIVITY, 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }], category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }] }] },
    });
    ensureManifestEntry(application, {
      key: 'activity-alias',
      value: { $: { 'android:name': PERMISSION_USAGE_ALIAS, 'android:targetActivity': RATIONALE_ACTIVITY, 'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE', 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }], category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }] }] },
    });
    return cfg;
  });
  config = withDangerousMod(config, ['android', async (cfg) => {
    const packageName = config.android?.package;
    if (!packageName) throw new Error('[withHealthConnectPermissionDelegate] android.package is required.');
    const sourceDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'));
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'HealthConnectPrivacyActivity.kt'), privacyActivitySource(packageName));
    return cfg;
  }]);
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
