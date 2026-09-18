const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const { importOpenAPI } = require('../../../lib/import/importOpenAPI')
const { openAPI2csn } = require('../../../lib/import')

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
        assert.ok(csn.definitions, 'has definitions')
    })
})
