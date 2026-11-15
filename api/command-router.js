'use strict';

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [days ? days + 'd' : null, hours ? hours + 'h' : null, minutes ? minutes + 'm' : null, remainder + 's']
    .filter(Boolean).join(' ');
}

function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('.')) return null;
  const parts = trimmed.slice(1).split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  if (!/^[a-z]{1,20}$/.test(name)) return null;
  return { name, args: parts };
}

function commandReply(command, context = {}) {
  const now = Number.isFinite(context.now) ? context.now : Date.now();
  switch (command.name) {
    case 'menu':
    case 'help':
      return [
        '♤ SUPREME MD V2',
        '',
        'GENERAL COMMANDS',
        '.menu  — Show this menu',
        '.alive  — Check bot status',
        '.ping  — Check response speed',
        '.info  — Platform information',
        '.uptime  — Server process uptime',
        '.time  — Current Nigeria time',
        '',
        'GROUP COMMANDS',
        '.groupinfo  — Show group details',
        '.admins  — List group admins',
        '.tagall  — Mention up to 30 members (admins)',
        '.welcome on/off  — Toggle welcome messages (admins)',
        '.goodbye on/off  — Toggle goodbye messages (admins)',
        '',
        'Admin-only group settings are saved separately for each of your sessions.'
      ].join('\n');
    case 'alive':
      return '♤ SUPREME MD V2 is online on this server instance.';
    case 'ping': {
      const elapsed = Math.max(0, now - (Number(context.receivedAt) || now));
      return 'Pong! ' + elapsed + ' ms';
    }
    case 'info':
      return [
        '♤ SUPREME MD V2',
        'Shared bot engine · Private member session',
        'Hosting: experimental free tier',
        'Note: the server may sleep or restart.'
      ].join('\n');
    case 'uptime':
      return 'Server process uptime: ' + formatDuration(context.uptime ?? process.uptime());
    case 'time':
      return 'Nigeria time: ' + new Intl.DateTimeFormat('en-NG', {
        timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'medium'
      }).format(new Date(now));
    default:
      return null;
  }
}

module.exports = { formatDuration, parseCommand, commandReply };
