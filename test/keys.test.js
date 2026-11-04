/**
 * keys.test.js - key event parsing tests
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

var test = require('node:test');
var assert = require('assert');
var PassThrough = require('stream').PassThrough;

var keys = require('../lib/keys');

function capture(stream) {
  var events = [];
  stream.on('keypress', function(ch, key) {
    events.push({ ch: ch, key: key });
  });
  return events;
}

test('plain characters produce keypress events', function() {
  var stream = new PassThrough();
  keys.emitKeypressEvents(stream);
  var events = capture(stream);

  stream.write('a');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].ch, 'a');
  assert.strictEqual(events[0].key.name, 'a');
});

test('carriage return maps to return/enter naming', function() {
  var stream = new PassThrough();
  keys.emitKeypressEvents(stream);
  var events = capture(stream);

  stream.write('\r');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].key.name, 'return');
});

test('escape sequences decode to named keys', function() {
  var stream = new PassThrough();
  keys.emitKeypressEvents(stream);
  var events = capture(stream);

  stream.write('\x1b[A'); // up arrow
  stream.write('\x1b[B'); // down arrow
  stream.write('\x1b[C'); // right arrow
  stream.write('\x1b[D'); // left arrow
  stream.write('\x1b');   // bare escape

  var names = events.map(function(e) { return e.key.name; });
  assert.deepStrictEqual(names, ['up', 'down', 'right', 'left', 'escape']);
});

test('ctrl chords are recognized', function() {
  var stream = new PassThrough();
  keys.emitKeypressEvents(stream);
  var events = capture(stream);

  stream.write('\x03'); // ctrl-c
  stream.write('\x04'); // ctrl-d

  assert.strictEqual(events[0].key.name, 'c');
  assert.ok(events[0].key.ctrl, 'ctrl modifier should be set');
  assert.strictEqual(events[1].key.name, 'd');
  assert.ok(events[1].key.ctrl, 'ctrl modifier should be set');
});

test('multi-byte utf8 characters survive splitting', function() {
  var stream = new PassThrough();
  keys.emitKeypressEvents(stream);
  var events = capture(stream);

  stream.write('é');
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].ch, 'é');
});

test('program relays keypress to screen with key.full', function(t) {
  var blessed = require('../lib/blessed');
  var input = new PassThrough();
  var output = new PassThrough();
  output.columns = 80;
  output.rows = 24;
  output.isTTY = true;

  var screen = blessed.screen({
    input: input,
    output: output,
    terminal: 'xterm-256color',
    warnings: false
  });
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var got = [];
  screen.key(['q', 'escape'], function(ch, key) {
    got.push(key.full);
  });

  input.write('q');
  input.write('\x1b');

  assert.deepStrictEqual(got, ['q', 'escape'],
    'screen.key bindings should fire from raw input');
});
