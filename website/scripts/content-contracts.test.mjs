import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('homepage keeps the public-interest story and prototype boundaries', async () => {
  const homepage = await read('../src/pages/index.astro');
  const required = [
    'Nigeria-first early-warning prototype',
    'Earlier signals.',
    'Wider reach.',
    'Join the prototype',
    'Explore a pilot',
    'Share a suggestion',
    'Prototype · Awareness only · Not diagnosis',
    'No partner logos.',
    'An honest invitation.',
    'Impact to validate',
    'SMS and USSD',
  ];

  for (const phrase of required) {
    assert.ok(homepage.includes(phrase), `Missing required homepage phrase: ${phrase}`);
  }
});

test('homepage does not make prohibited unqualified claims', async () => {
  const homepage = (await read('../src/pages/index.astro')).toLowerCase();
  const prohibited = [
    'predicts outbreaks',
    'real-time nationwide alerts',
    'life-saving',
    'proven surveillance',
    'helps authorities respond before diseases spread',
  ];

  for (const phrase of prohibited) {
    assert.equal(homepage.includes(phrase), false, `Unsupported claim found: ${phrase}`);
  }
});

test('the Android prototype download is clearly labelled and uses the approved external destination', async () => {
  const download = await read('../src/components/PrototypeDownload.astro');
  const layout = await read('../src/layouts/BaseLayout.astro');
  assert.match(download, /Download Android prototype/);
  assert.match(download, /Android APK/);
  assert.match(download, /Google Drive/);
  assert.match(download, /Prototype · Awareness only · Not diagnosis/);
  assert.match(download, /https:\/\/drive\.google\.com\/drive\/folders\/1_7eQvcWuw3TwA6MQvGofCgl22solBN65/);
  assert.match(download, /rel="noopener noreferrer"/);
  assert.match(layout, /operatingSystem: 'Android'/);
  assert.doesNotMatch(layout, /Android, iOS/);
});

test('atlas contains all 36 Nigerian states and the FCT', async () => {
  const atlas = JSON.parse(await read('../src/data/nigeria-adm1.json'));
  assert.equal(atlas.states.length, 37);
  assert.equal(new Set(atlas.states.map((area) => area.name)).size, 37);
  assert.ok(atlas.states.some((area) => area.name === 'Abuja Federal Capital Territory'));
  assert.match(atlas.attribution.license, /CC BY 4\.0/);
  assert.match(`${atlas.attribution.name} ${atlas.attribution.source}`, /geoBoundaries/i);
});

test('inquiry UI warns against sharing health information', async () => {
  const inquiry = await read('../src/components/InquiryForm.astro');
  assert.match(inquiry, /not included personal health information/i);
  assert.match(inquiry, /pilot/);
  assert.match(inquiry, /product_feedback/);
  assert.match(inquiry, /community_idea/);
});

test('evidence facts stay dated, sourced and separate from MedGuard impact', async () => {
  const evidence = await read('../src/components/EvidencePanel.astro');
  for (const phrase of ['41%', '27%', '10,837', '2024', 'World Bank / ITU', 'GSMA', 'WHO situation report', 'not MedGuard activity, forecasts or impact results']) {
    assert.match(evidence, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(evidence, /data\.worldbank\.org/);
  assert.match(evidence, /gsma\.com/);
  assert.match(evidence, /who\.int/);
});

test('prototype proof uses only privacy-safe synthetic renders', async () => {
  const proof = await read('../src/components/PrototypeProof.astro');
  assert.match(proof, /synthetic test-account renders/i);
  assert.match(proof, /no real people, locations, health data, or device identifiers/i);
  for (const id of ['home', 'news', 'outlook', 'signals', 'care']) {
    for (const extension of ['avif', 'webp', 'png']) {
      await access(new URL(`../public/prototype/${id}.${extension}`, import.meta.url));
    }
  }
});

test('human context photos carry direct Commons attribution and do not imply MedGuard outcomes', async () => {
  const context = await read('../src/components/HumanContext.astro');
  for (const phrase of ['Wikimedia Commons', 'CC BY 2.0', 'CC BY-SA 4.0', 'not a MedGuard service, partner or user story', 'does not imply a MedGuard partnership or endorsement']) {
    assert.match(context, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const id of ['vaccination-outreach', 'health-workers-masaka', 'nigerian-nurse']) {
    for (const extension of ['avif', 'webp', 'jpg']) {
      await access(new URL(`../public/context/${id}.${extension}`, import.meta.url));
    }
  }
});

test('pilot brief is explicit about readiness and does not invent investment proof', async () => {
  const pilot = (await read('../src/pages/pilot.astro')).toLowerCase();
  for (const phrase of ['what exists, what needs validation, and what needs partners', 'medguard has no formal institutional partners yet', 'in the prototype', 'to validate', 'requires collaboration']) {
    assert.ok(pilot.includes(phrase), `Missing pilot-brief boundary: ${phrase}`);
  }
  for (const phrase of ['proven impact', 'funded by', 'partnered with', 'lives saved']) {
    assert.equal(pilot.includes(phrase), false, `Unsupported pilot claim found: ${phrase}`);
  }
});
