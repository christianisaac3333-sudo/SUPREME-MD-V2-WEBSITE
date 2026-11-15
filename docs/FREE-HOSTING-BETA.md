# SUPREME MD V2 — Free-hosting WhatsApp beta

This document defines the no-paid-services implementation target.

## Existing free services

- Static website: `https://supreme-md-v2.onrender.com`
- API: `https://supreme-md-2-api2.onrender.com`
- Database: existing Neon free project

No paid Render worker, paid Key Value instance, paid database, or external paid queue is part of this plan.

## What the free beta can support

The API can host the shared WhatsApp engine in the same Node.js web-service process while that process is awake. Each signed-in member must have a separate server-owned session record. The browser must never receive or store WhatsApp authentication credentials.

The database must store session state only as authenticated ciphertext (AES-256-GCM). The encryption key must be a private Render environment variable, never committed to GitHub or sent to the browser. Session routes must always derive the member ID from the authenticated cookie; clients must not choose another member's ID.

## Free-plan limitation

A free web service can sleep when idle and can restart or redeploy. While it sleeps, the WhatsApp socket cannot receive or process messages. After the service wakes, the app may restore encrypted credentials and attempt to reconnect, but there is no 24/7 uptime guarantee. Do not use an uptime-ping workaround to evade free-plan sleep limits.

For that reason, the beta must clearly show one of these states: `Connecting`, `Connected (while service is awake)`, `Reconnecting`, `Disconnected`, or `Needs relinking`. It must not promise continuous availability.

## Safety and account caveat

The WhatsApp Web library approach is unofficial and may be incompatible with WhatsApp's terms or protocol changes. Linking an account may lead to temporary restrictions or loss of access. The user should only link an account they own or are authorized to manage. Never ask a member to send QR codes, pairing codes, OTPs, or session files to support staff.

## Implementation gates

1. Add a database-backed, per-member session registry.
2. Add authenticated connect/status/disconnect endpoints.
3. Add encrypted credential persistence and strict ownership checks.
4. Add the QR and pairing-code interface only after the backend lifecycle is tested.
5. Test isolation with two separate test accounts and verify that one account cannot read, disconnect, or control the other's session.
6. Verify restart/reconnect behavior and display free-host sleep limitations in the UI.

## Not included

This free beta does not provide guaranteed 24/7 connections, high availability, or a dedicated always-on worker. Those require hosting that is not part of the free-only requirement.
