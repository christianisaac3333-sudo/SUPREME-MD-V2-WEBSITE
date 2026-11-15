'use strict';

const { encryptSessionState, decryptSessionState } = require('./session-crypto');

function normalizeUserId(userId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new TypeError('A valid member ID is required.');
  return id;
}

async function saveMemberSession(pool, userId, state, metadata = {}) {
  const id = normalizeUserId(userId);
  const encrypted = encryptSessionState(state, id);
  const status = ['connecting','connected','reconnecting','needs_relink','disconnected'].includes(metadata.status)
    ? metadata.status : 'disconnected';
  const phoneMasked = typeof metadata.phoneMasked === 'string' ? metadata.phoneMasked.slice(0, 24) : null;
  const connectedAt = status === 'connected' ? new Date() : null;

  await pool.query(
    `INSERT INTO whatsapp_sessions
      (user_id, encrypted_state, iv, auth_tag, key_version, status, phone_masked, connected_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       encrypted_state=EXCLUDED.encrypted_state, iv=EXCLUDED.iv,
       auth_tag=EXCLUDED.auth_tag, key_version=EXCLUDED.key_version,
       status=EXCLUDED.status, phone_masked=EXCLUDED.phone_masked,
       connected_at=EXCLUDED.connected_at, updated_at=NOW()`,
    [id, encrypted.encryptedState, encrypted.iv, encrypted.authTag,
     encrypted.keyVersion, status, phoneMasked, connectedAt]
  );
}

async function loadMemberSession(pool, userId) {
  const id = normalizeUserId(userId);
  const result = await pool.query(
    'SELECT encrypted_state, iv, auth_tag, key_version FROM whatsapp_sessions WHERE user_id=$1',
    [id]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return decryptSessionState({
    encryptedState: row.encrypted_state,
    iv: row.iv,
    authTag: row.auth_tag,
    keyVersion: Number(row.key_version)
  }, id);
}

async function removeMemberSession(pool, userId) {
  const id = normalizeUserId(userId);
  await pool.query('DELETE FROM whatsapp_sessions WHERE user_id=$1', [id]);
}

module.exports = { saveMemberSession, loadMemberSession, removeMemberSession };
