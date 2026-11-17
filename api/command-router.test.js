'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {formatDuration,parseCommand,commandReply}=require('./command-router');

test('parses supported prefixed command text',()=>{
  assert.deepEqual(parseCommand('.menu'),{name:'menu',args:[]});
  assert.deepEqual(parseCommand('.ping now'),{name:'ping',args:['now']});
  assert.equal(parseCommand('hello'),null);
  assert.equal(parseCommand('.bad-command'),null);
});
test('formats uptime into readable units',()=>assert.equal(formatDuration(90061),'1d 1h 1m 1s'));
test('returns menu and safe basic command responses',()=>{
  assert.match(commandReply({name:'menu'}),/TEXT & TOOLS/);
  assert.match(commandReply({name:'alive'}),/online/);
  assert.match(commandReply({name:'uptime'},{uptime:61}),/1m 1s/);
  assert.equal(commandReply({name:'unknown'}),null);
});
test('formats time and date using Lagos timezone',()=>{
  assert.match(commandReply({name:'time'},{now:Date.UTC(2026,0,1,12)}),/Nigeria time:/);
  assert.match(commandReply({name:'date'},{now:Date.UTC(2026,0,1,12)}),/Nigeria date:/);
});
test('calculator accepts only a simple arithmetic expression',()=>{
  assert.equal(commandReply({name:'calc',args:['2','+','3']}),'Result: 5');
  assert.match(commandReply({name:'calc',args:['2','/','0']}),/zero/);
  assert.match(commandReply({name:'calc',args:['process.exit()']}),/Usage/);
});
test('text utilities handle bounded input',()=>{
  assert.equal(commandReply({name:'upper',args:['hello','world']}),'HELLO WORLD');
  assert.equal(commandReply({name:'reverse',args:['abc']}),'cba');
  assert.match(commandReply({name:'count',args:['one','two']}),/Words: 2/);
});
test('formatting commands return safe text results',()=>{
  assert.equal(commandReply({name:'title',args:['hello','WORLD']}),'Hello World');
  assert.equal(commandReply({name:'initials',args:['Chris','Isaac']}),'CI');
  assert.equal(commandReply({name:'trim',args:['hello','world']}),'hello world');
});
