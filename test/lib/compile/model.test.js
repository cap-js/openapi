const assert = require('node:assert/strict');
const { test } = require('node:test');
const cds = require('@sap/cds');
const { compileToOpenAPI } = require('../../../lib/compile');
const compilationModel = require('../../../lib/compile/model');

// JSON snapshots miss linking, symbols, non-enumerable metadata and replacement
// of equal-looking objects. Record descriptors and identity without invoking getters.
function snapshot(model) {
  const objects = new Map();
  function visit(value) {
    if (value === null || typeof value !== 'object' || objects.has(value)) return;
    const prototype = Object.getPrototypeOf(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    objects.set(value, { prototype, descriptors });
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if ('value' in descriptor) visit(descriptor.value);
    }
    if (prototype && !Object.hasOwn(prototype, 'constructor')) visit(prototype);
  }
  visit(model);
  return () => {
    for (const [object, { prototype, descriptors }] of objects) {
      assert.strictEqual(Object.getPrototypeOf(object), prototype, 'model prototype changed');
      const actual = Object.getOwnPropertyDescriptors(object);
      assert.deepStrictEqual(Reflect.ownKeys(actual), Reflect.ownKeys(descriptors), 'model properties changed');
      for (const key of Reflect.ownKeys(descriptors)) {
        const expected = descriptors[key];
        assert.deepStrictEqual(Reflect.ownKeys(actual[key]), Reflect.ownKeys(expected));
        for (const attribute of Reflect.ownKeys(expected)) {
          assert.strictEqual(actual[key][attribute], expected[attribute],
            `${String(key)} descriptor ${String(attribute)} changed`);
        }
      }
    }
  };
}

const source = `
  namespace mutation;
  entity Books { key ID: UUID; title: String; }
  @protocol: ['odata', 'rest']
  service AdminService {
    @odata.draft.enabled
    entity Books as projection on mutation.Books;
    function mapping(@mandatory first: String, @mandatory second: String not null) returns String;
    function optional(value: String) returns String;
  }
`;

for (const [name, prepare] of [
  ['raw', model => model],
  ['linked', model => cds.linked(model)],
  ['runtime draft', model => cds.compile.for.nodejs(model)],
]) {
  test(`OpenAPI compilation never mutates the ${name} model`, () => {
    const model = prepare(cds.compile.to.csn(source));
    // Include a symbol-keyed object to check isolation of non-JSON metadata.
    model[Symbol('metadata')] = { nested: { value: 1 } };
    const unchanged = snapshot(model);
    for (let i = 0; i < 2; i++) {
      const docs = [...compileToOpenAPI(model, { service: 'mutation.AdminService' })];
      assert.strictEqual(docs.length, 2);
      for (const [doc] of docs) {
        assert.strictEqual(doc.paths['/mapping'].get.parameters[0].required, true);
        assert.ok(Object.keys(doc.paths).some(path => path.startsWith('/Books')));
      }
      unchanged();
    }
    assert.throws(() => compileToOpenAPI(model, { service: 'MissingService' }));
    unchanged();
  });
}

test('compiler model preserves runtime metadata and isolates inherited draft objects', () => {
  const model = cds.compile.for.nodejs(cds.compile.to.csn(source));
  const view = compilationModel(model);
  const active = model.definitions['mutation.AdminService.Books'];
  const copied = view.definitions['mutation.AdminService.Books'];
  assert.strictEqual(view._4nodejs, view);
  assert.strictEqual(Object.getPrototypeOf(copied), view.definitions['mutation.Books']);
  assert.strictEqual(Object.getPrototypeOf(copied.drafts), copied);
  assert.notStrictEqual(copied.elements.DraftAdministrativeData, active.elements.DraftAdministrativeData);
  assert.strictEqual(copied.elements.DraftAdministrativeData.virtual, true);
  assert.strictEqual(copied._service, view.definitions['mutation.AdminService']);
  const param = model.definitions['mutation.AdminService.mapping'].params.first;
  const copiedParam = view.definitions['mutation.AdminService.mapping'].params.first;
  assert.strictEqual(Object.getPrototypeOf(copiedParam), Object.getPrototypeOf(param));
  assert.strictEqual(param.notNull, undefined);
  assert.strictEqual(copiedParam.notNull, true);
});
