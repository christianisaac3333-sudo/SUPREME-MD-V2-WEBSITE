'use strict';

// Experimental single-process WhatsApp Web session manager.
// Auth state is encrypted before it reaches PostgreSQL. QR values remain in memory only.
const { saveMemberSession, loadMemberSession, updateMemberSessionStatus, removeMemberSession } = require('./session-store');
const QRCode = require('qrcode');
const { parseCommand, commandReply } = require('./command-router');

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

async function startMemberSession(pool, userId, options = {}) {
  const id = String(userId);
  const existing = sessions.get(id);
  if (existing && ['connecting', 'connected'].includes(existing.status)) {
    return { status: existing.status, pairingCode: existing.pairingCode || null };
  }

  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default;
  const { initAuthCreds, BufferJSON, DisconnectReason, Browsers } = baileys;
  if (typeof makeWASocket !== 'function' || !initAuthCreds || !BufferJSON) {
    throw new Error('The WhatsApp library did not load correctly.');
  }

  const saved = await loadMemberSession(pool, id);
  const restored = saved ? deserializeAuth(saved, BufferJSON) : null;
  const creds = restored?.creds || initAuthCreds();
  if (options.phoneNumber && creds.registered === true) throw new Error('This WhatsApp session is already registered. Disconnect it before linking again.');
  const keyData = restored?.keys && typeof restored.keys === 'object' ? restored.keys : {};
  let resolvePairingCode;
  let rejectPairingCode;
  const pairingCodePromise = options.phoneNumber ? new Promise((resolve, reject) => { resolvePairingCode = resolve; rejectPairingCode = reject; }) : null;
  const entry = { status: 'connecting', qr: null, phoneMasked: null, startedAt: Date.now(), sock: null, persist: null, lastCommandAt: new Map(), menuSent: false, pairingCode: null, pairingStarted: false };
  sessions.set(id, entry);

  let persistChain = Promise.resolve();
  const persist = (status = entry.status, phone = entry.phoneMasked) => {
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
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false
    });
    entry.sock = sock;
    sock.ev.on('messages.upsert', async event => {
      if (event?.type !== 'notify') return;
      for (const message of event.messages || []) {
        try {
          const chat = message?.key?.remoteJid;
          if (!chat || chat === 'status@broadcast' || message.key?.fromMe) continue;
          const isGroup = chat.endsWith('@g.us');
          const content = message.message || {};
          const body = content.conversation
            || content.extendedTextMessage?.text
            || content.imageMessage?.caption
            || content.videoMessage?.caption
            || content.documentMessage?.caption
            || '';
          const command = parseCommand(body);
          if (!command) continue;
          const now = Date.now();
          const sender = message.key?.participant || chat;
          const cooldownKey = chat + ':' + sender;
          const previous = entry.lastCommandAt.get(cooldownKey) || 0;
          if (now - previous < 1200) continue;
          entry.lastCommandAt.set(cooldownKey, now);
          if (entry.lastCommandAt.size > 500) entry.lastCommandAt.clear();

          const replyTo = async text => sock.sendMessage(chat, { text }, { quoted: message });
          const sameJid = (a, b) => String(a || '').split('@')[0].split(':')[0] === String(b || '').split('@')[0].split(':')[0];
          const getMetadata = async () => {
            if (!isGroup) return null;
            return sock.groupMetadata(chat);
          };
          const metadata = isGroup && ['groupinfo', 'admins', 'tagall', 'welcome', 'goodbye'].includes(command.name)
            ? await getMetadata()
            : null;
          const senderIsAdmin = metadata?.participants?.some(p => sameJid(p.id, sender) && (p.admin === 'admin' || p.admin === 'superadmin'));
          const requireGroup = () => {
            if (isGroup) return true;
            replyTo('This command can only be used inside a WhatsApp group.');
            return false;
          };
          const requireAdmin = () => {
            if (senderIsAdmin) return true;
            replyTo('Only a group admin can use this command.');
            return false;
          };

          if (command.name === 'groupinfo') {
            if (!requireGroup()) continue;
            const description = metadata.desc ? String(metadata.desc).slice(0, 240) : 'No description set';
            await replyTo([
              '♤ GROUP INFORMATION',
              'Name: ' + (metadata.subject || 'Unknown'),
              'Members: ' + (metadata.participants?.length || 0),
              'Created: ' + (metadata.creation ? new Date(metadata.creation * 1000).toLocaleDateString('en-NG') : 'Unavailable'),
              'Description: ' + description
            ].join('\n'));
            continue;
          }

          if (command.name === 'admins') {
            if (!requireGroup()) continue;
            const admins = (metadata.participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin');
            const lines = admins.map((p, i) => (i + 1) + '. @' + String(p.id).split('@')[0].split(':')[0]);
            await sock.sendMessage(chat, {
              text: '♤ GROUP ADMINS\n' + (lines.join('\n') || 'No admins were returned.'),
              mentions: admins.map(p => p.id)
            }, { quoted: message });
            continue;
          }

          if (command.name === 'tagall') {
            if (!requireGroup() || !requireAdmin()) continue;
            const members = (metadata.participants || []).slice(0, 30);
            const lines = members.map((p, i) => (i + 1) + '. @' + String(p.id).split('@')[0].split(':')[0]);
            const omitted = Math.max(0, (metadata.participants || []).length - members.length);
            await sock.sendMessage(chat, {
              text: '♤ GROUP NOTICE\n' + (command.args.join(' ') || 'Attention everyone!') + '\n\n' +
                lines.join('\n') + (omitted ? '\n…and ' + omitted + ' more members were not mentioned.' : ''),
              mentions: members.map(p => p.id)
            }, { quoted: message });
            continue;
          }

          if (command.name === 'welcome' || command.name === 'goodbye') {
            if (!requireGroup() || !requireAdmin()) continue;
            const value = String(command.args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(value)) {
              await replyTo('Usage: .' + command.name + ' on/off');
              continue;
            }
            const column = command.name === 'welcome' ? 'welcome_enabled' : 'goodbye_enabled';
            await pool.query(
              `INSERT INTO whatsapp_group_settings (user_id, group_jid, ${column})
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, group_jid) DO UPDATE SET ${column}=EXCLUDED.${column}, updated_at=NOW()`,
              [id, chat, value === 'on']
            );
            await replyTo((command.name === 'welcome' ? 'Welcome' : 'Goodbye') + ' messages are now ' + (value === 'on' ? 'ON' : 'OFF') + ' for this group.');
            continue;
          }

          const messageTimestamp = Number(message.messageTimestamp?.toNumber?.() ?? message.messageTimestamp) * 1000;
          const receivedAt = Number.isFinite(messageTimestamp) && messageTimestamp > 0 ? messageTimestamp : now;
          const reply = commandReply(command, { now, receivedAt, uptime: process.uptime() });
          if (reply) await replyTo(reply);
        } catch (error) {
          console.error('WhatsApp command handler failed:', error.message);
        }
      }
    });

    sock.ev.on('group-participants.update', async update => {
      try {
        if (!update?.id || !['add', 'remove'].includes(update.action)) return;
        const setting = await pool.query(
          'SELECT welcome_enabled, goodbye_enabled FROM whatsapp_group_settings WHERE user_id=$1 AND group_jid=$2',
          [id, update.id]
        );
        const row = setting.rows[0];
        const enabled = update.action === 'add' ? row?.welcome_enabled : row?.goodbye_enabled;
        if (!enabled) return;
        const participants = (update.participants || []).slice(0, 10);
        if (!participants.length) return;
        const mentions = participants.map(jid => '@' + String(jid).split('@')[0].split(':')[0]);
        const groupName = await sock.groupMetadata(update.id).then(meta => meta.subject).catch(() => 'the group');
        const text = update.action === 'add'
          ? 'Welcome to ' + groupName + ', ' + mentions.join(' ') + '! Please read the group description and follow the rules.'
          : 'Goodbye ' + mentions.join(' ') + '.';
        await sock.sendMessage(update.id, { text, mentions: participants });
      } catch (error) {
        console.error('WhatsApp group event handler failed:', error.message);
      }
    });
    sock.ev.on('creds.update', async update => {
      Object.assign(creds, update);
      await persist();
    });
    sock.ev.on('connection.update', async update => {
      if (sessions.get(id) !== entry) return;
      if (update.qr) {
        entry.qr = update.qr;
        entry.status = 'connecting';
        if (options.phoneNumber) console.log('WhatsApp pairing handshake reached the QR-ready stage.');
        await persist('connecting');
      }
      // Wait until Baileys has emitted its QR event (the socket is ready),
      // then request a phone pairing code with bounded retries.
      if (options.phoneNumber && update.qr && !entry.pairingStarted) {
        entry.pairingStarted = true;
        (async () => {
          let lastError;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1400 + attempt * 900));
              if (sessions.get(id) !== entry || entry.status !== 'connecting') {
                throw new Error('The WhatsApp connection closed before a pairing code was ready.');
              }
              const code = await sock.requestPairingCode(options.phoneNumber);
              entry.pairingCode = code;
              resolvePairingCode(code);
              return;
            } catch (error) {
              lastError = error;
              console.warn('WhatsApp pairing code attempt ' + attempt + ' failed:', String(error.message || 'unknown error').slice(0, 180));
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
            }
          }
          rejectPairingCode(new Error('WhatsApp did not accept the pairing request after three attempts: ' + (lastError?.message || 'connection not ready')));
        })();
      }
      if (update.connection === 'open') {
        entry.qr = null;
        entry.status = 'connected';
        const jid = sock.user?.id || '';
        entry.phoneMasked = phoneMask(jid);
        await persist('connected', entry.phoneMasked);
        if (!entry.menuSent && sock.user?.id) {
          entry.menuSent = true;
          const menu = commandReply({ name: 'menu' }, { now: Date.now(), uptime: process.uptime() });
          const welcome = ['Welcome! Your WhatsApp is now connected to SUPREME MD V2.', '', menu].join('\n');
          try {
            await sock.sendMessage(sock.user.id, { text: welcome });
          } catch (error) {
            entry.menuSent = false;
            console.error('WhatsApp welcome menu delivery failed:', error.message);
          }
        }
      }
      if (update.connection === 'close') {
        const receivedQr = Boolean(entry.qr);
        const disconnectError = update.lastDisconnect?.error;
        const code = disconnectError?.output?.statusCode || disconnectError?.statusCode;
        const reason = String(disconnectError?.message || 'No disconnect reason supplied').slice(0, 180);
        console.error(
          'WhatsApp connection closed: status=' + (code || 'unknown') +
          ' reason=' + reason +
          ' qrReceived=' + receivedQr +
          ' pairingCodeIssued=' + Boolean(entry.pairingCode)
        );
        entry.qr = null;
        entry.status = code === DisconnectReason.loggedOut ? 'needs_relink' : 'disconnected';
        if (options.phoneNumber && !entry.pairingCode) rejectPairingCode(new Error('WhatsApp disconnected before the pairing code was generated. Please retry.'));
        await persist(entry.status);
        if (sessions.get(id) === entry) sessions.delete(id);
      }
    });
    setTimeout(() => {
      if (sessions.get(id) === entry && entry.status === 'connecting') {
        entry.status = 'disconnected';
        entry.qr = null;
        try { sock.end(new Error('Connection request timed out.')); } catch (_) {}
        sessions.delete(id);
        persist('disconnected');
      }
    }, START_TIMEOUT_MS).unref?.();
    if (pairingCodePromise) {
      let timeout;
      try {
        const pairingCode = await Promise.race([
          pairingCodePromise,
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('WhatsApp is taking too long to prepare a pairing code. Please wait a moment and retry.')), 45000);
          })
        ]);
        return { status: entry.status, pairingCode };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }
    return { status: entry.status };
  } catch (error) {
    const failed = sessions.get(id);
    if (failed?.sock) {
      try { failed.sock.end(new Error('Pairing request failed.')); } catch (_) {}
    }
    if (failed?.persist) await failed.persist('disconnected');
    if (sessions.get(id) === failed) sessions.delete(id);
    throw error;
  }
}

async function restoreMemberSessions(pool) {
  const result = await pool.query(
    "SELECT user_id FROM whatsapp_sessions WHERE status IN ('connected','reconnecting','connecting') ORDER BY updated_at ASC LIMIT 10"
  );
  for (const row of result.rows) {
    const id = String(row.user_id);
    try {
      const baileys = await import('@whiskeysockets/baileys');
      const saved = await loadMemberSession(pool, id);
      const restored = saved ? deserializeAuth(saved, baileys.BufferJSON) : null;
      if (restored?.creds?.registered === true) {
        await startMemberSession(pool, id);
      } else {
        await updateMemberSessionStatus(pool, id, 'disconnected');
      }
    } catch (error) {
      console.error('WhatsApp session restore failed for member ' + id + ':', error.message);
      try { await updateMemberSessionStatus(pool, id, 'needs_relink'); } catch (_) {}
    }
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

module.exports = { startMemberSession, restoreMemberSessions, getMemberQr, getMemberRuntimeStatus, stopMemberSession };
