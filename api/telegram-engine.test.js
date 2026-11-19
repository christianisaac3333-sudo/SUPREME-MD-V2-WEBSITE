'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLinkCode, telegramMenu } = require('./telegram-engine');

test('creates a one-time Telegram link code and stores only a SHA-256 digest', () => {
  const first = createLinkCode();
  const second = createLinkCode();
  assert.match(first.code, /^[a-f0-9]{16}$/);
  assert.match(first.codeHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.code, first.codeHash);
  assert.notEqual(first.code, second.code);
  assert.notEqual(first.codeHash, second.codeHash);
});

test('Telegram control panel lists all 48 commands', () => {
  const menu = telegramMenu({
    username: 'SUPREME_TEST',
    role: 'member',
    status: 'ONLINE',
    whatsappStatus: 'DISCONNECTED',
    connected: 0,
    capacity: 10
  });
  const commands = menu.match(/\/[a-z]+/g) || [];
  assert.equal(commands.length, 48);
  assert.match(menu, /SUPREME CONTROL PANEL/);
  assert.match(menu, /SOCIAL & DISCOVERY/);
  assert.match(menu, /\/instagram/);
  assert.match(menu, /\/pinterest/);
  assert.match(menu, /POWERED BY SUPREME DEV/);
});
