import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = join(process.cwd(), 'mobile-expo');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('background location task is defined during bundle startup', () => {
  const entry = read('index.ts');
  const task = read('src/services/backgroundLocationTask.ts');
  assert.match(entry, /import ['"]\.\/src\/services\/backgroundLocationTask['"];?/);
  assert.match(task, /TaskManager\.defineTask\(BACKGROUND_LOCATION_TASK/);
  assert.doesNotMatch(task, /export function registerBackgroundLocationTask/);
});

test('all health-intelligence consumers share one provider', () => {
  const app = read('App.tsx');
  const alertsHook = read('src/hooks/useAlerts.ts');
  assert.match(app, /<IntelProvider>/);
  assert.match(alertsHook, /useIntel\(\)/);
  assert.doesNotMatch(alertsHook, /invokeEdgeFunction<.*>\('intel'/s);
});

test('My Health owns the unified personal and area Health Signals card', () => {
  const myHealth = read('src/screens/MyHealthScreen.tsx');
  const home = read('src/screens/HomeScreen.tsx');
  const alerts = read('src/screens/AlertsScreen.tsx');
  assert.match(myHealth, /<HealthSignalsCard/);
  assert.doesNotMatch(home, /<BrainCard/);
  assert.doesNotMatch(alerts, /<BrainCard/);
});

test('Alerts badge counts verified reports only', () => {
  const alerts = read('src/screens/AlertsScreen.tsx');
  assert.match(alerts, /activeAlertCount\s*=\s*communityAlerts\.length/);
  assert.doesNotMatch(alerts, /communityAlerts\.length\s*\+\s*visibleRiskAdvisories\.length/);
});

test('Home area outlook is response-driven and has no fixed risk-map card', () => {
  const home = read('src/screens/HomeScreen.tsx');
  assert.match(home, /CURRENT AREA OUTLOOK/);
  assert.doesNotMatch(home, /<DiseaseOutlookCard/);
  assert.doesNotMatch(home, /useRiskMap\(/);
});

test('Health Connect asks for Steps before opening settings', () => {
  const screen = read('src/screens/MyHealthScreen.tsx');
  const hook = read('src/hooks/useSteps.ts');
  const plugin = read('plugins/withHealthConnectPermissionDelegate.js');

  assert.match(screen, /await connectSteps\(\)/);
  assert.doesNotMatch(screen, /stepAccessState === 'health_connect_permission'[\s\S]{0,300}await openStepSettings\(\)/);
  assert.match(hook, /persistSteps\(today, 'health_connect'\)/);
  assert.match(plugin, /android\.permission\.health\.READ_STEPS/);
  assert.match(plugin, /VIEW_PERMISSION_USAGE/);
});

test('disease-specific area outlooks use verified reports and active forecasts only', () => {
  const home = read('src/screens/HomeScreen.tsx');
  const intel = readFileSync(join(process.cwd(), 'supabase/functions/intel/index.ts'), 'utf8');

  assert.match(home, /intel\?\.areaOutlook/);
  assert.doesNotMatch(home, /riskAssessment\?\.diseases/);
  assert.match(intel, /areaOutlook/);
  assert.match(intel, /loadVerifiedReports/);
  assert.match(intel, /loadRiskForecast/);
});

test('chat never silently writes symptoms or rotates free models', () => {
  const chat = readFileSync(join(process.cwd(), 'supabase/functions/chat/index.ts'), 'utf8');
  assert.doesNotMatch(chat, /FREE_MODELS/);
  assert.doesNotMatch(chat, /from\('symptom_logs'\)\.insert\(rows\)/);
  assert.match(chat, /symptomSuggestion/);
  assert.match(chat, /Nigeria's emergency number 112/);
});

test('Health News uses direct post-ingestion delivery and hardened cron timing', () => {
  const repo = process.cwd();
  const ingestion = readFileSync(join(repo, 'supabase/functions/ingest-health-news/index.ts'), 'utf8');
  const fallback = readFileSync(join(repo, 'supabase/functions/notify-area/index.ts'), 'utf8');
  const migrationName = readdirSync(join(repo, 'supabase/migrations')).find((name) => name.endsWith('_reliable_health_news_delivery.sql'));
  assert.ok(migrationName);
  const migration = readFileSync(join(repo, 'supabase/migrations', migrationName), 'utf8');
  assert.match(ingestion, /dispatchHealthNews\(admin/);
  assert.match(fallback, /dispatchHealthNews\(admin/);
  assert.match(migration, /timeout_milliseconds\s*:=\s*30000/);
  assert.match(migration, /'17 \* \* \* \*'/);
});

test('chat history is virtualized and paginated without local message caching', () => {
  const screen = read('src/screens/ChatbotScreen.tsx');
  assert.match(screen, /<FlatList/);
  assert.match(screen, /MESSAGE_PAGE_SIZE/);
  assert.match(screen, /loadEarlierMessages/);
  assert.doesNotMatch(screen, /AsyncStorage\.setItem\([^\n]*(chat_messages|messages)/);
});

test('facility cache identity includes the authenticated owner and clears by namespace', () => {
  const repository = read('src/services/facilityRepository.ts');
  const cache = read('src/services/personalHealthCache.ts');
  assert.match(repository, /`\$\{query\.userId\}\|\$\{key\(query\)\}`/);
  assert.match(repository, /clearSecureUserNamespace\('facilities'/);
  assert.match(cache, /clearSecureUserNamespace/);
});

test('release 5 native metadata and Health Connect handlers are deterministic', () => {
  const app = JSON.parse(read('app.json')) as { expo: { android: { versionCode: number }; ios: { buildNumber: string }; plugins: unknown[] } };
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.equal(app.expo.android.versionCode, 5);
  assert.equal(app.expo.ios.buildNumber, '5');
  assert.doesNotMatch(JSON.stringify(app.expo.plugins), /"react-native-health-connect"/);
  assert.match(gradle, /versionCode 5/);
  assert.match(gradle, /signingConfig signingConfigs\.release/);
  assert.doesNotMatch(gradle, /release \{[\s\S]{0,240}signingConfig signingConfigs\.debug/);
  assert.equal((manifest.match(/androidx\.health\.ACTION_SHOW_PERMISSIONS_RATIONALE/g) ?? []).length, 1);
});
