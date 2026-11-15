'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatDuration, parseCommand, commandReply } = require('./command-router');

test('parses supported prefixed command text', () => {
  assert.deepEqual(parseCommand('.menu'), { name: 'menu', args: [] });
  assert.deepEqual(parseCommand('.ping now'), { name: 'ping', args: ['now'] });
  assert.equal(parseCommand('hello'), null);
  assert.equal(parseCommand('.bad-command'), null);
});

test('formats uptime into readable units', () => {
  assert.equal(formatDuration(90061), '1d 1h 1m 1s');
});

test('returns the menu and safe basic command responses', () => {
  assert.match(commandReply({ name: 'menu' }), /GENERAL COMMANDS/);
  assert.match(commandReply({ name: 'alive' }), /online/);
  assert.match(commandReply({ name: 'uptime' }, { uptime: 61 }), /1m 1s/);
  assert.equal(commandReply({ name: 'unknown' }), null);
});

test('formats time using Lagos timezone', () => {
  assert.match(commandReply({ name: 'time' }, { now: Date.UTC(2026, 0, 1, 12) }), /Nigeria time:/);
});
