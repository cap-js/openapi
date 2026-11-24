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

test('definitions, deletion, symbols and enumeration use auxiliary state', () => {
  const symbol = Symbol('metadata');
  const model = { nested: { original: true } };
  const view = auxiliaryModel(model);
  Object.defineProperty(view.nested, 'hidden', { value: { count: 1 } });
  view.nested[symbol] = { value: 2 };
  view.nested[symbol].value++;
  delete view.nested.original;
  assert.strictEqual('original' in view.nested, false);
  assert.strictEqual(view.nested.original, undefined);
  assert.deepStrictEqual(Object.keys(view.nested), []);
  assert.deepStrictEqual(Reflect.ownKeys(view.nested), ['hidden', symbol]);
  assert.strictEqual(Object.getOwnPropertyDescriptor(view.nested, 'hidden').value, view.nested.hidden);
  assert.strictEqual(view.nested[symbol].value, 3);
  assert.deepStrictEqual(model, { nested: { original: true } });
  assert.throws(() => Object.defineProperty(view, 'locked', {
    value: model.nested, writable: false, configurable: false,
  }), /proxied object value/);
  Object.defineProperty(view, 'locked', { value: view.nested, configurable: false });
  assert.strictEqual(view.locked, view.nested);
});

test('getters and setters redirect their implicit writes too', () => {
  const model = {
    value: 2,
    get computed() { return this.cached ??= this.value * 2; },
    set input(value) { this.value = value; delete this.cached; },
  };
  const view = auxiliaryModel(model);
  assert.strictEqual(view.computed, 4);
  assert.strictEqual(view.cached, 4);
  view.input = 3;
  assert.strictEqual(view.computed, 6);
  assert.strictEqual(model.value, 2);
  assert.strictEqual(Object.hasOwn(model, 'cached'), false);
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

test('array methods and implicit length changes are confined to auxiliary state', () => {
  const model = { values: [1, 2, 3] };
  const view = auxiliaryModel(model);
  assert.strictEqual(Array.isArray(view.values), true);
  view.values.push(4);
  assert.deepStrictEqual([...view.values], [1, 2, 3, 4]);
  view.values.splice(1, 1);
  assert.deepStrictEqual([...view.values], [1, 3, 4]);
  view.values.length = 1;
  view.values.length = 3;
  assert.deepStrictEqual([...view.values], [1, undefined, undefined]);
  assert.strictEqual('1' in view.values, false);
  assert.throws(() => { view.values.length = -1; }, RangeError);
  assert.strictEqual(view.values[0], 1);
  assert.deepStrictEqual(model.values, [1, 2, 3]);
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
