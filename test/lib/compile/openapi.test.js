const { path } = require('@sap/cds/lib/utils/cds-utils');
const toOpenApi = require('../../../lib/compile');
const cds = require('@sap/cds')
const assert = require('assert');
const test = require('node:test');
const { assertMatchObject } = require('../../util')

const someOpenApi = { openapi: '3.0.2', info: {}, servers: [{}], tags: [{}], paths: {}, components: {} }
const SCENARIO = Object.freeze({
  positive: 'positive',
  notAllowedAnnotations: 'notAllowed',
  notMatchingValues: 'notMatching',
  checkProperty: 'checkProperty'
})

function checkAnnotations(csn, annotations, scenario = SCENARIO.positive, property = '') {
  const openApi = toOpenApi(csn);
  const schemas = Object.entries(openApi.components.schemas).filter(([key]) => key.startsWith('sap.odm.test.A.E1'))
  // Test if the openAPI document was generated with some schemas.
  assert(openApi.components.schemas)
  assert(openApi)
  assert(schemas.length > 0)

  // Expect that not-allowed ODM annotations are unavailable in the schema.
  if (scenario === SCENARIO.notAllowedAnnotations) {
    for (const [, schema] of schemas) {
      for (const [annKey] of annotations) {
        assert.strictEqual(schema[annKey], undefined)
      }
    }
    return;
  }

  // Expect that even the ODM annotations with not-matched values will be derived.
  if (scenario === SCENARIO.notMatchingValues) {
    for (const [, schema] of schemas) {
      for (const [annKey, annValue] of annotations) {
        assert.strictEqual(schema[annKey], annValue)
      }
    }
    return;
  }

  if (scenario === SCENARIO.checkProperty) {
    for (const [, schema] of schemas) {
      const propertyObj = schema.properties[property]
      for (const [annKey, annValue] of annotations) {
        assert.strictEqual(propertyObj[annKey], annValue)
      }
    }
    return
  }

  for (const [, schema] of schemas) {
    for (const [annKey, annValue] of annotations) {
      assert.strictEqual(schema[annKey], annValue)
    }
  }

  // Test that no other places contain the ODM extensions in the OpenAPI document.

  // components.schemas where the schemas are not from entity E1.
  const notE1 = Object.entries(openApi.components.schemas).filter(([key]) => !key.startsWith('sap.odm.test.A.E1'))
  for (const [, schema] of notE1) {
    const schemaString = JSON.stringify(schema)
    for (const [annKey] of annotations) {
      assert(!schemaString.includes(annKey))
    }
  }

  // all other components of the OpenAPI document except the schemas.
  const openApiNoSchemas = JSON.stringify({ ...openApi, components: { parameters: { ...openApi.components.parameters }, responses: { ...openApi.components.responses } } })
  for (const [annKey] of annotations) {
    assert(!openApiNoSchemas.includes(annKey))
  }

}

