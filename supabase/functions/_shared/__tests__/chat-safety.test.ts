import assert from 'node:assert/strict';
import test from 'node:test';
import { EMERGENCY_RESPONSE, isClearEmergency, suggestSymptomsFromMessage } from '../chat-safety.ts';

test('clear red flags route deterministically to Nigeria 112', () => {
  assert.equal(isClearEmergency('I have chest pain and cannot breathe'), true);
  assert.equal(isClearEmergency('What can cause a mild cough?'), false);
  assert.match(EMERGENCY_RESPONSE, /112/);
  assert.doesNotMatch(EMERGENCY_RESPONSE, /911/);
});

test('symptoms are suggestions only for an affirmative first-person report', () => {
  assert.deepEqual(suggestSymptomsFromMessage('I have fever and a headache'), ['fever', 'headache']);
  assert.deepEqual(suggestSymptomsFromMessage('What causes fever?'), []);
  assert.deepEqual(suggestSymptomsFromMessage('I have no fever'), []);
});
