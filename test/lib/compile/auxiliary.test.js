const assert = require('node:assert/strict');
const { test } = require('node:test');
const auxiliaryModel = require('../../../lib/compile/auxiliary');

test('auxiliary reads are lazy and preserve cycles and shared references', () => {
  let reads = 0;
  const nested = { value: 1, get computed() { reads++; return this.value; } };
  const model = { nested, alias: nested };
  model.self = model;
  const view = auxiliaryModel(model);
  assert.strictEqual(reads, 0);
  assert.strictEqual(view.self, view);
  assert.strictEqual(view.nested, view.alias);
  assert.strictEqual(reads, 0);
  view.nested.value = undefined;
  assert.strictEqual(view.alias.computed, undefined);
  assert.strictEqual(reads, 1);
  assert.strictEqual(model.nested.value, 1);
  assert.strictEqual(auxiliaryModel(model).nested.value, 1);
});

test('definitions, symbols and enumeration include local and original properties', () => {
  const symbol = Symbol('metadata');
  const model = { nested: { original: true } };
  const view = auxiliaryModel(model);
  Object.defineProperty(view.nested, 'hidden', { value: { count: 1 } });
  view.nested[symbol] = { value: 2 };
  view.nested[symbol].value++;
  assert.strictEqual('original' in view.nested, true);
  assert.strictEqual(view.nested.original, true);
  assert.deepStrictEqual(Object.keys(view.nested), ['original']);
  assert.deepStrictEqual(Reflect.ownKeys(view.nested), ['original', 'hidden', symbol]);
  assert.strictEqual(Object.getOwnPropertyDescriptor(view.nested, 'hidden').value, view.nested.hidden);
  assert.strictEqual(view.nested[symbol].value, 3);
  assert.deepStrictEqual(model, { nested: { original: true } });
});

test('getters store caches locally and writes shadow original accessors', () => {
  const model = {
    value: 2,
    get computed() { return this.cached ??= this.value * 2; },
    set input(_) { assert.fail('writes must go to the overlay, not the original setter'); },
  };
  const view = auxiliaryModel(model);
  assert.strictEqual(view.computed, 4);
  assert.strictEqual(view.cached, 4);
  view.input = 3;
  assert.strictEqual(view.input, 3);
  view.value = 3;
  delete view.cached;
  assert.strictEqual(view.computed, 6);
  assert.strictEqual(model.value, 2);
  assert.strictEqual(Object.hasOwn(model, 'cached'), false);
  assert.strictEqual(Object.hasOwn(model, 'input'), true);
});

test('deleting local enrichment reveals the original value again', () => {
  const model = { value: 1 };
  const view = auxiliaryModel(model);
  view.value = undefined;
  assert.strictEqual(view.value, undefined);
  delete view.value;
  assert.strictEqual(view.value, 1);
  delete view.value;
  assert.strictEqual(view.value, 1);
  assert.deepStrictEqual(model, { value: 1 });
});

test('prototype changes and inherited auxiliary properties leave the source untouched', () => {
  const model = { base: { notNull: false }, param: {} };
  const view = auxiliaryModel(model);
  Object.setPrototypeOf(view.param, view.base);
  view.base.notNull = true;
  assert.strictEqual(view.param.notNull, true);
  assert.strictEqual(Object.getPrototypeOf(view.param), view.base);
  assert.strictEqual(model.base.notNull, false);
  assert.strictEqual(Object.getPrototypeOf(model.param), Object.prototype);
  assert.throws(() => Object.setPrototypeOf(view.base, view.param), TypeError);
});

test('arrays preserve their shape and allow local enrichment of entries', () => {
  const model = { values: [{ value: 1 }, { value: 2 }] };
  const view = auxiliaryModel(model);
  assert.strictEqual(Array.isArray(view.values), true);
  assert.strictEqual(view.values.length, 2);
  assert.deepStrictEqual(view.values.map(entry => entry.value), [1, 2]);
  view.values[0].extra = true;
  view.values.metadata = { count: 2 };
  assert.strictEqual(view.values[0].extra, true);
  assert.strictEqual(view.values.metadata.count, 2);
  assert.deepStrictEqual(model, { values: [{ value: 1 }, { value: 2 }] });
});

test('frozen source objects can have auxiliary overrides without being copied', () => {
  const model = Object.freeze({ nested: Object.freeze({ value: 1 }) });
  const view = auxiliaryModel(model);
  view.nested.value = 2;
  assert.strictEqual(view.nested.value, 2);
  assert.strictEqual(model.nested.value, 1);
  assert.throws(() => Object.preventExtensions(view), TypeError);
  assert.deepStrictEqual(Object.keys(view), ['nested']);
});
