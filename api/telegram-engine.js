'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const { startMemberSession, getMemberQr, getMemberRuntimeStatus, stopMemberSession } = require('./whatsapp-engine');
const { commandReply } = require('./command-router');

let bot = null;
let pollerLock = null;
let pollerRetryTimer = null;
let activePool = null;
let shuttingDown = false;
let pollerConflict = false;
let runtimeStatus = 'disabled';
let runtimeIssue = null;
let activeBotUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '') || null;
const VERSION = 'V2';
const WEBSITE = 'https://supreme-md-v2.onrender.com';
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_ACTIVE_SESSIONS || 10));

function getTelegramRuntimeStatus() {
  return { status: runtimeStatus, username: activeBotUsername, issue: runtimeIssue };
}

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

function schedulePollerRetry(pool) {
  if (pollerRetryTimer || shuttingDown) return;
  pollerRetryTimer = setTimeout(() => {
    pollerRetryTimer = null;
    startTelegramBot(pool).catch(error => {
      console.error('Telegram poller retry failed:', String(error.message || 'unknown error').slice(0, 180));
      schedulePollerRetry(pool);
    });
  }, 5000);
  pollerRetryTimer.unref?.();
}

async function stopTelegramBot({ retry = false, permanent = false } = {}) {
  if (permanent) { shuttingDown = true; runtimeStatus = 'stopped'; }
  if (pollerRetryTimer) {
    clearTimeout(pollerRetryTimer);
    pollerRetryTimer = null;
  }

  const currentBot = bot;
  bot = null;
  if (currentBot) {
    try {
      await currentBot.stopPolling();
    } catch (error) {
      console.warn('Telegram polling stop notice:', String(error.message || 'already stopped').slice(0, 160));
    }
  }

  const currentLock = pollerLock;
  pollerLock = null;
  if (currentLock) {
    try { currentLock.release(); } catch (_) {}
  }

  if (retry && !shuttingDown && !pollerConflict && activePool) schedulePollerRetry(activePool);
}

function telegramMenu({ username, role, status, whatsappStatus, connected, capacity }) {
  return [
    '╭━━━〔 ♤ SUPREME MD V2 〕━━━╮',
    '       THE SUPREME CONTROL PANEL',
    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
    '',
    '◈ MEMBER      ' + username,
    '◈ ACCESS      ' + String(role).toUpperCase(),
    '◈ SYSTEM      ' + status,
    '◈ WHATSAPP    ' + String(whatsappStatus).toUpperCase(),
    '◈ SESSIONS    ' + connected + '/' + capacity,
    '',
    '┏━━〔 01 · GENERAL 〕',
    '/start  /link  /menu  /commands  /help  /alive  /ping',
    '/info  /uptime  /time  /date  /version',
    '/server  /health  /website  /support',
    '/rules  /privacy  /features',
    '/calc  /title  /initials  /trim  /reverse',
    '/upper  /lower  /count  /echo  /owner',
    '',
    '┣━━〔 02 · MY ACCOUNT 〕',
    '/profile  /account  /role  /myid',
    '',
    '┣━━〔 03 · WHATSAPP 〕',
    '/pair  /connect  /status  /session',
    '/disconnect',
    '',
    '┣━━〔 04 · SOCIAL & DISCOVERY 〕',
    '/instagram  /pinterest  /youtube',
    '/tiktok  /facebook  /spotify',
    '',
    '┗━━〔 05 · ADMIN ONLY 〕',
    '/admin  /stats  /members',
    '',
    '♤ POWERED BY SUPREME DEV ♤',
    'CHRIS REMAINS SUPREME'
  ].join('\n');
}

