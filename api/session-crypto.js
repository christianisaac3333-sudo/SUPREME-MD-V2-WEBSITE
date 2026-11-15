'use strict';

const crypto = require('node:crypto');

const KEY_VERSION = 1;
const MAX_STATE_BYTES = 5 * 1024 * 1024;

function getEncryptionKey() {
  const value = process.env.WHATSAPP_SESSION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('WHATSAPP_SESSION_KEY must be configured as exactly 64 hexadecimal characters (32 bytes).');
  }
  return Buffer.from(value, 'hex');
}

function getMemberContext(userId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id < 1) throw new TypeError('A valid member ID is required for session encryption.');
  return Buffer.from('supreme-md-v2:whatsapp:' + id + ':key-version:' + KEY_VERSION, 'utf8');
}

function encryptSessionState(state, userId) {
  if (state === undefined) throw new TypeError('Session state is required.');
  const plaintext = Buffer.from(JSON.stringify(state), 'utf8');
  if (plaintext.length > MAX_STATE_BYTES) throw new RangeError('Session state exceeds the storage limit.');

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  cipher.setAAD(getMemberContext(userId));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    encryptedState: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: KEY_VERSION
  };
}

function decryptSessionState(record, userId) {
  if (!record || Number(record.keyVersion) !== KEY_VERSION ||
      typeof record.encryptedState !== 'string' ||
      typeof record.iv !== 'string' ||
      typeof record.authTag !== 'string') {
    throw new TypeError('Encrypted session record is invalid or uses an unsupported key version.');
  }

  const iv = Buffer.from(record.iv, 'base64');
  const authTag = Buffer.from(record.authTag, 'base64');
  const encrypted = Buffer.from(record.encryptedState, 'base64');
  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length > MAX_STATE_BYTES ||
      iv.toString('base64') !== record.iv ||
      authTag.toString('base64') !== record.authTag ||
      encrypted.toString('base64') !== record.encryptedState) {
    throw new TypeError('Encrypted session record failed validation.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAAD(getMemberContext(userId));
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

module.exports = { encryptSessionState, decryptSessionState, KEY_VERSION };
