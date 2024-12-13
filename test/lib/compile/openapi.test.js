const { path } = require('@sap/cds/lib/utils/cds-utils');
const toOpenApi = require('../../../lib/compile');
const cds = require('@sap/cds')

const someOpenApi = { openapi: '3.0.2', info: {}, servers: [{}], tags: [{}], paths: {}, components: {} }
const SCENARIO = Object.freeze({
  positive: 'positive',
  notAllowedAnnotations: 'notAllowed',
  notMatchingValues: 'notMatching',
  checkProperty: 'checkProperty'
})

function checkAnnotations(csn, annotations, scenario = SCENARIO.positive, property = '') {
  const openApi = toOpenApi(csn)
  const schemas = Object.entries(openApi.components.schemas).filter(([key]) => key.startsWith('sap.odm.test.A.E1'))

  // Test if the openAPI document was generated with some schemas.
  expect(openApi).toBeDefined()
  expect(openApi.components.schemas).toBeDefined()
  expect(schemas.length > 0).toBeTruthy()

  // Expect that not-allowed ODM annotations are unavailable in the schema.
  if (scenario === SCENARIO.notAllowedAnnotations) {
    for (const [, schema] of schemas) {
      for (const [annKey] of annotations) {
        expect(schema[annKey]).not.toBeDefined()
      }
    }
    return;
  }

  // Expect that even the ODM annotations with not-matched values will be derived.
  if (scenario === SCENARIO.notMatchingValues) {
    for (const [, schema] of schemas) {
      for (const [annKey, annValue] of annotations) {
        expect(schema[annKey]).toBe(annValue)
      }
    }
    return;
  }

  if (scenario === SCENARIO.checkProperty) {
    for (const [, schema] of schemas) {
      const propertyObj = schema.properties[property]
      for (const [annKey, annValue] of annotations) {
        expect(propertyObj[annKey]).toBe(annValue)
      }
    }
    return
  }

  for (const [, schema] of schemas) {
    for (const [annKey, annValue] of annotations) {
      expect(schema[annKey]).toBe(annValue)
    }
  }

  // Test that no other places contain the ODM extensions in the OpenAPI document.

  // components.schemas where the schemas are not from entity E1.
  const notE1 = Object.entries(openApi.components.schemas).filter(([key]) => !key.startsWith('sap.odm.test.A.E1'))
  for (const [, schema] of notE1) {
    const schemaString = JSON.stringify(schema)
    for (const [annKey] of annotations) {
      expect(schemaString).not.toContain(annKey)
    }
  }

  // all other components of the OpenAPI document except the schemas.
  const openApiNoSchemas = JSON.stringify({ ...openApi, components: { parameters: { ...openApi.components.parameters }, responses: { ...openApi.components.responses } } })
  for (const [annKey] of annotations) {
    expect(openApiNoSchemas).not.toContain(annKey)
  }
}

