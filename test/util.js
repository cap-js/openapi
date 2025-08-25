const assert = require('assert');

/**
 * Recursively checks that all properties in expected exist and match in actual
 * actual may have more properties in addition to what expected specifies.
 * Those properties are ignored.
 * @param {object} actual
 * @param {object} expected
 * @param {string | undefined} [message]
 */
function assertMatchObject(actual, expected, message) {
  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), message ?? 'Expected an array');
    assert.strictEqual(actual.length, expected.length, message ?? 'Array length mismatch');
    for (let i = 0; i < expected.length; i++) {
      assertMatchObject(actual[i], expected[i], message);
    }
    return;
  }
  if (expected && typeof expected === 'object') {
    assert(actual && typeof actual === 'object', message ?? 'Expected an object');
    for (const key of Object.keys(expected)) {
      assertMatchObject(actual[key], expected[key], message);
    }
    return;
  }
  assert.strictEqual(actual, expected, message);
}

module.exports = {
    assertMatchObject
}