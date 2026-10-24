'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { assertPatchedNode } = require('./check-node-security.cjs');

test('rejects vulnerable, unsupported and prerelease runtimes', () => {
  for (const version of ['20.20.2', '22.23.3', '24.22.0', '26.12.0',
    '23.0.0', '25.9.0', '27.0.0', '22.23.4-rc.1', 'invalid']) {
    assert.throws(() => assertPatchedNode(version), Error, version);
  }
});

test('accepts each fixed release and subsequent patches in its line', () => {
  for (const version of ['22.23.4', 'v22.23.4', '22.23.5', '22.24.0',
    '24.22.1', '24.22.2', '24.23.0', '26.12.1', '26.13.0']) {
    assert.doesNotThrow(() => assertPatchedNode(version), version);
  }
});
