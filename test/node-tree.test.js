/**
 * node-tree.test.js - element tree and event bubbling tests
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

var test = require('node:test');
var assert = require('assert');
var PassThrough = require('stream').PassThrough;

var blessed = require('../lib/blessed');

function makeScreen() {
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
  screen._testInput = input;
  screen._testOutput = output;
  return screen;
}

test('emitDescendants delivers event name and args (slice bug fix)', function(t) {
  var screen = makeScreen();
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var parent = blessed.box({ parent: screen });
  var childA = blessed.box({ parent: parent });
  var childB = blessed.box({ parent: parent });

  var seen = [];
  childA.on('custom-evt', function(a, b) { seen.push(['A', a, b]); });
  childB.on('custom-evt', function(a, b) { seen.push(['B', a, b]); });
  parent.on('custom-evt', function(a, b) { seen.push(['P', a, b]); });

  parent.emitDescendants('custom-evt', 1, 2);

  assert.deepStrictEqual(seen.sort(), [['A', 1, 2], ['B', 1, 2], ['P', 1, 2]],
    'emitDescendants must deliver event with args to self and descendants');

  // The trailing-function form must iterate without emitting a bogus event.
  var visited = [];
  parent.emitDescendants(function(el) { visited.push(el); });
  assert.deepStrictEqual(visited, [parent, childA, childB],
    'iterator form should visit self and descendants only');
});

test('emitAncestors bubbles event up the tree (slice bug fix)', function(t) {
  var screen = makeScreen();
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var parent = blessed.box({ parent: screen });
  var child = blessed.box({ parent: parent });

  var seen = [];
  parent.on('bubble-evt', function(x) { seen.push(['P', x]); });
  screen.on('bubble-evt', function(x) { seen.push(['S', x]); });

  child.emitAncestors('bubble-evt', 42);

  assert.deepStrictEqual(seen.sort(), [['P', 42], ['S', 42]],
    'emitAncestors must deliver event with args to ancestors');
});

test('emit bubbles element events to screen', function(t) {
  var screen = makeScreen();
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var box = blessed.box({ parent: screen });
  var got = null;
  screen.on('element my-evt', function(el, payload) { got = [el, payload]; });

  box.emit('my-evt', 'payload!');

  assert.ok(got, 'screen should receive bubbled element event');
  assert.strictEqual(got[0], box);
  assert.strictEqual(got[1], 'payload!');
});

test('append/remove maintain tree invariants', function(t) {
  var screen = makeScreen();
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var box = blessed.box({ parent: screen });
  var inner = blessed.box({ parent: box });

  assert.strictEqual(box.parent, screen);
  assert.strictEqual(inner.parent, box);
  assert.strictEqual(screen.children.length, 1);
  assert.ok(box.hasDescendant(inner));
  assert.ok(inner.hasAncestor(box));

  box.remove(inner);
  assert.strictEqual(inner.parent, null);
  assert.ok(inner.detached);
  assert.ok(!box.hasDescendant(inner));

  box.append(inner);
  assert.strictEqual(inner.parent, box);
  assert.ok(!inner.detached);

  inner.destroy();
  assert.ok(inner.destroyed);
  assert.ok(!box.hasDescendant(inner));
  assert.strictEqual(box.children.indexOf(inner), -1);
});

test('collectDescendants returns full subtree', function(t) {
  var screen = makeScreen();
  t.after(function() { if (!screen.destroyed) screen.destroy(); });

  var a = blessed.box({ parent: screen });
  var b = blessed.box({ parent: a });
  var c = blessed.box({ parent: a });

  assert.deepStrictEqual(a.collectDescendants(true).sort(function(x, y) {
    return x.uid - y.uid;
  }), [a, b, c].sort(function(x, y) { return x.uid - y.uid; }));
});
