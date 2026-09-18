const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const { importOpenAPI } = require('../../../lib/import/importOpenAPI')
const { openAPI2csn } = require('../../../lib/import')

const base = {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0' },
    paths: {}
}

function make(paths, schemas) {
    return { ...base, paths, components: schemas ? { schemas } : undefined }
}

describe('Import examples', () => {
    it('petstore Swagger', () => {
        const swagger = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input/petstore.swagger.json')))
        const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'output/petstore.swagger.csn')))
        const csn = importOpenAPI(swagger)
        assert.deepStrictEqual(csn, expected, 'imported CSN')
    })

    it('wizard-world OpenAPI3', () => {
        const openapi = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input/wizard-world.json')))
        const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'output/wizard-world.csn')))
        const csn = importOpenAPI(openapi)
        assert.deepStrictEqual(csn, expected, 'imported CSN')
    })

    it('Circular Reference OpenAPI3', () => {
        const openapi = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input/ref.json')))
        const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'output/ref.csn')))
        const csn = importOpenAPI(openapi)
        assert.deepStrictEqual(csn, expected, 'imported CSN')
    })

    it('petstore OpenAPI3 via openAPI2csn', () => {
        const src = fs.readFileSync(path.resolve(__dirname, 'input/petstore.json'), 'utf-8')
        const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'output/petstore.csn')))
        const csn = openAPI2csn(src)
        assert.deepStrictEqual(csn, expected, 'imported CSN')
    })
})

