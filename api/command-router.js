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
  const args = Array.isArray(command.args) ? command.args : [];
  const input = args.join(' ').trim().slice(0, 500);
  switch (command.name) {
    case 'menu':
    case 'help':
    case 'commands':
      return [
        '♤ SUPREME MD V2', '',
        'GENERAL',
        '.menu  .alive  .ping  .info  .uptime',
        '.time  .date  .version  .owner  .support', '',
        'TEXT & TOOLS',
        '.calc  .choose  .coinflip  .roll',
        '.reverse  .upper  .lower  .count  .echo', '',
        'GROUP COMMANDS',
        '.groupinfo  .admins  .tagall',
        '.welcome on/off  .goodbye on/off', '',
        'Group admin commands require group-admin permissions.',
        'Send a command with the dot prefix.'
      ].join('\n');
    case 'alive':
      return '♤ SUPREME MD V2 is online on this server instance.';
    case 'ping': {
      const elapsed = Math.max(0, now - (Number(context.receivedAt) || now));
      return 'Pong! ' + elapsed + ' ms';
    }
    case 'info':
      return ['♤ SUPREME MD V2','Shared bot engine · Private member session','WhatsApp commands are available in your connected session.'].join('\n');
    case 'uptime':
      return 'Server process uptime: ' + formatDuration(context.uptime ?? process.uptime());
    case 'time':
      return 'Nigeria time: ' + new Intl.DateTimeFormat('en-NG', { timeZone:'Africa/Lagos', dateStyle:'medium', timeStyle:'medium' }).format(new Date(now));
    case 'date':
      return 'Nigeria date: ' + new Intl.DateTimeFormat('en-NG', { timeZone:'Africa/Lagos', dateStyle:'full' }).format(new Date(now));
    case 'version':
      return 'SUPREME MD V2 · Version 2.1';
    case 'owner':
      return '♤ SUPREME DEV ♤\nCHRIS REMAINS SUPREME';
    case 'support':
      return 'SUPPORT\nVisit https://supreme-md-v2.onrender.com and open your member dashboard.';
    case 'calc': {
      const match = /^(-?\d+(?:\.\d+)?)\s*([+\-*/%])\s*(-?\d+(?:\.\d+)?)$/.exec(input);
      if (!match) return 'Usage: .calc 12 + 5\nSupported: +  -  *  /  %';
      const a=Number(match[1]), b=Number(match[3]), op=match[2];
      if ((op==='/' || op==='%') && b===0) return 'Cannot divide by zero.';
      const result=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:a%b;
      if (!Number.isFinite(result)) return 'That calculation is outside the supported range.';
      return 'Result: '+String(Number(result.toFixed(6)));
    }
    case 'choose': {
      const options=input.split(',').map(item=>item.trim()).filter(Boolean).slice(0,20);
      if(options.length<2)return 'Usage: .choose option one, option two, option three';
      return '♤ SUPREME PICK\n'+options[Math.floor(Math.random()*options.length)];
    }
    case 'coinflip':
      return '♤ COIN FLIP\n'+(Math.random()<0.5?'Heads':'Tails');
    case 'roll': {
      const notation=input||'1d6';
      const match=/^(\d{1,2})d(\d{1,4})$/i.exec(notation);
      if(!match)return 'Usage: .roll 1d6 (up to 10 dice, up to 1000 sides each)';
      const count=Number(match[1]), sides=Number(match[2]);
      if(count<1||count>10||sides<2||sides>1000)return 'Use 1–10 dice and 2–1000 sides.';
      const rolls=Array.from({length:count},()=>1+Math.floor(Math.random()*sides));
      return '♤ DICE ROLL\n'+rolls.join(' + ')+' = '+rolls.reduce((sum,value)=>sum+value,0);
    }
    case 'reverse':
      return input?Array.from(input).reverse().join(''):'Usage: .reverse your text';
    case 'upper':
      return input?input.toLocaleUpperCase():'Usage: .upper your text';
    case 'lower':
      return input?input.toLocaleLowerCase():'Usage: .lower your text';
    case 'count': {
      if(!input)return 'Usage: .count your text';
      const words=input.split(/\s+/).filter(Boolean).length;
      return 'TEXT COUNT\nWords: '+words+'\nCharacters: '+input.length;
    }
    case 'echo':
      return input||'Usage: .echo your message';
    default:
      return null;
  }
}
module.exports = { formatDuration, parseCommand, commandReply };
