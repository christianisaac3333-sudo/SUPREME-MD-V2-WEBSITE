'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { encryptSessionState, decryptSessionState } = require('./session-crypto');

test('encrypts and decrypts a session state', () => {
  const previous = process.env.WHATSAPP_SESSION_KEY;
  process.env.WHATSAPP_SESSION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const state = { creds: { registered: true }, keys: { session: ['example'] } };
    const encrypted = encryptSessionState(state);
    assert.notEqual(encrypted.encryptedState, JSON.stringify(state));
    assert.deepEqual(decryptSessionState(encrypted), state);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_SESSION_KEY;
    else process.env.WHATSAPP_SESSION_KEY = previous;
  }
});

test('rejects a modified encrypted payload', () => {
  const previous = process.env.WHATSAPP_SESSION_KEY;
  process.env.WHATSAPP_SESSION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const encrypted = encryptSessionState({ privateData: 'test' });
    encrypted.encryptedState = Buffer.from('tampered').toString('base64');
    assert.throws(() => decryptSessionState(encrypted));
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_SESSION_KEY;
    else process.env.WHATSAPP_SESSION_KEY = previous;
  }
});

test('rejects a missing or malformed encryption key', () => {
  const previous = process.env.WHATSAPP_SESSION_KEY;
  delete process.env.WHATSAPP_SESSION_KEY;
  try {
    assert.throws(() => encryptSessionState({ ok: true }), /WHATSAPP_SESSION_KEY/);
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_SESSION_KEY;
    else process.env.WHATSAPP_SESSION_KEY = previous;
  }
});
