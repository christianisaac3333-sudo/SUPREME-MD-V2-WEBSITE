'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { saveMemberSession, loadMemberSession, removeMemberSession } = require('./session-store');

function mockPool() {
  const calls = [];
  let saved = null;
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.startsWith('INSERT INTO whatsapp_sessions')) {
        saved = {
          encrypted_state: values[1],
          iv: values[2],
          auth_tag: values[3],
          key_version: values[4]
        };
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith('SELECT encrypted_state')) {
        return saved ? { rowCount: 1, rows: [saved] } : { rowCount: 0, rows: [] };
      }
      if (sql.startsWith('DELETE FROM whatsapp_sessions')) {
        saved = null;
        return { rowCount: 1, rows: [] };
      }
      throw new Error('Unexpected query in test: ' + sql);
    }
  };
}

test('stores and retrieves only the member-owned encrypted state', async () => {
  const previous = process.env.WHATSAPP_SESSION_KEY;
  process.env.WHATSAPP_SESSION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const pool = mockPool();
    const state = { creds: { registered: true }, keys: { app: ['private'] } };
    await saveMemberSession(pool, 41, state, { status: 'connected', phoneMasked: '••••1234' });
    assert.equal(pool.calls[0].values[0], 41);
    assert.notEqual(pool.calls[0].values[1], JSON.stringify(state));
    assert.deepEqual(await loadMemberSession(pool, 41), state);
    await assert.rejects(() => loadMemberSession(pool, 42));
  } finally {
    if (previous === undefined) delete process.env.WHATSAPP_SESSION_KEY;
    else process.env.WHATSAPP_SESSION_KEY = previous;
  }
});

test('removes only the requested member row', async () => {
  const pool = mockPool();
  await removeMemberSession(pool, 99);
  assert.match(pool.calls[0].sql, /WHERE user_id=\$1/);
  assert.deepEqual(pool.calls[0].values, [99]);
});

test('rejects invalid member identifiers', async () => {
  const pool = mockPool();
  await assert.rejects(() => saveMemberSession(pool, 'not-an-id', {}), /member ID/i);
  await assert.rejects(() => loadMemberSession(pool, 0), /member ID/i);
});