describe('Import edge cases', () => {
    it('empty input', () => {
        const csn = importOpenAPI({})
        assert.ok(csn.definitions)
    })

    it('invalid JSON throws', () => {
        assert.throws(() => openAPI2csn('not json'), /not valid/)
    })

    // common.JSON — schema with no recognized type
    it('untyped schema produces common.JSON', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { not: { type: 'string' } } } } } } } }
        }))
        assert.ok(csn.definitions['common.JSON'])
    })

    // array with no items => someJSON
    it('array with no items produces common.JSON', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array' } } } } } } }
        }))
        assert.ok(csn.definitions['common.JSON'])
    })

    // array-of-array => anonymous wrapper type
    it('array of array items wrapped in anonymous type', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } } } } } }
        }))
        const anon = Object.keys(csn.definitions).find(k => k.includes('anonymous'))
        assert.ok(anon)
    })

    // array items with annotation => anonymous type
    it('array items with description wrapped in anonymous type', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { type: 'string', description: 'a string' } } } } } } } }
        }))
        const anon = Object.keys(csn.definitions).find(k => k.includes('anonymous'))
        assert.ok(anon)
    })

    // boolean type
    it('boolean parameter', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'flag', in: 'query', schema: { type: 'boolean', default: true } }], responses: { '204': {} } } }
        }))
        const op = csn.definitions['Test.foo']
        assert.equal(op.params.flag.type, 'cds.Boolean')
    })

    // number type with double format
    it('number double format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'n', in: 'query', schema: { type: 'number', format: 'double' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.n.type, 'cds.Double')
    })

    // integer int64
    it('integer int64 format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'n', in: 'query', schema: { type: 'integer', format: 'int64' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.n.type, 'cds.Integer64')
    })

    // string formats
    it('string binary format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', format: 'binary' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.LargeBinary')
    })

    it('string date format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', format: 'date' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.Date')
    })

    it('string date-time format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', format: 'date-time' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.Timestamp')
    })

    it('string time format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', format: 'time' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.Time')
    })

    it('string uuid format', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.UUID')
    })

    it('string file format', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            paths: { '/foo': { get: { parameters: [{ name: 's', in: 'query', type: 'file' }], responses: { '204': {} } } } }
        })
        assert.equal(csn.definitions['Test.foo'].params.s.type, 'cds.String')
    })

    // string enum
    it('string enum', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', enum: ['a', 'b', null] } }], responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo'].params.s.enum)
    })

    // string pattern
    it('string pattern', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', pattern: '^[a-z]+$' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s['@assert.format'], '^[a-z]+$')
    })

    // object with anyOf / oneOf
    it('object with anyOf', () => {
        const csn = importOpenAPI(make({
            '/foo': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', anyOf: [{ type: 'string' }] } } } }, responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo_post'].params.body['@openapi.anyOf'])
    })

    it('object with oneOf', () => {
        const csn = importOpenAPI(make({
            '/foo': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', oneOf: [{ type: 'string' }] } } } }, responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo_post'].params.body['@openapi.oneOf'])
    })

    // non-JSON content type in response
    it('non-JSON response content type', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'text/plain': { schema: { type: 'string' } } } } } } }
        }))
        assert.ok(csn.definitions['Test.foo'].returns['@openapi.contentType'])
    })

    // v2 non-JSON content type in response
    it('v2 non-JSON produces/consumes content type', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            paths: {
                '/foo': { get: { produces: ['text/plain'], responses: { '200': { schema: { type: 'string' } } } } }
            }
        })
        assert.ok(csn.definitions['Test.foo'].returns['@openapi.contentType'])
    })

    // v2 body parameter
    it('v2 body parameter', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            paths: {
                '/foo': { post: { consumes: ['application/json'], parameters: [{ name: 'body', in: 'body', schema: { type: 'object', properties: { x: { type: 'string' } } } }], responses: { '204': {} } } }
            }
        })
        assert.ok(csn.definitions['Test.foo_post'].params.body)
    })

    // requestBody with $ref
    it('requestBody with $ref', () => {
        const csn = importOpenAPI({
            ...base,
            paths: {
                '/foo': { post: { requestBody: { $ref: '#/components/requestBodies/MyBody' }, responses: { '204': {} } } }
            },
            components: {
                requestBodies: { MyBody: { content: { 'application/json': { schema: { type: 'object', properties: { x: { type: 'string' } } } } } } }
            }
        })
        assert.ok(csn.definitions['Test.foo_post'].params.body)
    })

    // reuse parameter via $ref
    it('reuse parameter via $ref', () => {
        const csn = importOpenAPI({
            ...base,
            paths: {
                '/foo': { get: { parameters: [{ $ref: '#/components/parameters/MyParam' }], responses: { '204': {} } } }
            },
            components: {
                parameters: { MyParam: { name: 'myParam', in: 'query', schema: { type: 'string' } } }
            }
        })
        assert.ok(csn.definitions['Test.foo'].params.myParam)
    })

    // reuse response via $ref
    it('reuse response via $ref', () => {
        const csn = importOpenAPI({
            ...base,
            paths: {
                '/foo': { get: { responses: { '200': { $ref: '#/components/responses/MyResponse' } } } }
            },
            components: {
                responses: { MyResponse: { content: { 'application/json': { schema: { type: 'string' } } } } }
            }
        })
        assert.equal(csn.definitions['Test.foo'].returns.type, 'cds.String')
    })

    // GET with no 2xx response => cds.Boolean
    it('GET with no success response returns cds.Boolean', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '400': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].returns.type, 'cds.Boolean')
    })

    // GET with 2xx but no schema => cds.Boolean
    it('GET with 2xx but no schema returns cds.Boolean', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].returns.type, 'cds.Boolean')
    })

    // name collision throws
    it('name collision throws', () => {
        assert.throws(() => importOpenAPI(make({
            '/foo': {
                get: { responses: { '204': {} } },
                put: { responses: { '204': {} } }  // nameFromPath('/foo','put') collides with a manually crafted collision
            },
            '/foo_put': { get: { responses: { '204': {} } } }
        })), /Name collision/)
    })

    // $ref with unexpected prefix throws
    it('unexpected schema $ref throws', () => {
        assert.throws(() => importOpenAPI(make(
            { '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/other/Foo' } } } } } } } },
            { Foo: { type: 'object' } }
        )), /unexpected reference/)
    })

    // unexpected parameter $ref throws
    it('unexpected parameter $ref throws', () => {
        assert.throws(() => importOpenAPI({
            ...base,
            paths: {
                '/foo': { get: { parameters: [{ $ref: '#/other/MyParam' }], responses: { '204': {} } } }
            },
            components: { parameters: {} }
        }), /unexpected reference/)
    })

    // no responses throws
    it('operation with no responses throws', () => {
        assert.throws(() => importOpenAPI(make({
            '/foo': { get: {} }
        })), /no responses/)
    })

    // allOf single-element normalization
    it('allOf with single element normalizes type', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { allOf: [{ type: 'string' }] } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p.type, 'cds.String')
    })

    // allOf two-element with $ref normalization — merges ref with constraint, returns ref type
    it('allOf two-element $ref + primitive', () => {
        const csn = importOpenAPI(make(
            { '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { allOf: [{ $ref: '#/components/schemas/MyStr' }, { maxLength: 10 }] } }], responses: { '204': {} } } } },
            { MyStr: { type: 'string' } }
        ))
        assert.equal(csn.definitions['Test.foo'].params.p.type, 'Test_types.MyStr')
    })

    // normalizeSchemaType: array type with null
    it('nullable array type normalizes', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { type: ['string', 'null'] } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p.type, 'cds.String')
    })

    // normalizeSchemaType: [integer, number] => number
    it('type [integer, number] normalizes to number', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { type: ['integer', 'number'] } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p.type, 'cds.Decimal')
    })

    // openapi.explode and openapi.style
    it('explode and style annotations', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', style: 'form', explode: true, schema: { type: 'string' } }], responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo'].params.p['@openapi.explode'])
    })

    it('spaceDelimited style annotation', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            paths: { '/foo': { get: { parameters: [{ name: 'p', in: 'query', type: 'string', collectionFormat: 'ssv' }], responses: { '204': {} } } } }
        })
        assert.equal(csn.definitions['Test.foo'].params.p['@openapi.style'], 'spaceDelimited')
    })

    it('pipeDelimited style annotation', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            paths: { '/foo': { get: { parameters: [{ name: 'p', in: 'query', type: 'string', collectionFormat: 'pipes' }], responses: { '204': {} } } } }
        })
        assert.equal(csn.definitions['Test.foo'].params.p['@openapi.style'], 'pipeDelimited')
    })

    it('allowReserved annotation', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', allowReserved: true, schema: { type: 'string' } }], responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo'].params.p['@openapi.allowReserved'])
    })

    // required parameter annotation
    it('required query parameter', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', required: true, schema: { type: 'string' } }], responses: { '204': {} } } }
        }))
        assert.ok(csn.definitions['Test.foo'].params.p['@openapi.required'])
    })

    // schema required array => @mandatory
    it('required property gets @mandatory', () => {
        const csn = importOpenAPI(make({}, {
            MyType: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } }
        }))
        assert.ok(csn.definitions['Test_types.MyType'].elements.name['@mandatory'])
    })

    // pathAndMethod: action with @openapi.method
    it('pathAndMethod for non-POST action', () => {
        const csn = importOpenAPI(make({
            '/foo': { put: { responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo_put']['@openapi.method'], 'PUT')
    })

    // example annotation
    it('primitive example annotation', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { type: 'integer', example: 42 } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p['@Core.Example.Value'], 42)
    })

    // namedType $ref to object => includes
    it('named type $ref to object uses includes', () => {
        const csn = importOpenAPI(make({}, {
            Base: { type: 'object', properties: { x: { type: 'string' } } },
            Child: { $ref: '#/components/schemas/Base' }
        }))
        assert.ok(csn.definitions['Test_types.Child'].includes)
    })

    // object allOf with $ref subschema => hasIncludes + anonymousType (lines 399-402, 415-416)
    it('object allOf with $ref produces anonymous includes type', () => {
        const csn = importOpenAPI(make(
            { '/foo': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', allOf: [{ $ref: '#/components/schemas/Base' }], properties: { extra: { type: 'string' } } } } } }, responses: { '204': {} } } } },
            { Base: { type: 'object', properties: { id: { type: 'string' } } } }
        ))
        const anon = Object.keys(csn.definitions).find(k => k.includes('anonymous'))
        assert.ok(anon)
        assert.ok(csn.definitions[anon].includes)
    })

    // object allOf with subSchema.properties (line 404-405)
    it('object allOf with inline properties subschema', () => {
        const csn = importOpenAPI(make(
            { '/foo': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', allOf: [{ properties: { x: { type: 'string' } } }] } } } }, responses: { '204': {} } } } },
            {}
        ))
        assert.ok(csn.definitions['Test.foo_post'].params.body)
    })

    it('conflicting types in allOf falls back to someJSON', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { allOf: [{ type: 'integer' }, { type: 'boolean' }] } } } } } } }
        }))
        assert.ok(csn.definitions['common.JSON'])
    })

    // someJSON with arrayItem and non-empty schema (line 529)
    it('someJSON as array item produces anonymous type with schema', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { allOf: [{ type: 'integer' }, { type: 'boolean' }] } } } } } } } }
        }))
        const anon = Object.values(csn.definitions).find(d => d['@openapi.schema'])
        assert.ok(anon)
    })

    // unexpected response $ref prefix throws (line 199)
    it('unexpected response $ref prefix throws', () => {
        assert.throws(() => importOpenAPI({
            ...base,
            paths: { '/foo': { get: { responses: { '200': { $ref: '#/other/MyResponse' } } } } },
            components: { responses: {} }
        }), /unexpected reference/)
    })

    // unexpected requestBody $ref prefix throws (line 236)
    it('unexpected requestBody $ref prefix throws', () => {
        assert.throws(() => importOpenAPI({
            ...base,
            paths: { '/foo': { post: { requestBody: { $ref: '#/other/MyBody' }, responses: { '204': {} } } } },
            components: { requestBodies: {} }
        }), /Unexpected request body reference/)
    })

    // allOf with non-object sub-schema throws (line 408)
    it('allOf with non-object sub-schema throws', () => {
        assert.throws(() => importOpenAPI(make({
            '/foo': { post: { requestBody: { content: { 'application/json': { schema: { type: 'object', allOf: [{ type: 'string' }] } } } }, responses: { '204': {} } } }
        })), /non-object sub-schema/)
    })

    // betterType returns null — conflicting non-string types (line 670)
    it('betterType with incompatible types returns null => someJSON', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { anyOf: [{ type: 'integer' }, { type: 'boolean' }] } } } } } } }
        }))
        assert.ok(csn.definitions['common.JSON'])
    })

    // recursive type detection via items.$ref (line 701)
    it('recursive items.$ref logs warning', () => {
        const warnings = []
        const orig = console.warn
        console.warn = (...args) => warnings.push(args.join(' '))
        importOpenAPI(make({}, {
            Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } } }
        }))
        console.warn = orig
        assert.ok(warnings.some(w => w.includes('Recursive')))
    })

    // bestMatchingType via allOf $ref with xOf on referenced schema
    // standard header param is skipped (line 131)
    it('standard header parameter is skipped', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'Authorization', in: 'header', schema: { type: 'string' } }], responses: { '204': {} } } }
        }))
        assert.ok(!csn.definitions['Test.foo'].params?.Authorization)
    })

    // string with maxLength (line 439)
    it('string with maxLength', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 's', in: 'query', schema: { type: 'string', maxLength: 50 } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.s.length, 50)
    })

    // allOf single-element with description on parent (line 470)
    it('allOf single-element with description inherits description', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { description: 'my desc', allOf: [{ type: 'string' }] } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p['@description'], 'my desc')
    })

    // examples array (line 546)
    it('examples array annotation', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { type: 'integer', examples: [99] } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo'].params.p['@Core.Example.Value'], 99)
    })

    // betterType: anyOf string + integer => string (lines 665-666)
    it('anyOf string and integer resolves to string', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { responses: { '200': { content: { 'application/json': { schema: { anyOf: [{ type: 'string' }, { type: 'integer' }] } } } } } } }
        }))
        assert.equal(csn.definitions['Test.foo'].returns.type, 'cds.String')
    })

    // v2 parameter reuse via #/parameters/ (line 118)
    it('v2 parameter reuse via $ref', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            parameters: { MyParam: { name: 'myParam', in: 'query', type: 'string' } },
            paths: { '/foo': { get: { parameters: [{ $ref: '#/parameters/MyParam' }], responses: { '204': {} } } } }
        })
        assert.ok(csn.definitions['Test.foo'].params.myParam)
    })

    // v2 response reuse via #/responses/ (line 196)
    it('v2 response reuse via $ref', () => {
        const csn = importOpenAPI({
            swagger: '2.0',
            info: { title: 'Test', version: '1.0' },
            responses: { MyResponse: { schema: { type: 'string' } } },
            paths: { '/foo': { get: { responses: { '200': { $ref: '#/responses/MyResponse' } } } } }
        })
        assert.equal(csn.definitions['Test.foo'].returns.type, 'cds.String')
    })

    // path parameter with non-simple style (lines 149, 152)
    it('path parameter with non-simple style gets @openapi.style', () => {
        const csn = importOpenAPI(make({
            '/foo/{id}': { get: { parameters: [{ name: 'id', in: 'path', style: 'matrix', schema: { type: 'string' } }], responses: { '204': {} } } }
        }))
        assert.equal(csn.definitions['Test.foo_'].params.id['@openapi.style'], 'matrix')
    })


    it('schema type null hits default case => common.JSON', () => {
        const csn = importOpenAPI(make({}, { Null: { type: 'null' } }))
        assert.ok(csn.definitions['common.JSON'])
    })

    it('bestMatchingType via allOf with xOf-typed ref', () => {
        const csn = importOpenAPI(make({
            '/foo': { get: { parameters: [{ name: 'p', in: 'query', schema: { allOf: [{ $ref: '#/components/schemas/MyUnion' }] } }], responses: { '204': {} } } }
        }, {
            MyUnion: { anyOf: [{ type: 'string' }, { type: 'string' }] }
        }))
        assert.ok(csn.definitions['Test.foo'].params.p)
    })
})
