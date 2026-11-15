'use strict';

const crypto = require('node:crypto');
const { commandReply } = require('./command-router');

let bot = null;

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
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

  bot.on('message', async message => {
    const chatId = message.chat?.id;
    const telegramId = message.from?.id;
    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!chatId || !telegramId || !text || message.chat?.type !== 'private') return;

    const send = value => bot.sendMessage(chatId, value, { disable_web_page_preview: true });
    const parts = text.split(/\s+/);
    const command = (parts.shift() || '').split('@')[0].toLowerCase();

    try {
      if (command === '/start') {
        await send('♤ SUPREME MD V2\nOne shared bot. Separate member accounts.\n\nSign in to your SUPREME MD V2 website account, generate a Telegram link code, then send /link YOUR_CODE here.\n\nUse /help after linking.');
        return;
      }

      if (command === '/link') {
        const code = String(parts[0] || '').toLowerCase();
        if (!/^[a-f0-9]{16}$/.test(code)) {
          await send('To link your account, generate a fresh code from your signed-in SUPREME MD V2 website, then send /link followed by that code. Codes expire after 10 minutes.');
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
          const member = await pool.query('SELECT username FROM users WHERE id=$1', [userId]);
          await send('♤ TELEGRAM LINKED\nWebsite account: ' + (member.rows[0]?.username || 'member') + '\n\nYour Telegram identity is now linked. Send /menu to see available commands.');
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

      const linked = await pool.query('SELECT u.username, u.role FROM telegram_links l JOIN users u ON u.id=l.user_id WHERE l.telegram_user_id=$1', [String(telegramId)]);
      if (!linked.rowCount) {
        await send('Your Telegram account is not linked yet. Sign in to the SUPREME MD V2 website, generate a Telegram link code, then send /link YOUR_CODE here.');
        return;
      }

      const names = { '/menu': 'menu', '/help': 'help', '/alive': 'alive', '/ping': 'ping', '/info': 'info', '/uptime': 'uptime', '/time': 'time' };
      const name = names[command];
      if (!name) {
        await send('Unknown command. Send /menu to see the available commands.');
        return;
      }
      const reply = commandReply({ name }, { now: Date.now(), receivedAt: Date.now(), uptime: process.uptime() });
      await send(reply || 'Command unavailable.');
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

module.exports = { startTelegramBot, createLinkCode };
