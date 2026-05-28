import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeTokens, normalizeTokenKey } from '../src/utils/tokens.js';

test('normalizeTokenKey adds a leading -- only when missing', () => {
  assert.equal(normalizeTokenKey('accent'), '--accent');
  assert.equal(normalizeTokenKey('--accent'), '--accent');
});

test('create: merges into nothing, normalizing keys', () => {
  assert.deepEqual(mergeTokens(null, { accent: '#111', '--bg': '#fff' }), {
    '--accent': '#111',
    '--bg': '#fff',
  });
});

test('patch: string overwrites, null deletes that one key', () => {
  const existing = { '--accent': '#111', '--bg': '#fff' };
  assert.deepEqual(mergeTokens(existing, { '--accent': '#e11', '--bg': null }), {
    '--accent': '#e11',
  });
});

test('patch: undefined leaves tokens unchanged', () => {
  const existing = { '--accent': '#111' };
  assert.deepEqual(mergeTokens(existing, undefined), existing);
  assert.equal(mergeTokens(null, undefined), null);
});

test('patch: top-level null clears all tokens', () => {
  assert.equal(mergeTokens({ '--accent': '#111' }, null), null);
});

test('patch: deleting the last key collapses to null (clean column)', () => {
  assert.equal(mergeTokens({ '--accent': '#111' }, { '--accent': null }), null);
});

test('patch: un/prefixed keys refer to the same token', () => {
  assert.deepEqual(mergeTokens({ '--accent': '#111' }, { accent: '#222' }), {
    '--accent': '#222',
  });
});
