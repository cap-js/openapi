const assert = require('assert');

//TODO:
// title/description on action/function (import), with fallback from import to action/function
// title/description on action/function return type
// title/description on path parameters for keys
// title/description on entity types for POST and PATCH request bodies
// tags: Core.Description on entity type as fallback for description on entity set/singleton
// Nullable on action/function return type
// @Core.Example
// reference undefined type: silent for included schema, warning for local schema
// key-aliases: one and more segments
// navigation properties inherited from base type A.n1 -> B.n2 -> C.n3
// collection-navigation to entity type without key or unknown entity type: suppress path item with key segment
// remaining Edm types, especially Geo* - see odata-definitions.json
// (external) annotations on actions, functions, parameters, returntype
// control mapping of reference URLs

const lib = require('../../../lib/compile/csdl2openapi.js');

const example1 = require('./data/csdl-16.1.json');
const result1 = require('./data/csdl-16.1.openapi3.json');

const example2 = require('./data/TripPin.json');
const result2 = require('./data/TripPin.openapi3.json');

const example5 = require('./data/annotations.json');
const result5 = require('./data/annotations.openapi3.json');

const example6 = require('./data/containment.json');
const result6 = require('./data/containment.openapi3.json');

const example7 = require('./data/authorization.json');
const result7 = require('./data/authorization.openapi3.json');

const example8 = require('./data/descriptions.json');
const result8 = require('./data/descriptions.openapi3.json');

const example9 = require('./data/custom-parameters.json');
const result9 = require('./data/custom-parameters.openapi3.json');

describe('Examples', function () {

    it('csdl-16.1', function () {
        const openapi = lib.csdl2openapi(example1, { diagram: true });
        check(openapi, result1);
    })

    it('TripPin', function () {
        const openapi = lib.csdl2openapi(example2, {
            host: 'services.odata.org',
            basePath: '/V4/(S(cnbm44wtbc1v5bgrlek5lpcc))/TripPinServiceRW',
            diagram: true
        });
        check(openapi, result2);
    })

    it('annotations', function () {
        const openapi = lib.csdl2openapi(example5, { diagram: true });
        check(openapi, result5);
    })

    it('containment', function () {
        const openapi = lib.csdl2openapi(example6, { diagram: true });
        check(openapi, result6);
    })

    it('authorization', function () {
        const openapi = lib.csdl2openapi(example7, { diagram: true });
        check(openapi, result7);
    })

    it('descriptions', function () {
        const openapi = lib.csdl2openapi(example8, { diagram: true });
        check(openapi, result8);
    })

    it('custom-parameters', function () {
        const openapi = lib.csdl2openapi(example9, { diagram: true });
        check(openapi, result9);
    });

})

