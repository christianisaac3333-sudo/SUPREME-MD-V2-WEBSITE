# SUPREME MD V2

SUPREME MD V2 is a dark, responsive member website with a separately deployed Node.js API.

## Services
- **Website:** Render Static Site, repository root, publish directory `.`.
- **API:** Render Web Service, root directory `api/`, build command `npm install`, start command `npm start`.
- **Database:** PostgreSQL, used for member accounts, encrypted WhatsApp session state, Telegram links, and member activity.

## Private environment configuration
Set credentials only in the V2 API service's Render Environment page. Never commit or paste secrets into the website repository.

Required API settings include:
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 characters)
- `WHATSAPP_SESSION_KEY` (64 hexadecimal characters)
- `TELEGRAM_BOT_TOKEN` (a dedicated token for the V2 Telegram bot)

Optional:
- `TELEGRAM_BOT_USERNAME`
- `FRONTEND_ORIGIN`
- `MAX_ACTIVE_SESSIONS`
- AI provider keys and model settings

**Important Telegram rule:** one Telegram bot token can have only one active polling process. Do not reuse the V2 token in the older SUPREME-MD-CLOUD project, Termux, or another hosting service. Give V2 its own BotFather-created bot token.

## WhatsApp commands
WhatsApp commands use a dot prefix. The website's Bot Commands section lists available commands and examples. Commands sent by the linked WhatsApp account are supported; bot replies are not treated as commands.

WhatsApp Web linking is experimental and can be interrupted by WhatsApp or free hosting restarts. Only link accounts you own or are authorised to manage. Keep QR codes and pairing codes private.

## Telegram commands
Telegram commands use a slash prefix and require the member to link their website account first. The bot is private-chat oriented. Admin commands require an admin account.

## Security notes
- Keep API keys, database URLs, session encryption keys, JWT secrets, and bot tokens in Render environment variables.
- Never return WhatsApp auth state, QR values, pairing codes, or link codes from public endpoints.
- Use only your own accounts and respect group permissions.
