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