describe('Edge cases', function () {

    it('empty input', function () {
        const csdl = {};
        const expected = {
            openapi: '3.0.2',
            info: {
                title: "Use @title: '...' on your CDS service to provide a meaningful title.",
                description: '',
                version: ''
            },
            paths: {},
            'x-odata-version': '4.01', 
            'x-sap-api-type': 'ODATAV4', 
            'x-sap-shortText': "Use @Core.Description: '...' on your CDS service to provide a meaningful short text.",
            components: { schemas: {} }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    })

    it('omit unused types', function () {
        const csdl = {
            $Reference: { dummy: { '$Include': [{ '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' }] } },
            ReuseTypes: {
                entityType: {
                    $Kind: 'EntityType',
                    $Key: ['key'],
                    key: {},
                    val: { $Type: 'ReuseTypes.typeDefinition' },
                },
                typeDefinition: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.DateTimeOffset' },
                typeDefinition3: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.DateTimeOffset', $Precision: 3 }
            }
        };
        const expected = {
            openapi: '3.0.2',
            info: {
                title: "Use @title: '...' on your CDS service to provide a meaningful title.",
                description: '',
                version: ''
            },
            paths: {},
            'x-odata-version': '4.01', 
            'x-sap-api-type': 'ODATAV4', 
            'x-sap-shortText': "Use @Core.Description: '...' on your CDS service to provide a meaningful short text.",
            components: {
                schemas: {},
            }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    });

    it('omit unused types with cyclic references', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    $Include: [{ $Namespace: 'Org.OData.Core.V1', $Alias: 'Core' }],
                },
            },
            ReuseTypes: {
                entityType: {
                    '@Core.Description': 'Core.Description',
                    $Kind: 'EntityType',
                    $Key: ['key'],
                    key: {},
                    nav: { $Kind: 'NavigationProperty', $Type: 'ReuseTypes.otherType' },
                },
                otherType: {
                    '@Core.Description': 'Core.Description',
                    $Kind: 'EntityType',
                    $Key: ['key'],
                    key: {},
                    nav: { $Kind: 'NavigationProperty', $Type: 'ReuseTypes.entityType' },
                },
            },
        };
        const expected = {
            openapi: "3.0.2",
            info: {
                title: "Use @title: '...' on your CDS service to provide a meaningful title.",
                description: "",
                version: "",
            },
            "x-odata-version": "4.01",
            "x-sap-api-type": "ODATAV4",
            "x-sap-shortText": "Use @Core.Description: '...' on your CDS service to provide a meaningful short text.",
            paths: {},
            components: {
                schemas: {},
            },
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi, expected, 'Empty CSDL document');
    });

    it('InsertRestrictions, UpdateRestrictions, ReadRestrictions', function () {
        //TODO: restrictions
        const csdl = {
            $Version: "4.01",
            $Reference: {
                dummy: {
                    $Include: [
                        { $Namespace: "Org.OData.Core.V1", $Alias: "Core" },
                        { $Namespace: "Org.OData.Capabilities.V1", $Alias: "Capabilities" },
                    ],
                },
            },
            $EntityContainer: "this.Container",
            this: {
                noInsert: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                    nav: {
                        $Type: "this.noInsertPart",
                        $Kind: "NavigationProperty",
                        $ContainsTarget: true,
                    },
                },
                noInsertPart: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                },
                noUpdate: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                    nav: {
                        $Type: "this.noUpdatePart",
                        $Kind: "NavigationProperty",
                        $ContainsTarget: true,
                    },
                },
                noUpdatetPart: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                },
                noRead: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                    nav: {
                        $Type: "this.noReadPart",
                        $Kind: "NavigationProperty",
                        $ContainsTarget: true,
                    },
                },
                noReadPart: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                },
                nothing: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                    navOne: {
                        $Type: "this.nothingPart",
                        $Kind: "NavigationProperty",
                        $ContainsTarget: true,
                    },
                    navMany: {
                        $Type: "this.nothingPart",
                        $Kind: "NavigationProperty",
                        $ContainsTarget: true,
                        $Collection: true,
                    },
                },
                nothingPart: {
                    $Kind: "EntityType",
                    $Key: ["key"],
                    key: {},
                },
                Container: {
                    noInsert: {
                        $Type: "this.noInsert",
                        $Collection: true,
                        "@Capabilities.InsertRestrictions": {
                            Insertable: false,
                        },
                    },
                    noUpdate: {
                        $Type: "this.noUpdate",
                        $Collection: true,
                        "@Capabilities.UpdateRestrictions": {
                            Updatable: false,
                        },
                    },
                    noRead: {
                        $Type: "this.noRead",
                        $Collection: true,
                        "@Capabilities.InsertRestrictions": {
                            Insertable: false,
                        },
                        "@Capabilities.ReadRestrictions": {
                            Readable: false,
                        },
                    },
                    nothing: {
                        $Type: "this.nothing",
                        $Collection: true,
                        "@Capabilities.InsertRestrictions": {
                            Insertable: false,
                        },
                        "@Capabilities.ReadRestrictions": {
                            Readable: false,
                        },
                        "@Capabilities.UpdateRestrictions": {
                            Updatable: false,
                        },
                        "@Capabilities.DeleteRestrictions": {
                            Deletable: false,
                        },
                        "@Capabilities.NavigationRestrictions": {
                            RestrictedProperties: [
                                {
                                    NavigationProperty: "navMany",
                                    InsertRestrictions: { Insertable: false },
                                    ReadRestrictions: { Readable: false },
                                    UpdateRestrictions: { Updatable: false },
                                    DeleteRestrictions: { Deletable: false },
                                },
                                {
                                    NavigationProperty: "navOne",
                                    ReadRestrictions: { Readable: false },
                                    UpdateRestrictions: { Updatable: false },
                                },
                            ],
                        },
                    },
                },
            },
        };
        const expected = {
            paths: {
                "/noInsert": {
                    get: {},
                },
                "/noInsert('{key}')": {
                    get: {},
                    patch: {},
                    delete: {},
                },
                "/noInsert('{key}')/nav": {
                    get: {},
                    patch: {},
                },
                "/noUpdate": {
                    get: {},
                    post: {},
                },
                "/noUpdate('{key}')": {
                    get: {},
                    delete: {},
                },
                "/noUpdate('{key}')/nav": {
                    get: {},
                    patch: {},
                },
                "/noRead('{key}')": {
                    patch: {},
                    delete: {},
                },
                "/noRead('{key}')/nav": {
                    get: {},
                    patch: {},
                },
                "/$batch": { post: {} },
            },
            components: {
                schemas: {
                    "this.noInsert": {},
                    "this.noInsert-update": {},
                    "this.noInsertPart": {},
                    "this.noInsertPart-create": {},
                    "this.noInsertPart-update": {},
                    "this.noRead-update": {},
                    "this.noReadPart": {},
                    "this.noReadPart-create": {},
                    "this.noReadPart-update": {},
                    "this.noUpdate": {},
                    "this.noUpdate-create": {},
                },
            },
        };
        const actual = lib.csdl2openapi(csdl, {});
        console.dir(actual.paths["/nothing"]);
        console.dir(actual.paths["/nothing('{key}')"]);
        assert.deepStrictEqual(paths(actual), paths(expected), "Paths");
        assert.deepStrictEqual(
            operations(actual),
            operations(expected),
            "Operations"
        );
        assert.deepStrictEqual(schemas(actual), schemas(expected), "Schemas");
        //TODO: check components.schemas
    });


    it('circular reference on collect primitive paths', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                source: {
                    $Kind: 'EntityType',
                    $Key: ['s_id'],
                    s_id: {},
                    complex1: { $Type: 'this.complex1' },
                    complex2: { $Type: 'this.complex2' },
                },
                complex1: {
                    $Kind: 'ComplexType',
                    beforeComplex2: {},
                    complex2: { $Type: 'this.complex2' },
                    afterComplex2: {}
                },
                complex2: {
                    $Kind: 'ComplexType',
                    beforeComplex1: {},
                    complex1: { $Type: 'this.complex1' },
                    afterComplex1: {}
                },
                Container: {
                    sources: { $Type: 'this.source', $Collection: true },
                }
            }
        };

        const expected_sources_get_param = {
            description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
            explode: false,
            in: 'query',
            name: '$orderby',
            schema: {
                items: {
                    enum: [
                        's_id',
                        's_id desc',
                        'complex1/beforeComplex2',
                        'complex1/beforeComplex2 desc',
                        'complex1/complex2/beforeComplex1',
                        'complex1/complex2/beforeComplex1 desc',
                        'complex1/complex2/afterComplex1',
                        'complex1/complex2/afterComplex1 desc',
                        'complex1/afterComplex2',
                        'complex1/afterComplex2 desc',
                        'complex2/beforeComplex1',
                        'complex2/beforeComplex1 desc',
                        'complex2/complex1/beforeComplex2',
                        'complex2/complex1/beforeComplex2 desc',
                        'complex2/complex1/afterComplex2',
                        'complex2/complex1/afterComplex2 desc',
                        'complex2/afterComplex1',
                        'complex2/afterComplex1 desc'
                    ],
                    type: 'string'
                },
                type: 'array',
                uniqueItems: true
            }
        }

        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(openapi.paths['/sources'].get.parameters[5], expected_sources_get_param);
    })

    it('type definition with @JSON.Schema', function () {
        const csdl = {
            $EntityContainer: 'jsonExamples.Container',
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' },
                        { '$Namespace': 'Org.OData.JSON.V1', '$Alias': 'JSON' }
                    ]
                }
            },
            jsonExamples: {
                Container: {
                    single: { $Type: 'jsonExamples.single' },
                },
                single: {
                    $Kind: 'EntityType',
                    stream1: { $Type: 'jsonExamples.typeDefinitionOld' },
                    stream2: { $Type: 'jsonExamples.typeDefinitionNew', $MaxLength: 10 },
                },
                typeDefinitionOld: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@JSON.Schema": "{\"type\":\"object\",\"additionalProperties\":false,\"patternProperties\":{\"^[\\\\w\\\\.\\\\-\\\\/]+$\":{\"type\":\"string\"}}}"
                },
                typeDefinitionNew: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@JSON.Schema": {
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: { "^[\\w\\.\\-\\/]+$": { type: 'string' } }
                    }
                }
            }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(
          openapi.components.schemas["jsonExamples.typeDefinitionOld"],
          {
            title: "typeDefinitionOld",
            type: "object",
            additionalProperties: false,
            patternProperties: {
              "^[\\w\\.\\-\\/]+$": { type: "string" },
            },
          },
          "JSON property old-style"
        );
        assert.deepStrictEqual(
          openapi.components.schemas["jsonExamples.typeDefinitionNew"],
          {
            title: "typeDefinitionNew",
            type: "object",
            additionalProperties: false,
            patternProperties: {
              "^[\\w\\.\\-\\/]+$": { type: "string" },
            },
          },
          "JSON property new-style"
        );
        assert.deepStrictEqual(
          openapi.components.schemas["jsonExamples.single"].properties.stream2,
          {
            maxLength: 10,
            allOf: [
              { $ref: "#/components/schemas/jsonExamples.typeDefinitionNew" },
            ],
          },
          "MaxLength"
        );
    })

    it('type definition with @Org.OData.JSON.V1.Schema', function () {
        const csdl = {
            $EntityContainer: "jsonExamples.Container",
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1' },
                        { '$Namespace': 'Org.OData.JSON.V1' }
                    ]
                }
            },
            jsonExamples: {
                Container: {
                    single: { $Type: "jsonExamples.single" },
                },
                single: {
                    $Kind: "EntityType",
                    stream1: { $Type: "jsonExamples.typeDefinitionOld" },
                    stream2: { $Type: "jsonExamples.typeDefinitionNew" },
                },
                typeDefinitionOld: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@Org.OData.JSON.V1.Schema": "{\"type\":\"object\",\"additionalProperties\":false,\"patternProperties\":{\"^[\\\\w\\\\.\\\\-\\\\/]+$\":{\"type\":\"string\"}}}"
                },
                typeDefinitionNew: {
                    $Kind: 'TypeDefinition',
                    $UnderlyingType: 'Edm.Stream',
                    "@Org.OData.JSON.V1.Schema": {
                        type: 'object',
                        additionalProperties: false,
                        patternProperties: { "^[\\w\\.\\-\\/]+$": { type: 'string' } }
                    }
                }
            }
        };
        const openapi = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(
            openapi.components.schemas["jsonExamples.typeDefinitionOld"],
            {
              title: "typeDefinitionOld",
              type: "object",
              additionalProperties: false,
              patternProperties: {
                "^[\\w\\.\\-\\/]+$": { type: "string" },
              },
            },
            "JSON property old-style",
          );
          assert.deepStrictEqual(
            openapi.components.schemas["jsonExamples.typeDefinitionNew"],
            {
              title: "typeDefinitionNew",
              type: "object",
              additionalProperties: false,
              patternProperties: {
                "^[\\w\\.\\-\\/]+$": { type: "string" },
              },
            },
            "JSON property new-style",
          );
    })

    it('no key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                NoKey: { $Kind: 'EntityType' },
                Container: { Set: { $Collection: true, $Type: 'this.NoKey' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('base type not found', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('no inherited key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Base: { $Kind: 'EntityType' },
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('inherited key', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Base: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Derived: { $Kind: 'EntityType', $BaseType: 'this.Base' },
                Container: { Set: { $Collection: true, $Type: 'this.Derived' } }
            }
        };
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                "/Set('{key}')": { get: {}, patch: {}, delete: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it('key-as-segment', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' },
                        { '$Namespace': 'Org.OData.Capabilities.V1', '$Alias': 'Capabilities' }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                Type: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Type2: { $Kind: 'EntityType', $Key: ['key1', 'key2'], key1: {}, key2: {} },
                Container: {
                    '@Capabilities.BatchSupport': {
                        '@Core.Description': 'BatchSupport - Description',
                        '@Core.LongDescription': 'BatchSupport - LongDescription'
                    },
                    '@Capabilities.KeyAsSegmentSupported': true,
                    Set: { $Collection: true, $Type: 'this.Type' },
                    Set2: { $Collection: true, $Type: 'this.Type2' }
                }
            }
        }
        const expected = {
            paths: {
                '/Set': { get: {}, post: {} },
                '/Set/{key}': { get: {}, patch: {}, delete: {} },
                '/Set2': { get: {}, post: {} },
                '/Set2/{key1}/{key2}': { get: {}, patch: {}, delete: {} },
                '/$batch': { post: {} }
            }
        }
        const actual = lib.csdl2openapi(csdl);
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.strictEqual(actual.paths['/$batch'].post.summary, 'BatchSupport - Description', 'Batch summary');
        assert.strictEqual(actual.paths['/$batch'].post.description, 'BatchSupport - LongDescription\n\n*Please note that "Try it out" is not supported for this request.*', 'Batch description');
    })

    it('function without parameters', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                NoParameters: [{ $Kind: 'Function', $ReturnType: {} }],
                Container: { fun: { $Function: 'this.NoParameters' } }
            }
        };
        const expected = {
            paths: {
                '/fun': { get: {} },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    })

    it("function with complex and optional collection parameter", function () {
        const csdl = {
            $Reference: {
                dummy: {
                    '$Include': [
                        { '$Namespace': 'Org.OData.Core.V1', '$Alias': 'Core' },
                        { '$Namespace': 'com.sap.vocabularies.Common.v1', '$Alias': 'Common' }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                Complex: { $Kind: 'ComplexType', $OpenType: true },
                ComplexParameters: [{
                    $Kind: 'Function',
                    '@Common.Label': 'Custom Tag',
                    $Parameter: [
                        { $Name: 'complex', $Type: 'this.Complex', '@Core.Description': 'param description' },
                        { $Name: "collection", $Collection: true, },
                    ],
                    $ReturnType: {}
                }],
                OptionalParameter: [
                    {
                        $Kind: "Function",
                        $Parameter: [
                            {
                                $Name: "complex",
                                $Type: "this.Complex",
                                "@Core.OptionalParameter": {},
                            },
                        ],
                        $ReturnType: {},
                    },
                ],
                Container: {
                    funC: { $Function: "this.ComplexParameters" },
                    funO: { $Function: "this.OptionalParameter" },
                },
            }
        };
        const expected = {
            paths: {
                "/funO": {
                    get: {
                        parameters: [
                            {
                                name: "complex",
                                in: "query",
                                required: false,
                                schema: { type: "string" },
                                example: "{}",
                                description:
                                    "This is URL-encoded JSON of type this.Complex, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)",
                            },
                        ],
                    },
                },
                "/$batch": { post: {} },
            },
        };
        const path = "/funC";
        expected.paths[path] = {
            get: {
                tags: ['Custom Tag'],
                parameters: [
                    {
                        name: 'complex', in: 'query', required: true, schema: { type: 'string' },
                        example: '{}',
                        description: 'param description  \nThis is URL-encoded JSON of type this.Complex, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)'
                    },
                    {
                        name: 'collection', in: 'query', required: true, schema: { type: 'string' },
                        example: '[]',
                        description: 'This is a URL-encoded JSON array with items of type Edm.String, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)'
                    }
                ]
            }
        };
        const actual = lib.csdl2openapi(csdl, { diagram: true });
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths[path].get.parameters, expected.paths[path].get.parameters, 'complex function parameters');
        assert.deepStrictEqual(actual.paths["/funO"].get.parameters, expected.paths["/funO"].get.parameters, "optional function parameters");
        assert.deepStrictEqual(actual.paths[path].get.tags, expected.paths[path].get.tags, 'function tags');
    })

    it('return type with facets', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                fun: [
                    { $Kind: 'Function', $ReturnType: { $MaxLength: 20 } },
                    { $Kind: 'Function', $Parameter: [{ $Name: 'in' }], $ReturnType: { $Collection: true, $MaxLength: 20 } }
                ],
                Container: { fun: { $Function: 'this.fun' } }
            }
        };
        const expected = {
          paths: {
            "/fun()": {
              get: {
                summary: "Invokes function fun",
                tags: ["Service Operations"],
                parameters: [],
                responses: {
                  200: {
                    description: "Success",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          properties: {
                            value: {
                              type: "string",
                              maxLength: 20,
                            },
                          },
                        },
                      },
                    },
                  },
                  "4XX": {
                    $ref: "#/components/responses/error",
                  },
                },
              },
            },
            "/fun(in={in})": {
              get: {
                summary: "Invokes function fun",
                tags: ["Service Operations"],
                parameters: [
                  {
                    required: true,
                    in: "path",
                    name: "in",
                    description:
                      "String value needs to be enclosed in single quotes",
                    schema: {
                      type: "string",
                      pattern: "^'([^']|'')*'$",
                    },
                  },
                ],
                responses: {
                  200: {
                    description: "Success",
                    content: {
                      "application/json": {
                        schema: {
                          type: "object",
                          title: "Collection of String",
                          properties: {
                            "@odata.count": {
                              $ref: "#/components/schemas/count",
                            },
                            value: {
                              type: "array",
                              items: {
                                type: "string",
                                maxLength: 20,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  "4XX": {
                    $ref: "#/components/responses/error",
                  },
                },
              },
            },
            "/$batch": { post: {} },
          },
        };
        const actual = lib.csdl2openapi(csdl, {odataVersion: '4.0'});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(
            actual.paths['/fun()'].get.responses[200],
            expected.paths['/fun()'].get.responses[200], 'fun');
        assert.deepStrictEqual(
            actual.paths["/fun(in={in})"].get.responses[200],
            expected.paths["/fun(in={in})"].get.responses[200], 'fun(in)');
    })

    it('delta link, no $batch', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capa" }] } },
            $EntityContainer: 'this.Container',
            this: {
                ET: { $Kind: 'EntityType', $Key: ['key'], key: {} },
                Container: {
                    Set: {
                        $Type: 'this.ET', $Collection: true,
                        '@Capa.ChangeTracking': { Supported: true }
                    },
                    '@Capa.BatchSupported': false
                }
            }
        };
        const expected = {
            paths: {
                "/Set": {
                    get: {},
                    post: {}
                },
                "/Set('{key}')": { get: {}, patch: {}, delete: {} }
            }
        };
        const expectedGetResponseProperties = {
            '@count': {
                $ref: '#/components/schemas/count'
            },
            value: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/this.ET'
                    //TODO:delta
                }
            },
            "@odata.deltaLink": {
                example: "/service-root/Set?$deltatoken=opaque server-generated token for fetching the delta",
                type: "string"
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(
            actual.paths['/Set'].get.responses[200].content['application/json'].schema.properties,
            expectedGetResponseProperties, 'get list with delta');
    })

    it('entity set and singleton with non-existing type', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Container: {
                    things: { $Type: 'self.type_does_not_exist', $Collection: true },
                    single: { $Type: 'self.type_does_not_exist' }
                }
            }
        };
        const expected = {
            paths: {
                "/things": {
                    get: {
                        summary: 'Retrieves a list of things.',
                        tags: ['things'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            { $ref: "#/components/parameters/search"},
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: "Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)"
                            },
                            { $ref: "#/components/parameters/count" }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved things',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of type_does_not_exist',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: "#/components/schemas/undefined.type_does_not_exist"
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {
                        summary: 'Creates a single thing.',
                        tags: ['things'],
                        requestBody: {
                            description: 'New thing',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: "#/components/schemas/undefined.type_does_not_exist-create"
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: 'Created thing',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: "#/components/schemas/undefined.type_does_not_exist"
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/single": {
                    get: {
                        summary: 'Retrieves single.',
                        tags: ['single'],
                        parameters: [],
                        responses: {
                            200: {
                                description: 'Retrieved single',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: "#/components/schemas/undefined.type_does_not_exist"
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    patch: {
                        summary: 'Changes single.',
                        tags: ['single'],
                        requestBody: {
                            description: 'New property values',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: "#/components/schemas/undefined.type_does_not_exist-update"
                                    }
                                }
                            }
                        },
                        responses: {
                            204: {
                                description: 'Success'
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/$batch": { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/things'].get, expected.paths['/things'].get, 'GET set');
        assert.deepStrictEqual(actual.paths['/things'].post, expected.paths['/things'].post, 'POST set');
        assert.deepStrictEqual(actual.paths['/single'].get, expected.paths['/single'].get, 'GET single');
        assert.deepStrictEqual(actual.paths['/single'].patch, expected.paths['/single'].patch, 'PATCH single');
    })

    it('inheritance', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                base: {
                    $Kind: 'EntityType', $Abstract: true, baseProp: {},
                    baseNav: { $Kind: 'NavigationProperty', $Type: 'this.other', $ContainsTarget: true }
                },
                derived: {
                    $Kind: 'EntityType', $BaseType: 'this.base', $Key: ['key'], key: {}, derivedProp: {},
                    derivedNav: { $Kind: 'NavigationProperty', $Type: 'this.other' }
                },
                Container: {
                    set: { $Type: 'this.derived', $Collection: true }
                }
            }
        };
        const expected = {
            paths: {
                "/set": {
                    get: {
                        summary: 'Retrieves a list of set.',
                        tags: ['set'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            { $ref: "#/components/parameters/search"},
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: '$orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'baseProp',
                                            'baseProp desc',
                                            'key',
                                            'key desc',
                                            'derivedProp',
                                            'derivedProp desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'baseProp',
                                            'key',
                                            'derivedProp'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$expand',
                                description: 'The value of $expand query option is a comma-separated list of navigation property names, \
stream property names, or $value indicating the stream content of a media-entity. \
The corresponding related entities and stream values will be represented inline, \
see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'baseNav',
                                            'derivedNav'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved set',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of derived',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.derived'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {
                        summary: 'Adds new entity to set',
                        tags: ['set'],
                        requestBody: {
                            description: 'New entity',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/this.derived'
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: 'Created entity',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/set('{key}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/set('{key}')/baseNav": {
                    get: {},
                    patch: {}
                },
                "/set('{key}')/derivedNav": {
                    get: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/set'].get, expected.paths['/set'].get, 'GET set');
    })

    it('navigation property in complex type', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                source: {
                    $Kind: 'EntityType', $Key: ['s_id'], s_id: {}, complexProp: { $Type: 'this.complex', $Collection: true },
                },
                complex: {
                    $Kind: 'ComplexType',
                    primProp: {},
                    navProp: { $Kind: 'NavigationProperty', $Type: 'this.target', $Collection: true }
                },
                target: {
                    $Kind: 'EntityType', $BaseType: 'this.base', $Key: ['t_id'], t_id: {}
                },
                Container: {
                    sources: { $Type: 'this.source', $Collection: true },
                    targets: { $Type: 'this.target', $Collection: true }
                }
            }
        };
        const expected = {
            paths: {
                "/sources": {
                    get: {
                        summary: 'Retrieves a list of sources.',
                        tags: ['sources'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            { $ref: "#/components/parameters/search"},
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: '$orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            's_id',
                                            's_id desc',
                                            'complexProp/primProp',
                                            'complexProp/primProp desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            's_id',
                                            'complexProp'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$expand',
                                description: 'The value of $expand query option is a comma-separated list of navigation property names, \
stream property names, or $value indicating the stream content of a media-entity. \
The corresponding related entities and stream values will be represented inline, \
see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'complexProp/navProp'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved sources',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of source',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.source'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {
                        summary: 'Adds new entity to set',
                        tags: ['set'],
                        requestBody: {
                            description: 'New entity',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/this.derived'
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: 'Created entity',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/sources('{s_id}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/targets": {
                    get: {},
                    post: {}
                },
                "/targets('{t_id}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/sources'].get, expected.paths['/sources'].get, 'GET sources');
    })

    it('key aliases', function () {
        const csdl = {
            $EntityContainer: 'this.Container',
            this: {
                Category: {
                    $Kind: 'EntityType', $Key: [{ EntityInfoID: 'Info/ID' }],
                    Info: { $Type: 'this.EntityInfo' },
                    Name: { $Nullable: true }
                },
                EntityInfo: {
                    $Kind: 'ComplexType',
                    ID: { $Type: 'Edm.Int32' },
                    Created: { $Type: 'Edm.DateTimeOffset' }
                },
                Container: {
                    $Kind: 'EntityContainer',
                    Categories: { $Type: 'this.Category', $Collection: true }
                }
            }
        };
        const expected = {
            paths: {
                "/Categories": {
                    get: {
                        summary: 'Retrieves a list of categories.',
                        tags: ['Categories'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            { $ref: "#/components/parameters/search"},
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: '$orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'Info/ID',
                                            'Info/ID desc',
                                            'Info/Created',
                                            'Info/Created desc',
                                            'Name',
                                            'Name desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'Info',
                                            'Name'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved categories',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of Category',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.Category'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {
                        summary: 'Adds new entity to set',
                        tags: ['set'],
                        requestBody: {
                            description: 'New entity',
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        $ref: '#/components/schemas/this.derived'
                                    }
                                }
                            }
                        },
                        responses: {
                            201: {
                                description: 'Created entity',
                                content: {
                                    'application/json': {
                                        schema: {
                                            $ref: '#/components/schemas/undefined.type_does_not_exist'
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/Categories({EntityInfoID})": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/Categories'].get, expected.paths['/Categories'].get, 'GET Categories');
    })

    it('FilterRestrictions, NavigationRestrictions, SearchRestrictions, and SortRestrictions', function () {
        const csdl = {
            $Version: '4.01',
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" },
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                thing: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: { $DefaultValue: "def" },
                    two: {},
                    nav: { $Type: 'this.thing', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                Container: {
                    things: {
                        $Type: 'this.thing', $Collection: true,
                        "@Capabilities.FilterRestrictions": {
                            "@Core.Description": "Filtering has some restrictions here.",
                            "RequiredProperties": ["two"]
                        },
                        "@Capabilities.NavigationRestrictions": {
                            "RestrictedProperties": [
                                {
                                    "NavigationProperty": "nav",
                                    "Navigability": "Single"
                                }
                            ]
                        },
                        "@Capabilities.SearchRestrictions": {
                            "@Core.Description": "Searching has some restrictions here.",
                            "Searchable": true
                        },
                        "@Capabilities.SortRestrictions": {
                            "@Core.Description": "Sorting has some restrictions here.",
                            "NonSortableProperties": ["one"]
                        }
                    }
                }
            }
        };
        const expected = {
            paths: {
                "/things": {
                    get: {
                        summary: 'Retrieves a list of things.',
                        tags: ['things'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            {
                                in: 'query',
                                name: '$search',
                                schema: { type: 'string' },
                                description: 'Searching has some restrictions here.'
                            },
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: 'Filtering has some restrictions here.\n\nRequired filter properties:\n- two'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: '$orderby',
                                description: 'Sorting has some restrictions here.',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'key desc',
                                            'two',
                                            'two desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'one',
                                            'two'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$expand',
                                description: 'The value of $expand query option is a comma-separated list of navigation property names, \
stream property names, or $value indicating the stream content of a media-entity. \
The corresponding related entities and stream values will be represented inline, \
see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'nav'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved things',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of thing',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.thing'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {}
                },
                "/things('{key}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/things('{key}')/nav": {
                    get: {},
                    patch: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/things'].get, expected.paths['/things'].get, 'GET things');
        assert.deepStrictEqual(actual.components.schemas["this.thing"].properties.one, { type: "string", default: "def" }, "Property with default value");
    })

    it('ExpandRestrictions', function () {
        const csdl = {
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" },
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                root: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true },
                    no_expand: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                child: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true },
                    no_expand: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                grandchild: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {}
                },
                Container: {
                    roots: {
                        $Type: 'this.root', $Collection: true,
                        "@Capabilities.ExpandRestrictions": {
                            "@Core.Description": "Expanding has some restrictions here.",
                            "NonExpandableProperties": ["no_expand", "nav/no_expand", "no_expand/no_expand"]
                        }
                    }
                }
            }
        };
        const expectedExpands = {
            "/roots": [
                '*',
                'nav'
            ],
            "/roots('{key}')": [
                '*',
                'nav'
            ],
            "/roots('{key}')/nav": [
                '*',
                'nav'
            ],
            "/roots('{key}')/no_expand": [
                '*',
                'nav'
            ]
        }

        const actual = lib.csdl2openapi(csdl, {});

        const actualExpands = {}
        for (const [path, item] of Object.entries(actual.paths)) {
            const expand = item.get && item.get.parameters && item.get.parameters.find(param => param.name === '$expand')
            if (expand) {
                actualExpands[path] = expand.schema.items.enum
            }
        }
        assert.deepStrictEqual(actualExpands, expectedExpands, 'expands');
        assert.strictEqual(actual.paths['/roots'].get.parameters.find(item => item.name == '$expand').description, 'Expanding has some restrictions here.', 'expand description')
    })

    it('Default Namespace', function () {
        const csdl = {
            $Version: '4.01',
            $Reference: {
                dummy: {
                    "$Include": [
                        { "$Namespace": "com.sap.vocabularies.Common.v1", "$Alias": "Common" },
                        { "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" },
                        { "$Namespace": "Org.OData.Core.V1", "$Alias": "Core" }
                    ]
                }
            },
            $EntityContainer: 'this.Container',
            this: {
                '@Core.DefaultNamespace': true,
                root: {
                    "@Common.Label": "First",
                    "@Core.Description": "The first thingy",
                    $Kind: 'EntityType', $Key: ['key'], key: {}, other: { $Kind: 'NavigationProperty', $Type: "this.other" }
                },
                other: {
                    "@Common.Label": "Second",
                    "@Core.Description": "The second thingy",
                    $Kind: 'EntityType', $Key: ['key'], key: {}
                },
                act: [
                    {
                        $Kind: "Action",
                        $Parameter: [{ $Name: "in", $Type: "this.root" }],
                        $ReturnType: { $Type: "this.root" },
                    },
                    {
                        $Kind: 'Action',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root' }]
                    },
                    {
                        $Kind: 'Action',
                        $IsBound: true,
                        $Parameter: [
                            { $Name: 'in', $Type: 'this.root', $Collection: true },
                            { $Name: "other" },
                        ]
                    }
                ],
                func: [
                    {
                        $Kind: 'Function',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root' }],
                        $ReturnType: {}
                    },
                    {
                        $Kind: 'Function',
                        $IsBound: true,
                        $Parameter: [{ $Name: 'in', $Type: 'this.root', $Collection: true }],
                        $ReturnType: {}
                    }
                ],
                Container: {
                    '@Capabilities.KeyAsSegmentSupported': true,
                    roots: {
                        $Type: 'this.root', $Collection: true,
                        $NavigationPropertyBinding: {
                            "other": "others"
                        }
                    },
                    others: {
                        $Type: 'this.other', $Collection: true
                    },
                    act: { $Action: "this.act" }
                },
                $Annotations: {
                    "this.act": {
                        "@Core.Description":
                            "Annotations targeting all overloads are currently ignored",
                    },
                    "this.act(Collection(this.root))": {
                        "@Core.Description": "Act!",
                    },
                }
            }
        };

        const expected = {
            paths: {
                "/$batch": { post: {} },
                "/act": { post: {} },
                "/roots": { get: {}, post: {} },
                "/roots/act": {
                    post: {
                        summary: 'Act!',
                        tags: ['First'],
                        requestBody: {
                            description: "Action parameters",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: { other: { type: "string" } },
                                    },
                                },
                            },
                        },
                        responses: {
                            204: {
                                description: 'Success'
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    }
                },
                "/roots/func": { get: {} },
                "/roots/{key}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/act": { post: {} },
                "/roots/{key}/func": { get: {} },
                "/roots/{key}/other": { get: {} },
                "/others": { get: {}, post: {} },
                "/others/{key}": { get: {}, patch: {}, delete: {} },
            }
        }

        const actual = lib.csdl2openapi(csdl, { diagram: true });

        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/roots/act'].post, expected.paths['/roots/act'].post, 'POST /roots/act');
        assert.deepStrictEqual(actual.info.description.split("\n"),
            [
                "Use @Core.LongDescription: '...' on your CDS service to provide a meaningful description.",
                "",
                "## Entity Data Model",
                "![ER Diagram](https://yuml.me/diagram/class/[root{bg:lightslategray}],[root]->[other],[other{bg:lightslategray}],[act{bg:lawngreen}]->[root],[act{bg:lawngreen}]in->[root],[others%20{bg:lawngreen}]++-*>[other],[roots%20{bg:lawngreen}]++-*>[root])",
                "",
                "### Legend",
                "![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type{bg:whitesmoke}],[ComplexType],[EntityType{bg:lightslategray}],[EntitySet/Singleton/Operation{bg:lawngreen}])",
            ],
            "diagram"
        );
        assert.deepStrictEqual(actual.paths['/roots/func'].get.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots'].get.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots'].post.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}'].get.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}'].patch.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}'].delete.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}/act'].post.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}/func'].get.tags, ['First'], 'operation tag');
        assert.deepStrictEqual(actual.paths['/roots/{key}/other'].get.tags, ['First', 'Second'], 'operation tag');
        assert.deepStrictEqual(actual.tags, [{ name: 'First', description: 'The first thingy' }, { name: 'Second', description: 'The second thingy' }], 'global tags');
    })

    it('Deep update on container level', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }] } },
            $EntityContainer: 'this.Container',
            this: {
                root: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    children: { $Type: 'this.child', $Kind: 'NavigationProperty', $ContainsTarget: true, $Collection: true },
                },
                child: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.grandchild', $Kind: 'NavigationProperty', $ContainsTarget: true },
                },
                grandchild: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {}
                },
                Container: {
                    '@Capabilities.KeyAsSegmentSupported': true,
                    '@Capabilities.DeepUpdateSupport': { Supported: true },
                    roots: {
                        $Type: 'this.root', $Collection: true
                    }
                }
            }
        };

        const expected = {
            paths: {
                "/$batch": { post: {} },
                "/roots": { get: {}, post: {} },
                "/roots/{key}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/children": { get: {}, post: {} },
                "/roots/{key}/children/{key_1}": { get: {}, patch: {}, delete: {} },
                "/roots/{key}/children/{key_1}/nav": { get: {}, patch: {} },
            },
            components: {
                schemas: {
                    'this.root-update': {
                        type: 'object',
                        title: 'root (for update)',
                        properties: {
                            one: { type: 'string' }, two: { type: 'string' },
                            children: { type: 'array', items: { $ref: '#/components/schemas/this.child-create' } }
                        }
                    },
                    'this.child-update': {
                        type: 'object',
                        title: 'child (for update)',
                        properties: {
                            one: { type: 'string' }, two: { type: 'string' },
                            nav: { $ref: '#/components/schemas/this.grandchild-create' }
                        }
                    }
                }
            }
        }

        const actual = lib.csdl2openapi(csdl, {});

        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');

        //TODO: check components
        assert.deepStrictEqual(actual.components.schemas['this.root-update'], expected.components.schemas['this.root-update'], 'root update structure')
        assert.deepStrictEqual(actual.components.schemas['this.child-update'], expected.components.schemas['this.child-update'], 'child update structure')
    });

    it("Unknown authorization type", function () {
        const csdl = {
            $Version: "4.0",
            $Reference: {
                dummy: {
                    $Include: [
                        { $Namespace: "Org.OData.Authorization.V1", $Alias: "Auth" },
                    ],
                },
            },
            "auth.example": {
                $Alias: "self",
                Person: {
                    $Kind: "EntityType",
                    $Key: ["ID"],
                    ID: {},
                    Name: {
                        $Nullable: true,
                    },
                },
                Container: {
                    $Kind: "EntityContainer",
                    People: {
                        $Collection: true,
                        $Type: "self.Person",
                    },
                    "@Auth.Authorizations": [
                        {
                            "@odata.type": "foo",
                            Name: "should-be-ignored",
                            Description: "Unknown Authentication Scheme",
                            KeyName: "x-api-key",
                            Location: "Header",
                        },
                        {
                            "@odata.type":
                                "https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Authorization.V1.xml#Auth.ApiKey",
                            Name: "api_key",
                            Description: "Authentication via API key",
                            KeyName: "x-api-key",
                            Location: "Header",
                        },
                    ],
                },
            },
            $EntityContainer: "auth.example.Container",
        };

        const actual = lib.csdl2openapi(csdl, {});

        assert.deepStrictEqual(
            actual.components.securitySchemes,
            {
                api_key: {
                    description: "Authentication via API key",
                    type: "apiKey",
                    name: "x-api-key",
                    in: "header",
                },
            },
            "security schemes"
        );
    });

    it("various types and fishy annotations", function () {
        const csdl = {
            $EntityContainer: "typeExamples.Container",
            typeExamples: {
                Container: {
                    set: { $Type: "typeExamples.single", $Collection: true },
                    unknown: { $Kind: "unknown" },
                },
                single: {
                    $Kind: "EntityType",
                    withMaxLength: {
                        $Type: "typeExamples.typeDefinitionNew",
                        $MaxLength: 10,
                    },
                    binary: { $Type: "Edm.Binary" },
                    primitive: { $Type: "Edm.PrimitiveType" },
                    propertyPath: { $Type: "Edm.PropertyPath" },
                    sbyte: { $Type: "Edm.SByte" },
                    time: { $Type: "Edm.TimeOfDay" },
                    kaputt: { $Type: "Edm.kaputt" },
                    unknown: { $Type: "typeExamples.un-known" },
                },
                typeDefinitionNew: {
                    $Kind: "TypeDefinition",
                    $UnderlyingType: "Edm.String",
                },
                $Annotations: {
                    "typeExamples.single/foo/bar": {
                        /* more than two target path segments */
                    },
                    "typeExamples.single/foo": {
                        /* invalid annotation target */
                    },
                    "typeExamples.not-there": {
                        /* invalid annotation target */
                    },
                },
            },
        };

        const openapi = lib.csdl2openapi(csdl, {});

        assert.deepStrictEqual(
            openapi.components.schemas["typeExamples.single"].properties,
            {
                withMaxLength: {
                    maxLength: 10,
                    allOf: [
                        { $ref: "#/components/schemas/typeExamples.typeDefinitionNew" },
                    ],
                },
                binary: { format: "base64url", type: "string" },
                primitive: {
                    anyOf: [{ type: "boolean" }, { type: "number" }, { type: "string" }],
                },
                propertyPath: { type: "string" },
                sbyte: { type: "integer", format: "int8" },
                time: { type: "string", format: "time", example: "15:51:04" },
                kaputt: {},
                unknown: {
                    $ref: "#/components/schemas/typeExamples.un-known",
                },
  
        },
            "MaxLength"
        );
    });

})

describe('CAP / CS01', function () {

    it('FilterRestrictions, NavigationRestrictions, and SortRestrictions', function () {
        const csdl = {
            $Reference: { dummy: { "$Include": [{ "$Namespace": "Org.OData.Capabilities.V1", "$Alias": "Capabilities" }] } },
            $EntityContainer: 'this.Container',
            this: {
                thing: {
                    $Kind: 'EntityType', $Key: ['key'],
                    key: {},
                    one: {},
                    two: {},
                    nav: { $Type: 'this.thing', $Kind: 'NavigationProperty', $ContainsTarget: true }
                },
                Container: {
                    things: {
                        $Type: 'this.thing', $Collection: true,
                        "@Capabilities.FilterRestrictions": {
                            "RequiredProperties": [
                                { $PropertyPath: "two" } // Note: this syntax is only used by CAP
                            ]
                        },
                        "@Capabilities.NavigationRestrictions": {
                            "RestrictedProperties": [
                                {
                                    "NavigationProperty": { $NavigationPropertyPath: "nav" }, // Note: this syntax is only used by CAP
                                    "Navigability": { $EnumMember: "Single" }                 // Note: this syntax is only used by CAP
                                }
                            ]
                        },
                        "@Capabilities.SortRestrictions": {
                            "NonSortableProperties": [
                                { $PropertyPath: "one" } // Note: this syntax is only used by CAP
                            ]
                        }
                    }
                }
            }
        };
        const expected = {
            paths: {
                "/things": {
                    get: {
                        summary: 'Retrieves a list of things.',
                        tags: ['things'],
                        parameters: [
                            { $ref: "#/components/parameters/top" },
                            { $ref: "#/components/parameters/skip" },
                            { $ref: "#/components/parameters/search"},
                            {
                                in: 'query',
                                name: '$filter',
                                schema: { type: 'string' },
                                description: 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)\n\nRequired filter properties:\n- two'
                            },
                            { $ref: '#/components/parameters/count' },
                            {
                                in: 'query',
                                name: '$orderby',
                                description: 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'key desc',
                                            'two',
                                            'two desc'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$select',
                                description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            'key',
                                            'one',
                                            'two'
                                        ]
                                    }
                                }
                            },
                            {
                                in: 'query',
                                name: '$expand',
                                description: 'The value of $expand query option is a comma-separated list of navigation property names, \
stream property names, or $value indicating the stream content of a media-entity. \
The corresponding related entities and stream values will be represented inline, \
see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                                explode: false,
                                schema: {
                                    type: 'array',
                                    uniqueItems: true,
                                    items: {
                                        type: 'string',
                                        enum: [
                                            '*',
                                            'nav'
                                        ]
                                    }
                                }
                            }
                        ],
                        responses: {
                            200: {
                                description: 'Retrieved things',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            title: 'Collection of thing',
                                            properties: {
                                                '@count': {
                                                    $ref: '#/components/schemas/count'
                                                },
                                                value: {
                                                    type: 'array',
                                                    items: {
                                                        $ref: '#/components/schemas/this.thing'
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '4XX': {
                                $ref: '#/components/responses/error'
                            }
                        }
                    },
                    post: {}
                },
                "/things('{key}')": {
                    get: {},
                    patch: {},
                    delete: {}
                },
                "/things('{key}')/nav": {
                    get: {},
                    patch: {}
                },
                '/$batch': { post: {} }
            }
        };
        const actual = lib.csdl2openapi(csdl, {});
        assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
        assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
        assert.deepStrictEqual(actual.paths['/things'].get, expected.paths['/things'].get, 'GET things');
    })

})

function check(actual, expected) {
    assert.deepStrictEqual(paths(actual), paths(expected), 'Paths');
    assert.deepStrictEqual(operations(actual), operations(expected), 'Operations');
    assert.deepStrictEqual(actual, expected, 'OpenAPI document');
}

function paths(openapi) {
    return Object.keys(openapi.paths).sort();
}

function operations(openapi) {
    const p = {};
    Object.keys(openapi.paths).forEach(template => {
        p[template] = Object.keys(openapi.paths[template]).filter(op => op != 'parameters');
    });
    return p;
}

function schemas(openapi) {
    return Object.keys(openapi.components.schemas)
        .sort()
        .filter((s) => s.includes("."));
}
