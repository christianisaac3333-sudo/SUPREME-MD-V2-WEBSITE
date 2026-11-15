'use strict';

const crypto = require('node:crypto');
const { commandReply } = require('./command-router');
const { startMemberSession, getMemberQr, getMemberRuntimeStatus, stopMemberSession } = require('./whatsapp-engine');

let bot = null;
const VERSION = 'V2';
const WEBSITE = 'https://supreme-md-v2.onrender.com';
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_ACTIVE_SESSIONS || 10));

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [days ? days + 'd' : null, hours ? hours + 'h' : null, minutes ? minutes + 'm' : null, remainder + 's'].filter(Boolean).join(' ');
}

function telegramMenu({ username, role, status, connected, capacity }) {
  return [
    '╭─────────── ✦ ♤ ✦ ───────────╮',
    '        ♤  SUPREME MD V2  ♤',
    '╰─────────── ✦ ♤ ✦ ───────────╯',
    '',
    '       ✧  CONTROL PANEL  ✧',
    '╭──────────────────────────────╮',
    '│ ◈ Status     · ' + status,
    '│ ◈ Version    · ' + VERSION,
    '│ ◈ Sessions   · ' + connected + ' / ' + capacity,
    '│ ◈ Member     · ' + username,
    '│ ◈ Role       · ' + String(role).toUpperCase(),
    '╰──────────────────────────────╯',
    '',
    '          ✧  COMMANDS  ✧',
    '╭──────────────────────────────╮',
    '│ ◈ GENERAL',
    '│ /start       → Start bot',
    '│ /menu        → Show this menu',
    '│ /help        → Command guide',
    '│ /alive       → Bot status',
    '│ /ping        → Response check',
    '│ /info        → Platform details',
    '│ /uptime      → Server uptime',
    '│ /time        → Nigeria time',
    '│ /date        → Nigeria date',
    '│ /version     → Bot version',
    '│ /server      → Hosting details',
    '│ /health      → API and database',
    '│ /website     → Open website',
    '│ /support     → Help information',
    '│ /rules       → Usage rules',
    '│ /privacy     → Privacy summary',
    '│ /features    → Feature list',
    '│',
    '│ ◈ MY ACCOUNT',
    '│ /profile     → Your profile',
    '│ /account     → Account details',
    '│ /role        → Your member role',
    '│ /myid        → Your Telegram ID',
    '│',
    '│ ◈ WHATSAPP',
    '│ /connect     → Get a WhatsApp QR',
    '│ /pair        → Pair with phone number',
    '│ /status      → WhatsApp status',
    '│ /session     → Session information',
    '│ /disconnect  → Disconnect your session',
    '│',
    '│ ◈ ADMIN ONLY',
    '│ /admin       → Admin panel guide',
    '│ /stats       → Platform statistics',
    '│ /members     → Member totals',
    '╰──────────────────────────────╯',
    '',
    '“With great power comes great responsibility.”',
    '',
    '♤ One shared bot · Separate member accounts ♤'
  ].join('\n');
}

