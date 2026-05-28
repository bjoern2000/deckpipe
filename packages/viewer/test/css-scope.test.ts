import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeRootToHost, tokensToCss } from '../src/css-scope.js';

test('scopeRootToHost: bare :root selector becomes :host', () => {
  assert.equal(
    scopeRootToHost(':root { --g: linear-gradient(90deg,red,blue); }'),
    ':host { --g: linear-gradient(90deg,red,blue); }',
  );
});

test('scopeRootToHost: :root in a selector list and descendant combinator', () => {
  assert.equal(scopeRootToHost(':root, .x { color: red }'), ':host, .x { color: red }');
  assert.equal(scopeRootToHost(':root .card { padding: 8px }'), ':host .card { padding: 8px }');
});

test('scopeRootToHost: does not touch .root class or unrelated identifiers', () => {
  assert.equal(scopeRootToHost('.root { color: red }'), '.root { color: red }');
  assert.equal(scopeRootToHost('.uproot { color: red }'), '.uproot { color: red }');
});

test('scopeRootToHost: leaves CSS without :root untouched', () => {
  const css = '.slide { background: var(--g); }';
  assert.equal(scopeRootToHost(css), css);
});

test('tokensToCss: builds a :host block, normalizing key names', () => {
  assert.equal(
    tokensToCss({ '--accent': '#7c3aed', grad: 'linear-gradient(90deg,red,blue)' }),
    ':host {\n  --accent: #7c3aed;\n  --grad: linear-gradient(90deg,red,blue);\n}',
  );
});

test('tokensToCss: empty / nullish maps yield empty string', () => {
  assert.equal(tokensToCss(null), '');
  assert.equal(tokensToCss(undefined), '');
  assert.equal(tokensToCss({}), '');
});