async function startTelegramBot(pool) {
  activePool = pool;
  if (shuttingDown) return null;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    runtimeStatus = 'disabled';
    runtimeIssue = 'TELEGRAM_BOT_TOKEN is not configured.';
    console.log('Telegram bot disabled: TELEGRAM_BOT_TOKEN is not configured.');
    return null;
  }
  if (pollerConflict) { runtimeStatus = 'conflict'; return null; }
  if (bot) return bot;
  if (pollerLock) { runtimeStatus = 'standby'; return null; }

  // Telegram getUpdates polling permits only one active poller per bot token.
  // Hold a PostgreSQL session advisory lock for the entire polling lifetime,
  // so overlapping Render deploy instances cannot create competing pollers.
  const candidateLock = await pool.connect();
  const lockResult = await candidateLock.query(
    'SELECT pg_try_advisory_lock($1, $2) AS locked',
    [1397769293, 2]
  );
  if (!lockResult.rows[0]?.locked) {
    candidateLock.release();
    runtimeStatus = 'standby';
    runtimeIssue = 'Another V2 API instance currently owns the Telegram polling lock.';
    console.log('Telegram polling standby: another API instance owns the poller lock. Retrying shortly.');
    schedulePollerRetry(pool);
    return null;
  }
  pollerLock = candidateLock;
  runtimeStatus = 'starting';
  runtimeIssue = null;
  candidateLock.on('error', error => {
    console.error('Telegram poller lock connection error:', String(error.message || 'database connection lost').slice(0, 160));
    void stopTelegramBot({ retry: true });
  });
  candidateLock.on('end', () => {
    if (pollerLock === candidateLock && !shuttingDown) {
      console.error('Telegram poller lock connection ended unexpectedly.');
      void stopTelegramBot({ retry: true });
    }
  });
  console.log('Telegram polling lock acquired by this API instance.');

  const TelegramBot = require('node-telegram-bot-api');
  // Register all update handlers before polling, and clear any stale webhook so getUpdates can receive messages.
  bot = new TelegramBot(token, { polling: false });

  bot.on('polling_error', error => {
    const causes = error?.cause?.errors || error?.errors || [];
    const details = Array.isArray(causes)
      ? causes.map(item => String(item.code || item.message || 'network error').slice(0, 100)).join(', ')
      : '';
    const message = String(error.message || 'unknown error').slice(0, 180);
    console.error('Telegram polling error:', message, details ? 'causes=' + details : '');
    if (/409 Conflict/.test(message)) {
      runtimeStatus = 'conflict';
      runtimeIssue = 'A competing poller was detected. V2 will retry after releasing its database lock.';
      console.error('Telegram token conflict: stopping this poller and scheduling a guarded retry.');
      void stopTelegramBot({ retry: false }).finally(() => {
        if (!shuttingDown && activePool) {
          pollerConflict = false;
          schedulePollerRetry(activePool);
        }
      });
      return;
    }
    runtimeStatus = 'degraded';
    runtimeIssue = 'Telegram polling temporarily failed. Check the V2 API logs.';
  });

  bot.getMe().then(identity => {
    activeBotUsername = String(identity.username || activeBotUsername || '').replace(/^@/, '') || null;
    console.log('Telegram bot authenticated as @' + String(identity.username || 'unknown'));
  }).catch(error => {
    console.error('Telegram getMe check failed:', String(error.message || 'unknown error').slice(0, 180));
  });

  async function getLinkedMember(telegramId) {
    const result = await pool.query(
      'SELECT u.id, u.username, u.role, u.created_at, u.last_login, l.telegram_username, l.linked_at FROM telegram_links l JOIN users u ON u.id=l.user_id WHERE l.telegram_user_id=$1',
      [String(telegramId)]
    );
    return result.rows[0] || null;
  }

  async function sendMenu(chatId, member) {
    const [counts, runtime, session] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS connected FROM whatsapp_sessions WHERE status='connected'"),
      getMemberRuntimeStatus(member.id),
      pool.query('SELECT status FROM whatsapp_sessions WHERE user_id=$1', [member.id])
    ]);
    const whatsappStatus = runtime || session.rows[0]?.status || 'DISCONNECTED';
    const menuText = telegramMenu({
      username: member.username,
      role: member.role,
      status: 'ONLINE',
      whatsappStatus: String(whatsappStatus).toUpperCase(),
      connected: counts.rows[0].connected,
      capacity: MAX_SESSIONS
    });
    return bot.sendMessage(chatId, menuText, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚡ PAIR BY CODE', callback_data: 'wa_pair_help' },
            { text: '◈ MY STATUS', callback_data: 'wa_status' }
          ],
          [
            { text: '↻ CONNECT QR', callback_data: 'wa_connect' },
            { text: '⏻ DISCONNECT', callback_data: 'wa_disconnect' }
          ],
          [{ text: '⌂ OPEN WEBSITE', url: WEBSITE }]
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
    const utilityCommands = new Set(['/calc','/title','/initials','/trim','/reverse','/upper','/lower','/count','/echo','/owner']);
    if (utilityCommands.has(command)) {
      const response = commandReply({ name: command.slice(1), args }, { now, uptime: process.uptime(), receivedAt: now });
      return send(response || 'Command unavailable. Send /menu for help.');
    }

    switch (command) {
      case '/menu':
      case '/commands':
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
          await pool.query("INSERT INTO member_activity (user_id,event_type,message) VALUES ($1,'whatsapp','You started a WhatsApp connection from Telegram.')", [member.id]);
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
          await pool.query("INSERT INTO member_activity (user_id,event_type,message) VALUES ($1,'whatsapp','You requested a WhatsApp pairing code from Telegram.')", [member.id]);
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
          await pool.query("INSERT INTO member_activity (user_id,event_type,message) VALUES ($1,'whatsapp','You disconnected your WhatsApp session from Telegram.')", [member.id]);
          return send('Your WhatsApp session has been disconnected.');
        } catch (error) {
          console.error('Telegram WhatsApp disconnect failed:', error.message);
          return send('Could not disconnect your session right now.');
        }
      case '/instagram': {
        const handle = String(args[0] || '').replace(/^@/, '');
        if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return send('Usage: /instagram username\nOpens a public Instagram profile.');
        return send('✦ INSTAGRAM PROFILE\nhttps://www.instagram.com/' + encodeURIComponent(handle) + '/');
      }
      case '/pinterest': {
        const query = args.join(' ').trim();
        if (!query || query.length > 120) return send('Usage: /pinterest search topic\nExample: /pinterest gaming setup');
        return send('✦ PINTEREST DISCOVERY\nhttps://www.pinterest.com/search/pins/?q=' + encodeURIComponent(query));
      }
      case '/youtube': {
        const query = args.join(' ').trim();
        if (!query || query.length > 120) return send('Usage: /youtube search topic\nExample: /youtube javascript tutorial');
        return send('✦ YOUTUBE SEARCH\nhttps://www.youtube.com/results?search_query=' + encodeURIComponent(query));
      }
      case '/tiktok': {
        const handle = String(args[0] || '').replace(/^@/, '');
        if (!/^[A-Za-z0-9._]{1,24}$/.test(handle)) return send('Usage: /tiktok username\nOpens a public TikTok profile.');
        return send('✦ TIKTOK PROFILE\nhttps://www.tiktok.com/@' + encodeURIComponent(handle));
      }
      case '/facebook': {
        const handle = String(args[0] || '').replace(/^@/, '');
        if (!/^[A-Za-z0-9.]{1,50}$/.test(handle)) return send('Usage: /facebook username\nOpens a public Facebook profile.');
        return send('✦ FACEBOOK PROFILE\nhttps://www.facebook.com/' + encodeURIComponent(handle));
      }
      case '/spotify': {
        const query = args.join(' ').trim();
        if (!query || query.length > 120) return send('Usage: /spotify artist or song\nExample: /spotify Burna Boy');
        return send('✦ SPOTIFY SEARCH\nhttps://open.spotify.com/search/' + encodeURIComponent(query));
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
        return send('Unknown command. Send /menu to view the command list.');
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
      if (query.data === 'wa_disconnect') return handleCommand(fakeMessage, '/disconnect', [], member);
      if (query.data === 'wa_pair_help') {
        return bot.sendMessage(query.message.chat.id,
          '♤ WHATSAPP PAIRING\\n\\nSend your own number in international format:\\n/pair 2348012345678\\n\\nUse digits only, including your country code. Then enter the code in WhatsApp → Linked devices → Link with phone number instead. Keep the code private.',
          { disable_web_page_preview: true }
        );
      }
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
    if (/^\/[a-z]{1,20}$/.test(command)) console.log('Telegram command received: ' + command);

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
          await client.query("INSERT INTO member_activity (user_id,event_type,message) VALUES ($1,'telegram','You linked your Telegram account.')", [userId]);
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
        '/menu','/commands','/help','/alive','/ping','/info','/uptime','/time','/date','/version','/server','/health',
        '/website','/support','/rules','/privacy','/features','/profile','/account','/role','/myid',
        '/status','/session','/connect','/pair','/disconnect','/instagram','/pinterest','/youtube','/tiktok','/facebook','/spotify','/admin','/stats','/members',
        '/calc','/title','/initials','/trim','/reverse','/upper','/lower','/count','/echo','/owner'
      ]);
      if (!supported.has(command)) return send('Unknown command. Send /menu to view the command list.');
      await handleCommand(message, command, parts, member);
    } catch (error) {
      console.error('Telegram message handler failed:', error.message);
      try { await send('The bot could not complete that request. Please try again shortly.'); } catch (_) {}
    }
  });

  // Do not let a transient webhook API request crash the whole Telegram engine.
  // If Telegram still has a webhook configured, polling_error below will report the
  // conflict; otherwise polling can proceed normally.
  try {
    await bot.deleteWebHook({ drop_pending_updates: false });
  } catch (error) {
    console.error('Telegram webhook cleanup failed; attempting polling anyway:', String(error.message || 'network error').slice(0, 180));
  }
  try {
    await bot.startPolling({ interval: 1000, params: { timeout: 25 } });
    if (!pollerConflict) { runtimeStatus = 'online'; runtimeIssue = null; }
  } catch (error) {
    runtimeStatus = 'error';
    runtimeIssue = 'Telegram polling could not start. Check the API logs.';
    console.error('Telegram polling could not start:', String(error.message || 'unknown error').slice(0, 180));
    await stopTelegramBot({ retry: true });
    throw error;
  }
  console.log('SUPREME MD V2 Telegram bot polling started.');
  return bot;
}

function createLinkCode() {
  const code = crypto.randomBytes(8).toString('hex');
  return { code, codeHash: hashCode(code) };
}

module.exports = { startTelegramBot, stopTelegramBot, createLinkCode, telegramMenu, getTelegramRuntimeStatus };
