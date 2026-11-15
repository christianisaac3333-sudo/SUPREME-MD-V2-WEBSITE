'use strict';

// Experimental single-process WhatsApp Web session manager.
// Auth state is encrypted before it reaches PostgreSQL. QR values remain in memory only.
const { saveMemberSession, loadMemberSession, removeMemberSession } = require('./session-store');
const QRCode = require('qrcode');

const sessions = new Map();
const START_TIMEOUT_MS = 90_000;

function phoneMask(jid) {
  const digits = String(jid || '').split('@')[0].replace(/[^0-9]/g, '');
  return digits.length > 4 ? '••••••' + digits.slice(-4) : null;
}

function serializeAuth(creds, keyData, BufferJSON) {
  return JSON.stringify({ creds, keys: keyData }, BufferJSON.replacer);
}
function deserializeAuth(serialized, BufferJSON) {
  if (typeof serialized !== 'string') return null;
  return JSON.parse(serialized, BufferJSON.reviver);
}

async function startMemberSession(pool, userId) {
  const id = String(userId);
  const existing = sessions.get(id);
  if (existing && ['connecting', 'connected'].includes(existing.status)) {
    return { status: existing.status };
  }

  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { initAuthCreds, BufferJSON, DisconnectReason } = baileys;
  if (typeof makeWASocket !== 'function' || !initAuthCreds || !BufferJSON) {
    throw new Error('The WhatsApp library did not load correctly.');
  }

  const saved = await loadMemberSession(pool, id);
  const restored = saved ? deserializeAuth(saved, BufferJSON) : null;
  const creds = restored?.creds || initAuthCreds();
  const keyData = restored?.keys && typeof restored.keys === 'object' ? restored.keys : {};
  const entry = { status: 'connecting', qr: null, startedAt: Date.now(), sock: null, persist: null };
  sessions.set(id, entry);

  let persistChain = Promise.resolve();
  const persist = (status = entry.status, phone = null) => {
    const snapshot = serializeAuth(creds, keyData, BufferJSON);
    persistChain = persistChain
      .then(() => saveMemberSession(pool, id, snapshot, { status, phoneMasked: phone || undefined }))
      .catch(error => { console.error('WhatsApp encrypted session save failed:', error.message); });
    return persistChain;
  };
  entry.persist = persist;

  const keys = {
    async get(type, ids) {
      const bucket = keyData[type] || {};
      const result = {};
      for (const key of ids) if (bucket[key] !== undefined) result[key] = bucket[key];
      return result;
    },
    async set(data) {
      for (const [type, values] of Object.entries(data || {})) {
        keyData[type] ||= {};
        for (const [key, value] of Object.entries(values || {})) {
          if (value == null) delete keyData[type][key];
          else keyData[type][key] = value;
        }
      }
      await persist();
    }
  };

  try {
    const sock = makeWASocket({
      auth: { creds, keys },
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      shouldSyncHistoryMessage: () => false
    });
    entry.sock = sock;
    sock.ev.on('creds.update', async update => {
      Object.assign(creds, update);
      await persist();
    });
    sock.ev.on('connection.update', async update => {
      if (sessions.get(id) !== entry) return;
      if (update.qr) {
        entry.qr = update.qr;
        entry.status = 'connecting';
        await persist('connecting');
      }
      if (update.connection === 'open') {
        entry.qr = null;
        entry.status = 'connected';
        const jid = sock.user?.id || '';
        await persist('connected', phoneMask(jid));
      }
      if (update.connection === 'close') {
        entry.qr = null;
        const code = update.lastDisconnect?.error?.output?.statusCode;
        entry.status = code === DisconnectReason.loggedOut ? 'needs_relink' : 'disconnected';
        await persist(entry.status);
        if (sessions.get(id) === entry) sessions.delete(id);
      }
    });
    setTimeout(() => {
      if (sessions.get(id) === entry && entry.status === 'connecting' && !entry.qr) {
        entry.status = 'disconnected';
        entry.qr = null;
        try { sock.end(new Error('Connection request timed out.')); } catch (_) {}
        sessions.delete(id);
        persist('disconnected');
      }
    }, START_TIMEOUT_MS).unref?.();
    return { status: entry.status };
  } catch (error) {
    sessions.delete(id);
    throw error;
  }
}

async function getMemberQr(userId) {
  const entry = sessions.get(String(userId));
  if (!entry || !entry.qr) return null;
  return QRCode.toDataURL(entry.qr, { errorCorrectionLevel: 'M', margin: 2, width: 280 });
}

async function getMemberRuntimeStatus(userId) {
  const entry = sessions.get(String(userId));
  return entry ? entry.status : null;
}

async function stopMemberSession(pool, userId) {
  const id = String(userId);
  const entry = sessions.get(id);
  if (entry) {
    sessions.delete(id);
    entry.qr = null;
    try { await entry.sock?.logout(); } catch (_) {
      try { entry.sock?.end(new Error('Member disconnected.')); } catch (_) {}
    }
  }
  await removeMemberSession(pool, id);
  return { status: 'disconnected' };
}

module.exports = { startMemberSession, getMemberQr, getMemberRuntimeStatus, stopMemberSession };
