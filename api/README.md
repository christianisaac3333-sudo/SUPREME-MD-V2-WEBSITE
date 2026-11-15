# SUPREME MD V2 API

Standalone API service for the separate SUPREME MD V2 website. It does not connect to or modify the existing SUPREME MD bot.

## Routes
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/overview` (admin only)
- `POST /api/admin/bootstrap` (disabled until `BOOTSTRAP_ADMIN_SECRET` is configured; one-time)

## Render environment
- `DATABASE_URL`: Render Postgres internal connection string
- `JWT_SECRET`: random secret of at least 32 characters
- `FRONTEND_ORIGIN`: `https://supreme-md-v2.onrender.com`
- `NODE_ENV`: `production`
- `BOOTSTRAP_ADMIN_SECRET`: optional temporary secret for one-time admin promotion; remove after use

Passwords are hashed with bcrypt. Sessions use Secure, HttpOnly cookies. Admin roles are checked by the API, never trusted from browser input. No WhatsApp pairing/session logic is implemented in this API yet.
