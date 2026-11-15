# SUPREME MD V2 — Multi-session WhatsApp architecture

Status: design only. This document does not enable WhatsApp connections or change the existing bot.

## Product model

- One shared SUPREME MD V2 bot engine and command set.
- Each signed-in website member may link their own WhatsApp account.
- Each member's connection, commands, settings, and stored authentication state are scoped to that member's database user ID.
- Members cannot read, export, or control another member's session.
- The existing SUPREME MD / SUPREME-MD-CLOUD project remains separate and untouched.

## Proposed service layout

1. **Website** — sign-in, connection controls, QR/pairing display, status, disconnect.
2. **V2 API** — authenticates the website member, authorizes every session operation, and exposes only safe session metadata.
3. **Session worker** — runs the shared WhatsApp Web-compatible engine and owns live socket connections. It accepts jobs from the API and emits connection-state events.
4. **Neon PostgreSQL** — stores session ownership, status, timestamps, and encrypted authentication-state records. It must never store raw WhatsApp credentials in plaintext.
5. **Encryption key** — a strong, separately generated key held only as a private worker/API environment secret, never in GitHub, browser code, logs, or the database.

## Session lifecycle

1. A member signs in and requests a connection.
2. The API derives the member ID from the verified HttpOnly login cookie; it never accepts a member ID supplied by the browser as authority.
3. The worker creates a pending session owned by that member and returns a short-lived QR payload or pairing-code state to that same authenticated member.
4. QR/pairing data is temporary. It is not written to logs or retained as session history.
5. On successful linking, the worker encrypts the authentication state before persistence and marks that member's session connected.
6. On restart, the worker loads only encrypted state, decrypts it in memory, and reconnects the corresponding account.
7. Disconnect revokes the worker connection and deletes the stored authentication state for that member.

## Isolation and security requirements

- Enforce ownership in every API query and worker job; never trust browser-provided user IDs.
- Use authenticated, short-lived events for QR/status delivery. Do not publish QR payloads on public channels.
- Encrypt authentication state with authenticated encryption (for example AES-256-GCM), unique nonces, key versioning, and rotation planning.
- Keep encryption keys outside PostgreSQL and source control. Do not print credentials, pairing codes, QR payloads, or phone numbers in logs.
- Store only masked phone-number display metadata if needed.
- Rate-limit connection attempts and pairing-code requests; add per-account limits and cooldowns.
- Require explicit user confirmation before disconnecting a linked account.
- Treat session state as highly sensitive: restrict database access, use TLS, audit administrative access, and provide a clear disconnect/delete path.
- Add a worker lease/lock so the same session cannot be opened by two worker instances at once.
- Do not expose raw session files or credentials through admin/member APIs.

## Suggested database records

- `whatsapp_sessions`: session ID, owner user ID, status, masked phone label, created/updated/connected timestamps, and disconnect timestamp.
- `whatsapp_auth_state`: session ID, encrypted payload, nonce/IV, authentication tag, key version, and updated timestamp.
- `whatsapp_session_events`: minimal operational events without QR data, pairing codes, phone numbers, or credential contents.

A member should have at most one active personal WhatsApp session initially. A later product decision can support multiple sessions per member.

## Hosting constraints and rollout

- The current Render free web service uses an ephemeral filesystem and may sleep. Do not store live authentication files only on its local filesystem.
- Use the existing Neon database for encrypted durable state, and a separate worker service for persistent socket ownership. A free/sleeping worker is not suitable for reliable always-on WhatsApp connections; production use needs an always-on worker plan and monitoring.
- Begin with one worker instance and database-backed ownership/lease controls. Do not scale worker replicas until session claiming, reconnect, and duplicate-connection handling are tested.
- Build and test the worker independently from the existing V2 API; preserve current registration, login, admin, and member features.
- Add API routes and UI controls only after encryption, ownership checks, worker lifecycle, and recovery tests pass.

## Important platform note

WhatsApp Web-compatible libraries are unofficial integrations, not the official WhatsApp Business Platform. They may break when WhatsApp changes its web protocol and may expose linked accounts to account restrictions. The website must clearly disclose this limitation and let a member disconnect. Do not describe this as Meta-approved.

## Acceptance tests before public launch

- Two test accounts can link separate sessions without seeing each other's QR, pairing state, status, or credentials.
- A member cannot request another member's session by changing an ID in a request.
- Restarting the worker restores sessions without duplicate sockets.
- Expired QR/pairing data cannot be reused.
- Disconnect deletes encrypted authentication state and closes the socket.
- Logs and API responses contain no credentials or pairing secrets.
- Existing website authentication/admin functions and the original bot remain unaffected.