test.describe('OpenAPI export', () => {
  let _precompile_edms
  test.before(() => {
    _precompile_edms = cds.env.features.precompile_edms
    cds.env.features.precompile_edms = false
  })
  test.after(() => {
    cds.env.features.precompile_edms = _precompile_edms
  })

  test('one service', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn);
    assertMatchObject(openapi, someOpenApi);
    // UUID elements are not required
    assert.strictEqual(openapi.components.schemas['A.E-create'].required, undefined);
  });

  test('one service, namespace', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn);
    assertMatchObject(openapi, someOpenApi);
  });

  test('one service, multiple protocols', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      @protocol: ['odata', 'rest']
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn);
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      assertMatchObject(content, someOpenApi);
      filesFound.add(metadata.file);
    }
    assert.deepStrictEqual(filesFound, new Set(['com.sap.A.odata', 'com.sap.A.rest']));
  });

  test('Check for tags object having any duplicate entries ', () => {
    const csn = cds.compile.to.csn(`
      namespace my.sample;
service CatalogService {

    @title: 'Auditable Fields'
    aspect Auditable {
        createdAt  : Timestamp;
        createdBy  : String;
        modifiedAt : Timestamp;
        modifiedBy : String;
    }
    entity Products : Auditable {
        key ID          : UUID;
            name        : String;
            description : String;
            price       : Decimal(10, 2);
    }
    entity Orders : Auditable {
        key ID          : UUID;
            orderDate   : Date;
            totalAmount : Decimal(10, 2);
            product     : Association to Products;
    }

}
    `);

    const openAPI = toOpenApi(csn);
    assert(openAPI);
    assert.strictEqual(openAPI.tags.length, 1);
  });

  test('multiple services', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    )
    assert.throws(() => toOpenApi(csn, { service: 'foo' }), /no service/si)

    let openapi = toOpenApi(csn, { service: 'A' });
    assertMatchObject(openapi, someOpenApi);

    openapi = toOpenApi(csn, { service: 'B' });
    assertMatchObject(openapi, someOpenApi);

    openapi = toOpenApi(csn, { service: 'all' });
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      assertMatchObject(content, someOpenApi);
      filesFound.add(metadata.file);
    }
    assert.deepStrictEqual(filesFound, new Set(['A', 'B']));
  });

  test('multiple services, namespace', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    )
    assert.throws(() => toOpenApi(csn, { service: 'foo' }), /no service/si)

    let openapi = toOpenApi(csn, { service: 'com.sap.A' });
    assertMatchObject(openapi, someOpenApi);

    openapi = toOpenApi(csn, { service: 'com.sap.B' });
    assertMatchObject(openapi, someOpenApi);

    openapi = toOpenApi(csn, { service: 'all' });
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      assertMatchObject(content, someOpenApi);
      filesFound.add(metadata.file);
    }
    assert.deepStrictEqual(filesFound, new Set(['com.sap.A', 'com.sap.B']));
  });

  test('multiple services, multiple protocols', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      @protocol: ['odata', 'rest']
      service A {entity E { key ID : UUID; };};
      @protocol: ['odata', 'rest']
      service B {entity F { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn, { service: 'all' });
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      assertMatchObject(content, someOpenApi);
      filesFound.add(metadata.file);
    }
    assert.deepStrictEqual(filesFound, new Set(['com.sap.A.odata', 'com.sap.A.rest', 'com.sap.B.odata', 'com.sap.B.rest']));
  });

  test('options: url', () => {
    const csn = cds.compile.to.csn(`
      @path:'/a' service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    );
    let openapi = toOpenApi(csn, { service: 'A' });
    assert.deepStrictEqual(openapi.servers, [{ url: '/a' }]);
    assert.strictEqual(openapi.info.description, "Use @Core.LongDescription: '...' or @Core.Description: '...' on your CDS service to provide a meaningful description.")

    openapi = toOpenApi(csn, { service: 'A', 'openapi:url': 'http://foo.bar:8080' });
    assert.deepStrictEqual(openapi.servers, [{ url: 'http://foo.bar:8080' }]);


    openapi = toOpenApi(csn, { service: 'A', 'openapi:url': 'http://foo.bar:8080//${service-path}/foo' });
    assert.deepStrictEqual(openapi.servers, [{ url: 'http://foo.bar:8080/a/foo' }]);

  });

  test('options: diagram', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    let openapi = toOpenApi(csn);
    assert(!/yuml.*diagram/i.test(openapi.info.description));

    openapi = toOpenApi(csn, { 'openapi:diagram': true });
    assert(/yuml.*diagram/i.test(openapi.info.description));
  });

  test('options: servers', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customerId}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customerId\": \"demo\",\n \"description\": \"Customer ID assigned by the service provider\"\n }\n}]"
    const openapi = toOpenApi(csn, { 'openapi:servers': serverObj })
    assert(openapi.servers);
  });

  test('options: odata-version check server URL', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn, { 'odata-version': '4.0' });
    assert(openapi.servers[0].url.includes('odata'));
  });

  test('options: Multiple servers', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customer1Id}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customer1Id\": \"demo\",\n \"description\": \"Customer1 ID assigned by the service provider\"\n }\n}, {\n \"url\": \"https://{customer2Id}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customer2Id\": \"demo\",\n \"description\": \"Customer2 ID assigned by the service provider\"\n }\n}]"
    const openapi = toOpenApi(csn, { 'openapi:servers': serverObj });
    assert(openapi.servers);
    assert(openapi.servers[0].url.includes('https://{customer1Id}.saas-app.com:{port}/v2'))
  });


  test('options: servers - wrong JSON', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customerId}.saas-app.com:{port}/v2\",\n \"variables\":\": \"Customer ID assigned by the service provider\"\n }\n}]"
    try {
      toOpenApi(csn, { 'openapi:servers': serverObj });
      assert.fail('Should have thrown');
    }
    catch (e) {
      assert.strictEqual(e.message, "The input server object is invalid.");
    }
  });

  test('options: config-file - without inline options', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn, { 'openapi:config-file': path.resolve(__dirname, "data/configFile.json") });
    assert(openapi.servers);
    assert.deepStrictEqual(openapi.servers, [{ url: 'http://foo.bar:8080' }, { url: "http://foo.bar:8080/a/foo" }]);
    assert(/yuml.*diagram/i.test(openapi.info.description));
    assert(openapi['x-odata-version'].includes('4.1'));
  });

  test('options: config-file - with inline options, inline options given precedence', () => {
    const csn = cds.compile.to.csn(`
       @title:'It is located at http://example.com:8080' service A {entity E { key ID : UUID;};};`
    );
    const options = {
      'openapi:config-file': path.resolve(__dirname, "data/configFile.json"),
      'openapi:url': "http://example.com:8080",
      'odata-version': '4.0',
      'openapi:diagram': "false"
    }
    const openapi = toOpenApi(csn, options);
    assert(openapi.info.title.includes('http://example.com:8080'))
    assert(!/yuml.*diagram/i.test(openapi.info.description));
    assert(openapi['x-odata-version'].includes('4.0'));
    assert.deepStrictEqual(openapi.servers, [{ url: 'http://foo.bar:8080' }, { url: "http://foo.bar:8080/a/foo" }]);
  });

  test('annotations: root entity property', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        @ODM.root: true
        entity E1 { key id: String(4); }
        entity E2 { key id: String(4); }
      }
    `)

    const openAPI = toOpenApi(csn)
    assert(openAPI)
    assertMatchObject(openAPI.components.schemas["sap.odm.test.A.E1"], { "x-sap-root-entity": true })
    assert.strictEqual(openAPI.components.schemas["sap.odm.test.A.E1-create"]["x-sap-root-entity"], undefined)
    assert.strictEqual(openAPI.components.schemas["sap.odm.test.A.E1-update"]["x-sap-root-entity"], undefined)
  });

  test('odm annotations: entity name and oid property', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        @ODM.entityName: 'sap.odm.test.E1'
        @ODM.oid: 'oid'
        entity E1 { key id: String(4); oid: String(128);}
        entity E2 { key id: String(4); }
      }
    `)
    checkAnnotations(
      csn,
      new Map([["x-sap-odm-entity-name", "sap.odm.test.E1"], ["x-sap-odm-oid", "oid"]]))
  })

  test('odm annotations: not valid names', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        @ODM.entityNameInvalid: 'sap.odm.test.E1'
        @ODM.oidInvalid: 'oid'
        entity E1 { key id: String(4); oid: String(128);}
        entity E2 { key id: String(4); }
      }
    `)

    checkAnnotations(
      csn,
      new Map([["x-sap-odm-entity-name-not-allowed", "sap.odm.test.E1"], ["x-sap-odm-oid-not-allowed", "oid"]]),
      SCENARIO.notAllowedAnnotations
    )
  })

  test('odm annotations: @ODM.oid value has no matching property', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        @ODM.oid: 'foo'
        entity E1 { key id: String(4); oid: String(128);}
        entity E2 { key id: String(4); }
      }
    `)

    checkAnnotations(
      csn,
      new Map([["x-sap-odm-oid", "foo"]]),
      SCENARIO.notMatchingValues
    )
  })

  test('odm annotations: @ODM.entityName value not matching the entity name', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        @ODM.entityName: 'sap.odm.test.bar'
        entity E1 { key id: String(4); oid: String(128);}
        entity E2 { key id: String(4); }
      }
    `)

    checkAnnotations(
      csn,
      new Map([["x-sap-odm-entity-name", "sap.odm.test.bar"]]),
      SCENARIO.notMatchingValues
    )
  })

  test('odm annotations: @ODM.oidReference.entityName annotation is added to the schema', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.odm.test;
      service A {
        entity E1 {
          key id: String(4);
          oid: String(128);
          @ODM.oidReference.entityName: 'ReferencedEntityName'
          ref: Association to one E2;
        }
        entity E2 { key id: String(4); }
      }
    `)

    checkAnnotations(
      csn,
      new Map([["x-sap-odm-oid-reference-entity-name", "ReferencedEntityName"]]),
      SCENARIO.checkProperty,
      'ref_id'
    )
  })

  test.describe('ER annotations', () => {
    test('er annotations is correct', () => {
      const csn = cds.compile.to.csn(`
        service A {
          @EntityRelationship.entityType: 'sap.vdm.sont:Material'
          @EntityRelationship.entityIds : [{propertyTypes: ['sap.vdm.gfn:MaterialId']}]
          @ODM.entityName               : 'Product'
          @ODM.oid                      : 'oid'
          entity Material {
                @EntityRelationship.propertyType: 'sap.vdm.gfn:MaterialId'
            key ObjectID      : String(18);

                @EntityRelationship.reference   : {
                  referencedEntityType  : 'sap.vdm.sont:BusinessPartner',
                  referencedPropertyType: 'sap.vdm.gfn::BusinessPartnerNumber'
                }
                manufacturer  : String(40);

                @EntityRelationship.reference   : {
                  referencedEntityType  : 'sap.sm:PurchaseOrder',
                  referencedPropertyType: 'sap.sm:PurchaseOrderUUID'
                }
                @ODM.oidReference.entityName    : 'PurchaseOrder'
                PurchaseOrder : UUID;

                @EntityRelationship.reference   : {
                  referencedEntityType  : 'sap.vdm.sont:BillOfMaterial',
                  referencedPropertyType: 'sap.vdm.gfn:BillOfMaterialId'
                }
                BOM           : String(30);
          }
        }
      `)
      const openAPI = toOpenApi(csn);
      assert(openAPI);
      const materialSchema = openAPI.components.schemas["A.Material"];
      assert(materialSchema);
      assert.strictEqual(materialSchema["x-entity-relationship-entity-type"], 'sap.vdm.sont:Material');
      assert.deepStrictEqual(materialSchema["x-entity-relationship-entity-ids"], [{ "propertyTypes": ["sap.vdm.gfn:MaterialId"] }]);
      assert.strictEqual(materialSchema["x-sap-odm-entity-name"], 'Product');
      assert.strictEqual(materialSchema["x-sap-odm-oid"], 'oid');

      const properties = materialSchema.properties;
      assert(properties);
      assert.deepStrictEqual(properties.ObjectID, {
        maxLength: 18,
        type: 'string',
        "x-entity-relationship-property-type": 'sap.vdm.gfn:MaterialId'
      });
      assert.deepStrictEqual(properties.manufacturer, {
        maxLength: 40,
        nullable: true,
        type: 'string',
        "x-entity-relationship-reference": {
          referencedEntityType: 'sap.vdm.sont:BusinessPartner',
          referencedPropertyType: 'sap.vdm.gfn::BusinessPartnerNumber'
        }
      });
      assert.deepStrictEqual(properties.PurchaseOrder, {
        example: '01234567-89ab-cdef-0123-456789abcdef',
        format: 'uuid',
        nullable: true,
        type: 'string',
        "x-entity-relationship-reference": {
          referencedEntityType: 'sap.sm:PurchaseOrder',
          referencedPropertyType: 'sap.sm:PurchaseOrderUUID'
        },
        "x-sap-odm-oid-reference-entity-name": 'PurchaseOrder'
      });
      assert.deepStrictEqual(properties.BOM, {
        maxLength: 30,
        nullable: true,
        type: 'string',
        "x-entity-relationship-reference": {
          referencedEntityType: 'sap.vdm.sont:BillOfMaterial',
          referencedPropertyType: 'sap.vdm.gfn:BillOfMaterialId'
        }
      });
    })
  });

  test('OpenAPI annotations: @OpenAPI.externalDocs annotation is added to the schema', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.OpenAPI.test;
      @OpenAPI.externalDocs: {
        description: 'API Guide',
        url: 'https://help.sap.com/docs/product/123.html'
      }
      service A {
        entity E1 {
          key id: String(4);
          oid: String(128);
        }
          }`);
    const openAPI = toOpenApi(csn);
    assert(openAPI.externalDocs);
    assert.strictEqual(openAPI.externalDocs.description, 'API Guide');
    assert.strictEqual(openAPI.externalDocs.url, 'https://help.sap.com/docs/product/123.html');
  }
  );

  test('OpenAPI annotations: @OpenAPI.Extensions annotation is added to the openapi document', () => {
    const csn = cds.compile.to.csn(`
      namespace sap.OpenAPI.test;
      @OpenAPI.Extensions: {
        ![compliance-level]: 'sap:base:v1',
        ![x-sap-ext-overview]: {
          name    : 'Communication Scenario',
          values: {
            text   : 'Planning Calendar API Integration',
            format: 'plain'
    }
  }
    }
      service A {
      @OpenAPI.Extensions: {
        ![dpp-is-potentially-sensitive]: 'true'
      }
        entity E1 {
          key id: String(4);
          oid: String(128);
        }

        @OpenAPI.Extensions: {
        ![x-sap-operation-intent]: 'read-collection for function',
        ![sap-deprecated-operation] : {
          deprecationDate: '2022-12-31',
          successorOperationId: 'successorOperation',
          notValidKey: 'notValidValue'
        }
      }
        function F1(param: String) returns String;

        @OpenAPI.Extensions: {
        ![x-sap-operation-intent]: 'read-collection for action'
    }
        action A1(param: String) returns String;

          }`);
    const openAPI = toOpenApi(csn);
    assert(openAPI);
    assert.strictEqual(openAPI['x-sap-compliance-level'], 'sap:base:v1');
    assert.strictEqual(openAPI['x-sap-ext-overview'].name, 'Communication Scenario');
    assert.strictEqual(openAPI['x-sap-ext-overview'].values.text, 'Planning Calendar API Integration');
    assert.strictEqual(openAPI['x-sap-ext-overview'].values.format, 'plain');
    assert.strictEqual(openAPI.components.schemas["sap.OpenAPI.test.A.E1"]["x-sap-dpp-is-potentially-sensitive"], 'true');
    assert.strictEqual(openAPI.paths["/F1"].get["x-sap-operation-intent"], 'read-collection for function');
    assert.strictEqual(openAPI.paths["/A1"].post["x-sap-operation-intent"], 'read-collection for action');
    assert.strictEqual(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].deprecationDate, '2022-12-31');
    assert.strictEqual(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].successorOperationId, 'successorOperation');
    assert.strictEqual(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].notValidKey, undefined);
  });

  test('emits cds.compile.to.openapi event', async () => {
    const csn = cds.compile.to.csn(`
      service CatalogService {
        entity Books {
          key ID : Integer;
          title  : String;
        }
      }`);

    let eventData;
    const handler = (data) => {
      eventData = data;
    };

    cds.on('compile.to.openapi', handler);

    try {
      const result = toOpenApi(csn);

      assert(eventData, 'Event was not emitted');
      assert.strictEqual(eventData.csn, csn, 'Event should include original CSN');
      assert.strictEqual(eventData.result, result, 'Event should include compilation result');
      assert(eventData.options, 'Event should include options');
      assert.strictEqual(typeof eventData.options, 'object', 'Options should be an object');
    } finally {
      cds.removeListener('compile.to.openapi', handler);
    }
  });

  test('allows modifying result in event handler', async () => {
    const csn = cds.compile.to.csn(`
      service CatalogService {
        entity Books {
          key ID : Integer;
          title  : String;
        }
      }`);

    const handler = ({ result }) => {
      result['x-custom-property'] = 'modified-by-handler';
    };

    cds.on('compile.to.openapi', handler);

    try {
      const result = toOpenApi(csn);

      assert.strictEqual(result['x-custom-property'], 'modified-by-handler',
        'Event handler should be able to modify the result');
    } finally {
      cds.removeListener('compile.to.openapi', handler);
    }
  });

  test('propagates errors from event handlers', async () => {
    const csn = cds.compile.to.csn(`
      service CatalogService {
        entity Books {
          key ID : Integer;
          title  : String;
        }
      }`);

    const handler = () => {
      throw new Error('Handler error');
    };

    cds.on('compile.to.openapi', handler);

    try {
      assert.throws(
        () => toOpenApi(csn),
        /Event handler error in compile\.to\.openapi.*Handler error/,
        'Should propagate event handler errors with context'
      );
    } finally {
      cds.removeListener('compile.to.openapi', handler);
    }
  });
});