describe('OpenAPI export', () => {
  let _precompile_edms
  beforeAll(() => {
    _precompile_edms = cds.env.features.precompile_edms
    cds.env.features.precompile_edms = false
  })
  afterAll(() => {
    cds.env.features.precompile_edms = _precompile_edms
  })

  test('one service', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn);
    expect(openapi).toMatchObject(someOpenApi);
    // UUID elements are not required
    expect(openapi.components.schemas['A.E-create']).not.toHaveProperty('required');
  });

  test('one service, namespace', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn);
    expect(openapi).toMatchObject(someOpenApi);
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
      expect(content).toMatchObject(someOpenApi);
      filesFound.add(metadata.file);
    }
    expect(filesFound).toMatchObject(new Set(['.odata', '.rest']));
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
    expect(openAPI).toBeDefined();
    expect(openAPI.tags.length).toBe(1);
  });

  test('multiple services', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    )
    expect(() => toOpenApi(csn, { service: 'foo' })).toThrowError(/no service/si)

    let openapi = toOpenApi(csn, { service: 'A' });
    expect(openapi).toMatchObject(someOpenApi);

    openapi = toOpenApi(csn, { service: 'B' });
    expect(openapi).toMatchObject(someOpenApi);

    openapi = toOpenApi(csn, { service: 'all' });
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      expect(content).toMatchObject(someOpenApi);
      filesFound.add(metadata.file);
    }
    expect(filesFound).toMatchObject(new Set(['A', 'B']));
  });

  test('multiple services, namespace', () => {
    const csn = cds.compile.to.csn(`
      namespace com.sap;
      service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    )
    expect(() => toOpenApi(csn, { service: 'foo' })).toThrowError(/no service/si)

    let openapi = toOpenApi(csn, { service: 'com.sap.A' });
    expect(openapi).toMatchObject(someOpenApi);

    openapi = toOpenApi(csn, { service: 'com.sap.B' });
    expect(openapi).toMatchObject(someOpenApi);

    openapi = toOpenApi(csn, { service: 'all' });
    const filesFound = new Set();
    for (const [content, metadata] of openapi) {
      expect(content).toMatchObject(someOpenApi);
      filesFound.add(metadata.file);
    }
    expect(filesFound).toMatchObject(new Set(['com.sap.A', 'com.sap.B']));
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
      expect(content).toMatchObject(someOpenApi);
      filesFound.add(metadata.file);
    }
    expect(filesFound).toMatchObject(new Set(['com.sap.A.odata', 'com.sap.A.rest', 'com.sap.B.odata', 'com.sap.B.rest']));
  });

  test('options: url', () => {
    const csn = cds.compile.to.csn(`
      @path:'/a' service A {entity E { key ID : UUID; };};
      service B {entity F { key ID : UUID; };};`
    );
    let openapi = toOpenApi(csn, { service: 'A' });
    expect(openapi).toMatchObject({ servers: [{ url: '/a' }] });
    expect(openapi.info.description).toBe("Use @Core.LongDescription: '...' on your CDS service to provide a meaningful description.")

    openapi = toOpenApi(csn, { service: 'A', 'openapi:url': 'http://foo.bar:8080' });
    expect(openapi).toMatchObject({ servers: [{ url: 'http://foo.bar:8080' }] });

    openapi = toOpenApi(csn, { service: 'A', 'openapi:url': 'http://foo.bar:8080//${service-path}/foo' });
    expect(openapi).toMatchObject({ servers: [{ url: 'http://foo.bar:8080/a/foo' }] });
  });

  test('options: diagram', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    let openapi = toOpenApi(csn);
    expect(openapi.info.description).not.toMatch(/yuml.*diagram/i)
    openapi = toOpenApi(csn, { 'openapi:diagram': true });
    expect(openapi.info.description).toMatch(/yuml.*diagram/i)
  });

  test('options: servers', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customerId}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customerId\": \"demo\",\n \"description\": \"Customer ID assigned by the service provider\"\n }\n}]"
    const openapi = toOpenApi(csn, { 'openapi:servers': serverObj });
    expect(openapi.servers).toBeTruthy();
  });

  test('options: odata-version check server URL', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn, { 'odata-version': '4.0' });
    expect(openapi.servers[0].url).toMatch('odata');
  });

  test('options: Multiple servers', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customer1Id}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customer1Id\": \"demo\",\n \"description\": \"Customer1 ID assigned by the service provider\"\n }\n}, {\n \"url\": \"https://{customer2Id}.saas-app.com:{port}/v2\",\n \"variables\": {\n \"customer2Id\": \"demo\",\n \"description\": \"Customer2 ID assigned by the service provider\"\n }\n}]"
    const openapi = toOpenApi(csn, { 'openapi:servers': serverObj });
    expect(openapi.servers).toBeTruthy();
    expect(openapi.servers[0].url).toMatch('https://{customer1Id}.saas-app.com:{port}/v2')
  });


  test('options: servers - wrong JSON', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const serverObj = "[{\n \"url\": \"https://{customerId}.saas-app.com:{port}/v2\",\n \"variables\":\": \"Customer ID assigned by the service provider\"\n }\n}]"
    try {
      toOpenApi(csn, { 'openapi:servers': serverObj });
    }
    catch (e) {
      expect(e.message).toBe("The input server object is invalid.");
    }
  });

  test('options: config-file - without inline options', () => {
    const csn = cds.compile.to.csn(`
      service A {entity E { key ID : UUID; };};`
    );
    const openapi = toOpenApi(csn, { 'openapi:config-file': path.resolve("./test/lib/compile/data/configFile.json") });
    expect(openapi.servers).toBeTruthy();
    expect(openapi).toMatchObject({ servers: [{ url: 'http://foo.bar:8080' }, { url: "http://foo.bar:8080/a/foo" }] });
    expect(openapi.info.description).toMatch(/yuml.*diagram/i); 
    expect(openapi['x-odata-version']).toMatch('4.1');
  });

  test('options: config-file - with inline options, inline options given precedence', () => {
    const csn = cds.compile.to.csn(`
       @title:'It is located at http://example.com:8080' service A {entity E { key ID : UUID;};};`
    );
    const options = {
      'openapi:config-file': path.resolve("./test/lib/compile/data/configFile.json"),
      'openapi:url': "http://example.com:8080",
      'odata-version': '4.0',
      'openapi:diagram': "false"
    }
    const openapi = toOpenApi(csn, options);
    expect(openapi.info.title).toMatch(/http:\/\/example.com:8080/i)
    expect(openapi.info.description).not.toMatch(/yuml.*diagram/i);
    expect(openapi['x-odata-version']).toMatch('4.0');
    expect(openapi).toMatchObject({ servers: [{ url: 'http://foo.bar:8080' }, { url: "http://foo.bar:8080/a/foo" }] });
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
    expect(openAPI).toBeDefined()
    expect(openAPI.components.schemas["sap.odm.test.A.E1"]).toMatchObject({ "x-sap-root-entity": true })
    expect(openAPI.components.schemas["sap.odm.test.A.E1-create"]["x-sap-root-entity"]).toBeUndefined()
    expect(openAPI.components.schemas["sap.odm.test.A.E1-update"]["x-sap-root-entity"]).toBeUndefined()
  })

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
        expect(openAPI.externalDocs).toBeDefined();
        expect(openAPI.externalDocs.description).toBe('API Guide');
        expect(openAPI.externalDocs.url).toBe('https://help.sap.com/docs/product/123.html');
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
    expect(openAPI).toBeDefined();
    expect(openAPI['x-sap-compliance-level']).toBe('sap:base:v1');
    expect(openAPI['x-sap-ext-overview'].name).toBe('Communication Scenario');
    expect(openAPI['x-sap-ext-overview'].values.text).toBe('Planning Calendar API Integration');
    expect(openAPI['x-sap-ext-overview'].values.format).toBe('plain');
    expect(openAPI.components.schemas["sap.OpenAPI.test.A.E1"]["x-sap-dpp-is-potentially-sensitive"]).toBe('true');
    expect(openAPI.paths["/F1"].get["x-sap-operation-intent"]).toBe('read-collection for function');
    expect(openAPI.paths["/A1"].post["x-sap-operation-intent"]).toBe('read-collection for action');
    expect(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].deprecationDate).toBe('2022-12-31');
    expect(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].successorOperationId).toBe('successorOperation');
    expect(openAPI.paths["/F1"].get["x-sap-deprecated-operation"].notValidKey).toBeUndefined();
  });
});
