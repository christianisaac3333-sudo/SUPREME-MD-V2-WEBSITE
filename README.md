# SUPREME MD V2 — Elite frontend

A standalone dark-and-gold responsive website experience for SUPREME MD V2.

## Included
- Custom inline SVG crown crest and metallic brand system
- Responsive landing page and feature overview
- WhatsApp QR / pairing-code connection centre preview
- Member dashboard layout with clearly marked placeholder metrics
- Admin suite preview and member access preview
- Mobile navigation, dialogs, reduced-motion support

## Deploy
Render Static Site:
- Branch: `main`
- Build command: `echo "Static site ready"`
- Publish directory: `.`

## Important architecture boundary
This repository and Render static site are separate from the existing SUPREME MD bot project. No existing bot files, services, sessions or credentials are modified.

This release is a **frontend-only upgrade**. It does not provide real account creation, authentication, QR generation, pairing-code generation, WhatsApp sessions, admin permissions or live analytics. Those require a separately deployed, secured backend, database and explicit integration design. Never place bot tokens, API keys or WhatsApp session files in browser code or this public repository.