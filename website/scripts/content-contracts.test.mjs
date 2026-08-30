import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
