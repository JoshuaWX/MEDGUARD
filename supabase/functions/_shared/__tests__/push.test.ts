import assert from 'node:assert/strict';
import test from 'node:test';
import { getExpoReceipts, sendExpoPush, type ExpoMessage } from '../push.ts';

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

