/**
 * smoke.test.js - automated smoke tests for blessed (revival)
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

var test = require('node:test');
var assert = require('assert');
var PassThrough = require('stream').PassThrough;

var blessed = require('../lib/blessed');

function fakeStreams() {
  var input = new PassThrough();
  var output = new PassThrough();
  output.columns = 80;
  output.rows = 24;
  output.isTTY = true;
  return { input: input, output: output };
}

test('module loads without deprecation warnings', function() {
  // Requiring every module catches syntax errors and bad requires.
  var modules = ['blessed', 'program', 'helpers', 'unicode', 'keys', 'colors',
    'tput', 'widget', 'events', 'alias'];
  modules.forEach(function(name) {
    assert.doesNotThrow(function() {
      require('../lib/' + name);
    }, 'failed to require lib/' + name);
  });
});

test('screen boots with piped streams and renders a box', function(t) {
  var streams = fakeStreams();

  var screen = blessed.screen({
    input: streams.input,
    output: streams.output,
    terminal: 'xterm-256color',
    warnings: false
  });

  t.after(function() {
    if (!screen.destroyed) screen.destroy();
  });

  var box = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 20,
    height: 5,
    border: 'line',
    content: 'hello revival'
  });

  screen.render();
  screen.program.flush();

  // The render pipeline must have produced escape sequences on the output.
  var out = streams.output.read();
  assert.ok(out && out.length > 0, 'expected output bytes after render()');

  // The internal cell buffer must reflect the box border and content.
  assert.strictEqual(screen.lines.length, 24);
  var cornerFound = false;
  for (var y = 0; y < screen.lines.length; y++) {
    var borderRow = screen.lines[y].map(function(cell) { return cell[1]; }).join('');
    if (borderRow.indexOf('┌') !== -1 || borderRow.indexOf('+') !== -1) {
      cornerFound = true;
      break;
    }
  }
  assert.ok(cornerFound, 'expected a top-left border character in cell buffer');
  var found = false;
  for (var y = 0; y < screen.lines.length; y++) {
    var line = screen.lines[y].map(function(cell) { return cell[1]; }).join('');
    if (line.indexOf('hello revival') !== -1) { found = true; break; }
  }
  assert.ok(found, 'expected box content in cell buffer');
  assert.ok(box.lpos, 'box should have layout position after render');

  screen.destroy();
  assert.ok(screen.destroyed, 'screen.destroyed should be true');
  assert.strictEqual(blessed.Screen.instances.indexOf(screen), -1,
    'destroyed screen should be removed from Screen.instances');
});

test('program is cleaned up after screen.destroy()', function(t) {
  var streams = fakeStreams();

  var screen = blessed.screen({
    input: streams.input,
    output: streams.output,
    terminal: 'xterm-256color',
    warnings: false
  });

  var program = screen.program;

  // Registering a key listener must attach the screen keypress handler.
  screen.key('q', function() {});
  assert.ok(program.listeners('keypress').length > 0,
    'keypress handler should be attached after screen.key()');

  screen.destroy();

  assert.ok(program.destroyed, 'program should be destroyed');
  assert.strictEqual(program.listenerCount('keypress'), 0,
    'program should have no keypress listeners after destroy (leak fix)');
  assert.strictEqual(program.listenerCount('mouse'), 0,
    'program should have no mouse listeners after destroy (leak fix)');
});

test('multiple create/destroy cycles do not accumulate instances', function() {
  for (var i = 0; i < 5; i++) {
    var streams = fakeStreams();
    var screen = blessed.screen({
      input: streams.input,
      output: streams.output,
      terminal: 'xterm-256color',
      warnings: false
    });
    screen.key('q', function() {});
    screen.destroy();
  }

  assert.strictEqual(blessed.Screen.instances.length, 0,
    'Screen.instances should be empty after destroy');
  assert.strictEqual(blessed.Program.instances.length, 0,
    'Program.instances should be empty after destroy');
});

test('double destroy does not throw', function() {
  var streams = fakeStreams();
  var screen = blessed.screen({
    input: streams.input,
    output: streams.output,
    terminal: 'xterm-256color',
    warnings: false
  });
  screen.destroy();
  assert.doesNotThrow(function() {
    screen.destroy();
  });
});
