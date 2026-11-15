'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLinkCode } = require('./telegram-engine');

test('creates a one-time Telegram link code and stores only a SHA-256 digest', () => {
  const first = createLinkCode();
  const second = createLinkCode();
  assert.match(first.code, /^[a-f0-9]{16}$/);
  assert.match(first.codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.code, first.codeHash);
  assert.notEqual(first.code, second.code);
  assert.notEqual(first.codeHash, second.codeHash);
});
