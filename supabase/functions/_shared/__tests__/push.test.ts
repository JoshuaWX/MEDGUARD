import assert from 'node:assert/strict';
import test from 'node:test';
import { getExpoReceipts, sendExpoPush, type ExpoMessage } from '../push.ts';
import { matchPushRecipients } from '../push-recipients.ts';

const message = (to: string): ExpoMessage => ({
  to,
  title: 'Test',
  body: 'Test body',
  sound: 'default',
  channelId: 'health-news',
  data: { type: 'health_post', postId: 'post-1' },
});

test('Expo ticket acceptance and rejection are recorded truthfully', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'Message rejected' },
    ],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const tickets = await sendExpoPush([message('ExpoPushToken[first]'), message('ExpoPushToken[second]')]);
    assert.deepEqual(tickets.map((ticket) => ticket.status), ['accepted', 'failed']);
    assert.equal(tickets[0].ticketId, 'ticket-1');
    assert.equal(tickets[1].error, 'Message rejected');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DeviceNotRegistered receipts are classified as invalid devices', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      'ticket-1': { status: 'ok' },
      'ticket-2': { status: 'error', message: 'Device is not registered', details: { error: 'DeviceNotRegistered' } },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const receipts = await getExpoReceipts(['ticket-1', 'ticket-2']);
    assert.equal(receipts.get('ticket-1')?.status, 'receipt_ok');
    assert.equal(receipts.get('ticket-2')?.status, 'invalid_device');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recipients require opt-in and an exact canonical state match', () => {
  const devices = [
    { id: 'device-a', user_id: 'user-a', expo_push_token: 'ExpoPushToken[user-a]' },
    { id: 'device-b', user_id: 'user-b', expo_push_token: 'ExpoPushToken[user-b]' },
  ];
  const preferences = [
    { user_id: 'user-a', community_alerts_enabled: true, notifications_paused: false },
    { user_id: 'user-b', community_alerts_enabled: true, notifications_paused: false },
  ];
  const profiles = [{ id: 'user-a', state: 'Kwara' }];
  assert.deepEqual(matchPushRecipients(devices, preferences, profiles, 'Kwara').map((item) => item.userId), ['user-a']);
  assert.equal(matchPushRecipients(devices, preferences, profiles, 'Lagos').length, 0);
  assert.equal(matchPushRecipients(devices, preferences, [], null).length, 2);
});
