const { describe, test } = require('node:test');
const assert = require('node:assert');
const { camelCaseToWords } = require('../../../lib/compile/string-util');

describe('string-util', () => {
  describe('camelCaseToWords', () => {
    test('converts underscores to spaces', () => {
      assert.strictEqual(camelCaseToWords('foo_bar_baz'), 'foo bar baz');
    });

    test('converts camelCase to words', () => {
      assert.strictEqual(camelCaseToWords('camelCase'), 'camel case');
    });

    test('preserves acronyms followed by words', () => {
      assert.strictEqual(camelCaseToWords('HTTPServer'), 'HTTP server');
    });

    test('preserves multiple acronyms followed by words', () => {
      assert.strictEqual(camelCaseToWords('HTTPServerForXML'), 'HTTP server for XML');
    });

    test('handles single word with no changes needed', () => {
      assert.strictEqual(camelCaseToWords('simple'), 'simple');
    });

    test('handles all uppercase words', () => {
      assert.strictEqual(camelCaseToWords('HTTP'), 'HTTP');
    });

    test('handles mixed underscores and camelCase', () => {
      assert.strictEqual(camelCaseToWords('foo_barBaz'), 'foo bar baz');
    });

    test('handles PascalCase', () => {
      assert.strictEqual(camelCaseToWords('PascalCase'), 'pascal case');
    });

    test('handles consecutive uppercase letters', () => {
      assert.strictEqual(camelCaseToWords('IOStream'), 'IO stream');
    });

    test('handles empty string', () => {
      assert.strictEqual(camelCaseToWords(''), '');
    });

    test('handles string with only underscores', () => {
      assert.strictEqual(camelCaseToWords('___'), '   ');
    });

    test('handles complex combinations', () => {
      assert.strictEqual(camelCaseToWords('my_HTTPSServerConnection'), 'my HTTPS server connection');
    });

    test('handles single uppercase letter', () => {
      assert.strictEqual(camelCaseToWords('A'), 'a');
    });

    test('handles numbers in string', () => {
      assert.strictEqual(camelCaseToWords('server2Client'), 'server2 client');
    });
  });
});
