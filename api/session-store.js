'use strict';

const { encryptSessionState, decryptSessionState } = require('./session-crypto');

async function saveMemberSession(pool, userId, state, metadata = {}) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) < 1) throw new TypeError('A valid member ID is required.');
  const encrypted = encryptSessionState(state, Number(userId));
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
    [Number(userId), encrypted.encryptedState, encrypted.iv, encrypted.authTag,
     encrypted.keyVersion, status, phoneMasked, connectedAt]
  );
}

async function loadMemberSession(pool, userId) {
  const result = await pool.query(
    'SELECT encrypted_state, iv, auth_tag, key_version FROM whatsapp_sessions WHERE user_id=$1',
    [Number(userId)]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return decryptSessionState({
    encryptedState: row.encrypted_state,
    iv: row.iv,
    authTag: row.auth_tag,
    keyVersion: Number(row.key_version)
  }, Number(userId));
}

async function removeMemberSession(pool, userId) {
  await pool.query('DELETE FROM whatsapp_sessions WHERE user_id=$1', [Number(userId)]);
}

module.exports = { saveMemberSession, loadMemberSession, removeMemberSession };