function startTelegramBot(pool) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('Telegram bot disabled: TELEGRAM_BOT_TOKEN is not configured.');
    return null;
  }
  if (bot) return bot;

  const TelegramBot = require('node-telegram-bot-api');
  bot = new TelegramBot(token, { polling: { autoStart: true, interval: 1000, params: { timeout: 25 } } });

  bot.on('polling_error', error => {
    console.error('Telegram polling error:', String(error.message || 'unknown error').slice(0, 180));
  });

  async function getLinkedMember(telegramId) {
    const result = await pool.query(
      'SELECT u.id, u.username, u.role, u.created_at, u.last_login, l.telegram_username, l.linked_at FROM telegram_links l JOIN users u ON u.id=l.user_id WHERE l.telegram_user_id=$1',
      [String(telegramId)]
    );
    return result.rows[0] || null;
  }

  async function sendMenu(chatId, member) {
    const [counts, runtime] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS connected FROM whatsapp_sessions WHERE status='connected'"),
      getMemberRuntimeStatus(member.id)
    ]);
    const status = runtime || 'ONLINE';
    await bot.sendMessage(chatId, telegramMenu({
      username: member.username,
      role: member.role,
      status: status.toUpperCase(),
      connected: counts.rows[0].connected,
      capacity: MAX_SESSIONS
    }), {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Link WhatsApp', callback_data: 'wa_connect' }, { text: '📊 My Status', callback_data: 'wa_status' }],
          [{ text: '📖 Commands', callback_data: 'show_menu' }, { text: '🌐 Website', url: WEBSITE }]
        ]
      }
    });
  }

  async function handleCommand(message, command, args, member) {
    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const send = (value, options = {}) => bot.sendMessage(chatId, value, { disable_web_page_preview: true, ...options });
    const now = Date.now();
    const username = member.username;
    const admin = member.role === 'admin';

    switch (command) {
      case '/menu':
      case '/help':
        return sendMenu(chatId, member);
      case '/alive':
        return send('♤ SUPREME MD V2 is online. Your account is linked and ready.');
      case '/ping':
        return send('Pong! ' + Math.max(0, Date.now() - now) + ' ms');
      case '/info':
        return send('♤ SUPREME MD V2\nShared Telegram bot · Individual member accounts\nWhatsApp sessions are isolated by website account.');
      case '/uptime':
        return send('Server uptime: ' + formatDuration(process.uptime()));
      case '/time':
        return send('Nigeria time: ' + new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date()));
      case '/date':
        return send('Nigeria date: ' + new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'full' }).format(new Date()));
      case '/version':
        return send('SUPREME MD V2 · Version ' + VERSION);
      case '/server':
        return send('HOSTING STATUS\nPlan: Free\nRuntime: Node.js\nProcess uptime: ' + formatDuration(process.uptime()) + '\nNote: free hosting may sleep or restart.');
      case '/health': {
        try {
          await pool.query('SELECT 1');
          return send('♤ API: ONLINE\n♤ Database: CONNECTED\n♤ Telegram engine: ACTIVE');
        } catch (_) {
          return send('Database health check failed. Please try again later.');
        }
      }
      case '/website':
        return send('SUPREME MD V2 website:\n' + WEBSITE);
      case '/support':
        return send('SUPPORT\nFor account access or connection issues, sign in to the website and use its member dashboard. Never share passwords, pairing codes or link codes.');
      case '/rules':
        return send('USAGE RULES\n1. Use only accounts and WhatsApp numbers you own or are authorised to manage.\n2. Respect other members.\n3. Do not spam or misuse group features.\n4. Keep login and linking codes private.');
      case '/privacy':
        return send('PRIVACY\nYour Telegram identity is linked to your website account. The bot only displays your own account and WhatsApp session details. Do not send passwords or private codes in public chats.');
      case '/features':
        return send('FEATURES\n• Shared Telegram bot\n• Separate member identities\n• WhatsApp QR and phone pairing\n• Private session status\n• Account profile\n• Admin-only platform summaries');
      case '/profile':
      case '/account':
        return send('♤ YOUR PROFILE\nUsername: ' + username + '\nRole: ' + member.role.toUpperCase() + '\nMember since: ' + new Date(member.created_at).toLocaleDateString('en-NG') + '\nLast login: ' + (member.last_login ? new Date(member.last_login).toLocaleString('en-NG') : 'Not recorded'));
      case '/role':
        return send('Your website role: ' + member.role.toUpperCase());
      case '/myid':
        return send('Your Telegram ID: ' + String(telegramId) + '\nKeep account details private.');
      case '/status':
      case '/session': {
        const result = await pool.query('SELECT status, phone_masked, connected_at, updated_at FROM whatsapp_sessions WHERE user_id=$1', [member.id]);
        const row = result.rows[0];
        const runtime = await getMemberRuntimeStatus(member.id);
        const status = runtime || row?.status || 'disconnected';
        return send('♤ YOUR WHATSAPP SESSION\nStatus: ' + status.toUpperCase() + '\nNumber: ' + (row?.phone_masked || 'Not linked') + '\nConnected: ' + (row?.connected_at ? new Date(row.connected_at).toLocaleString('en-NG') : 'Not connected') + '\nUpdated: ' + (row?.updated_at ? new Date(row.updated_at).toLocaleString('en-NG') : '—'));
      }
      case '/connect': {
        if (!/^[a-fA-F0-9]{64}$/.test(process.env.WHATSAPP_SESSION_KEY || '')) return send('WhatsApp connection is not configured. Please use the website dashboard or contact the administrator.');
        try {
          const result = await startMemberSession(pool, member.id);
          if (result.status === 'connected') return send('Your WhatsApp session is already connected. Use /status to check it.');
          let qr = null;
          for (let attempt = 0; attempt < 20 && !qr; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            qr = await getMemberQr(member.id);
          }
          if (!qr) return send('Your WhatsApp connection is starting, but the QR is not ready yet. Wait a few seconds and try /status or /connect again.');
          const image = Buffer.from(qr.split(',')[1], 'base64');
          return bot.sendPhoto(chatId, image, { caption: 'Scan this QR using WhatsApp → Linked devices. This QR is private to your account and expires.' });
        } catch (error) {
          console.error('Telegram WhatsApp QR request failed:', error.message);
          return send('Could not start your WhatsApp connection. Please try again later.');
        }
      }
      case '/pair': {
        const phone = String(args[0] || '').replace(/[^0-9]/g, '');
        if (!/^\d{8,15}$/.test(phone)) return send('Usage: /pair 2348012345678\nUse your full international number with country code.');
        if (!/^[a-fA-F0-9]{64}$/.test(process.env.WHATSAPP_SESSION_KEY || '')) return send('WhatsApp pairing is not configured yet.');
        try {
          const result = await startMemberSession(pool, member.id, { phoneNumber: phone });
          if (!result.pairingCode) return send('A WhatsApp session is already running. Use /status first.');
          return send('♤ YOUR PRIVATE WHATSAPP PAIRING CODE\n' + result.pairingCode + '\n\nOpen WhatsApp → Linked devices → Link with phone number instead. Never share this code.');
        } catch (error) {
          console.error('Telegram WhatsApp pairing failed:', error.message);
          return send('WhatsApp could not generate a pairing code. Wait a little and try again.');
        }
      }
      case '/disconnect':
        try {
          await stopMemberSession(pool, member.id);
          return send('Your WhatsApp session has been disconnected.');
        } catch (error) {
          console.error('Telegram WhatsApp disconnect failed:', error.message);
          return send('Could not disconnect your session right now.');
        }
      case '/admin':
        if (!admin) return send('Admin access required.');
        return send('♤ ADMIN SUITE\nUse the SUPREME MD V2 website Admin Suite for member roles and secure settings.\n/admin, /stats and /members are restricted to admins.');
      case '/stats':
      case '/members': {
        if (!admin) return send('Admin access required.');
        const [users, sessions] = await Promise.all([
          pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE role='admin')::int AS admins, COUNT(*) FILTER (WHERE role='member')::int AS members FROM users"),
          pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='connected')::int AS connected FROM whatsapp_sessions")
        ]);
        return send('♤ PLATFORM STATISTICS\nAccounts: ' + users.rows[0].total + '\nAdmins: ' + users.rows[0].admins + '\nMembers: ' + users.rows[0].members + '\nSaved WhatsApp sessions: ' + sessions.rows[0].total + '\nConnected sessions: ' + sessions.rows[0].connected);
      }
      default:
        return send('Unknown command. Send /menu to view all 30 commands.');
    }
  }

  bot.on('callback_query', async query => {
    try {
      const member = await getLinkedMember(query.from.id);
      if (!member) {
        await bot.answerCallbackQuery(query.id, { text: 'Link your website account first.' });
        return;
      }
      await bot.answerCallbackQuery(query.id);
      if (query.data === 'show_menu') return sendMenu(query.message.chat.id, member);
      const fakeMessage = { chat: query.message.chat, from: query.from };
      if (query.data === 'wa_status') return handleCommand(fakeMessage, '/status', [], member);
      if (query.data === 'wa_connect') return handleCommand(fakeMessage, '/connect', [], member);
    } catch (error) {
      console.error('Telegram button handler failed:', error.message);
    }
  });

  bot.on('message', async message => {
    const chatId = message.chat?.id;
    const telegramId = message.from?.id;
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!chatId || !telegramId || !text || message.chat?.type !== 'private') return;

    const send = value => bot.sendMessage(chatId, value, { disable_web_page_preview: true });
    const parts = text.split(/\s+/);
    const command = (parts.shift() || '').split('@')[0].toLowerCase();

    try {
      if (command === '/start' && !parts[0]) {
        const member = await getLinkedMember(telegramId);
        if (member) return sendMenu(chatId, member);
        await send('╭────── ♤ SUPREME MD V2 ♤ ──────╮\nWelcome to the shared SUPREME MD bot.\n\nSign in to the website, generate a Telegram link code, then send:\n/link YOUR_CODE\n\nLink codes expire after 10 minutes.');
        return;
      }

      if (command === '/link') {
        const code = String(parts[0] || '').toLowerCase();
        if (!/^[a-f0-9]{16}$/.test(code)) {
          await send('Generate a fresh one-time code from your signed-in website account, then send /link followed by that code. Codes expire after 10 minutes.');
          return;
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await client.query(
            'SELECT user_id FROM telegram_link_codes WHERE code_hash=$1 AND expires_at > NOW() AND used_at IS NULL FOR UPDATE',
            [hashCode(code)]
          );
          if (!result.rowCount) {
            await client.query('ROLLBACK');
            await send('That link code is invalid, expired, or already used. Generate a new code on the website.');
            return;
          }
          const userId = result.rows[0].user_id;
          const existing = await client.query('SELECT user_id FROM telegram_links WHERE telegram_user_id=$1 OR user_id=$2 FOR UPDATE', [String(telegramId), userId]);
          if (existing.rowCount) {
            await client.query('ROLLBACK');
            await send('A Telegram account or website account is already linked. Unlink the existing connection from your website before trying again.');
            return;
          }
          await client.query(
            'INSERT INTO telegram_links (user_id, telegram_user_id, telegram_username, linked_at) VALUES ($1,$2,$3,NOW())',
            [userId, String(telegramId), message.from?.username || null]
          );
          await client.query('UPDATE telegram_link_codes SET used_at=NOW() WHERE code_hash=$1', [hashCode(code)]);
          await client.query('COMMIT');
          const member = await getLinkedMember(telegramId);
          await send('♤ TELEGRAM LINKED\nWebsite account: ' + (member?.username || 'member') + '\n\nYour account is connected. Send /menu to view your control panel.');
          return;
        } catch (error) {
          await client.query('ROLLBACK');
          if (error.code === '23505') await send('This Telegram account or website account is already linked. Check your website account settings.');
          else {
            console.error('Telegram account linking failed:', error.message);
            await send('Could not complete linking right now. Please try again.');
          }
        } finally {
          client.release();
        }
        return;
      }

      const member = await getLinkedMember(telegramId);
      if (!member) {
        await send('Your Telegram account is not linked yet. Sign in to the SUPREME MD V2 website and use its Telegram Account panel to generate a link code.');
        return;
      }

      const supported = new Set([
        '/menu','/help','/alive','/ping','/info','/uptime','/time','/date','/version','/server','/health',
        '/website','/support','/rules','/privacy','/features','/profile','/account','/role','/myid',
        '/status','/session','/connect','/pair','/disconnect','/admin','/stats','/members'
      ]);
      if (!supported.has(command)) return send('Unknown command. Send /menu to view all 30 commands.');
      await handleCommand(message, command, parts, member);
    } catch (error) {
      console.error('Telegram message handler failed:', error.message);
      try { await send('The bot could not complete that request. Please try again shortly.'); } catch (_) {}
    }
  });

  console.log('SUPREME MD V2 Telegram bot polling started.');
  return bot;
}

function createLinkCode() {
  const code = crypto.randomBytes(8).toString('hex');
  return { code, codeHash: hashCode(code) };
}

module.exports = { startTelegramBot, createLinkCode, telegramMenu };
