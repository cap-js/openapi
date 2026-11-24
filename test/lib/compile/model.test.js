const assert = require('node:assert/strict');
const { test } = require('node:test');
const cds = require('@sap/cds');
const { compileToOpenAPI } = require('../../../lib/compile');
const auxiliaryModel = require('../../../lib/compile/auxiliary');

// JSON snapshots miss linking, symbols, non-enumerable metadata and replacement
// of equal-looking objects. Record descriptors and identity without invoking getters.
function snapshot(model) {
  const objects = new Map();
  function visit(value) {
    if (value === null || typeof value !== 'object' || objects.has(value)) return;
    const prototype = Object.getPrototypeOf(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    objects.set(value, { prototype, descriptors, extensible: Object.isExtensible(value) });
    for (const key of Reflect.ownKeys(descriptors)) {
      const descriptor = descriptors[key];
      if ('value' in descriptor) visit(descriptor.value);
    }
    if (prototype && !Object.hasOwn(prototype, 'constructor')) visit(prototype);
  }
  visit(model);
  return () => {
    for (const [object, { prototype, descriptors, extensible }] of objects) {
      assert.strictEqual(Object.getPrototypeOf(object), prototype, 'model prototype changed');
      assert.strictEqual(Object.isExtensible(object), extensible, 'model extensibility changed');
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

function freezeModel(model, seen = new WeakSet()) {
  if (model === null || typeof model !== 'object' || seen.has(model)) return model;
  seen.add(model);
  const descriptors = Object.getOwnPropertyDescriptors(model);
  for (const key of Reflect.ownKeys(descriptors)) {
    if ('value' in descriptors[key]) freezeModel(descriptors[key].value, seen);
  }
  const prototype = Object.getPrototypeOf(model);
  if (prototype && !Object.hasOwn(prototype, 'constructor')) freezeModel(prototype, seen);
  return Object.freeze(model);
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
      for (const [doc, metadata] of docs) {
        assert.strictEqual(doc.paths['/mapping'].get.parameters[0].required, true);
        assert.ok(Object.keys(doc.paths).some(path => path.startsWith('/Books')));
        assert.ok(doc.servers[0].url.includes(metadata.file.endsWith('.rest') ? '/rest/' : '/odata/v4/'));
      }
      unchanged();
    }
    const v4doc = compileToOpenAPI(model, { service: 'mutation.AdminService', 'odata-version': '4.0' });
    assert.ok(v4doc.paths['/mapping(first={first},second={second})'],
      'mandatory overrides must also preserve inline function URLs in OData 4.0');
    unchanged();
    assert.throws(() => compileToOpenAPI(model, { service: 'MissingService' }));
    unchanged();
  });

  test(`OpenAPI compiles a deeply frozen ${name} model`, () => {
    const model = freezeModel(prepare(cds.compile.to.csn(source)));
    assert.strictEqual([...compileToOpenAPI(model, { service: 'all' })].length, 2);
  });

  test(`EDM errors leave the ${name} model untouched`, () => {
    const model = prepare(cds.compile.to.csn(source.replace('@mandatory first', 'first')));
    const unchanged = snapshot(model);
    assert.throws(() => compileToOpenAPI(model, { service: 'mutation.AdminService' }), /mandatory after optional/);
    unchanged();
  });
}

test('auxiliary model preserves runtime references and redirects nested writes', () => {
  const model = cds.compile.for.nodejs(cds.compile.to.csn(source));
  const unchanged = snapshot(model);
  const view = auxiliaryModel(model);
  const active = model.definitions['mutation.AdminService.Books'];
  assert.strictEqual(view._4nodejs, view);
  assert.strictEqual(view.definitions['mutation.AdminService.Books'].drafts.actives,
    view.definitions['mutation.AdminService.Books']);
  assert.strictEqual(view.definitions['mutation.AdminService.Books']._service,
    view.definitions['mutation.AdminService']);
  assert.strictEqual(Object.getPrototypeOf(view.definitions['mutation.AdminService.Books']),
    view.definitions['mutation.Books']);
  assert.strictEqual(active.drafts.actives, active);
  const param = model.definitions['mutation.AdminService.mapping'].params.first;
  const effectiveParam = view.definitions['mutation.AdminService.mapping'].params.first;
  assert.strictEqual(Object.getPrototypeOf(effectiveParam), Object.getPrototypeOf(param));
  effectiveParam.notNull = true;
  Object.defineProperty(effectiveParam, 'cached', { value: true });
  assert.strictEqual(param.notNull, undefined);
  assert.strictEqual(effectiveParam.notNull, true);
  assert.strictEqual(effectiveParam.cached, true);
  unchanged();
});

test('upstream-cloned runtime drafts lose required metadata and fail without input mutation', () => {
  // ORD 1.11.0 clones and minifies cds.model before calling OpenAPI (#204).
  // The proxy can preserve existing metadata, but cannot recover stripped flags.
  const runtime = cds.compile.for.nodejs(cds.compile.to.csn(source));
  assert.strictEqual(runtime.meta.transformation, 'odata');
  const cloned = cds.clone(runtime);
  assert.strictEqual(cloned.meta.transformation, undefined);
  assert.strictEqual(cloned.definitions['mutation.AdminService.Books'].elements.DraftAdministrativeData.virtual, true);
  const unchanged = snapshot(cloned);
  assert.throws(() => compileToOpenAPI(cloned, { service: 'mutation.AdminService' }), /virtual.*association/s);
  unchanged();
});

test('CAP linking and getter caches are stored in auxiliary state', () => {
  const model = cds.compile.to.csn('service S { entity E { key ID: UUID; } }');
  const unchanged = snapshot(model);
  const view = auxiliaryModel(model);
  cds.linked(view);
  assert.strictEqual(view.services[0], view.definitions.S);
  assert.strictEqual(view.definitions.S.entities.E, view.definitions['S.E']);
  assert.strictEqual(view.definitions['S.E']._service, view.definitions.S);
  assert.strictEqual(view.definitions['S.E'].elements.ID.parent, view.definitions['S.E']);
  unchanged();
});

test('EDM hooks see auxiliary changes without modifying the input model', () => {
  const model = cds.compile.to.csn('service S { entity E { key ID: UUID; } }');
  const unchanged = snapshot(model);
  const handler = csn => { csn.definitions.S['@Core.Description'] = 'Description from EDM hook'; };
  cds.on('compile.to.edmx', handler);
  try {
    const doc = compileToOpenAPI(model);
    assert.strictEqual(doc.info.description, 'Description from EDM hook');
    unchanged();
  } finally {
    cds.removeListener('compile.to.edmx', handler);
  }
});

test('OpenAPI defaults do not modify shared configuration', () => {
  const previous = cds.env.openapi;
  try {
    const config = {};
    cds.env.openapi = config;
    compileToOpenAPI(cds.compile.to.csn('service S { entity E { key ID: UUID; } }'));
    assert.deepStrictEqual(config, {});
  } finally {
    cds.env.openapi = previous;
  }
});
