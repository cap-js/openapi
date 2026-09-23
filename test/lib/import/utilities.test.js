const { describe, it } = require('node:test')
const assert = require('node:assert')

const { cdsName, nameFromPath, pathAndMethod } = require('../../../lib/import/utilities')

describe('Utilities', () => {
    it('cdsName', () => {
        assert.equal(cdsName(''), '_', 'empty')
        assert.equal(cdsName(42), '_42', 'number')
        assert.equal(cdsName('0stuff'), '_0stuff', 'start with digit')
        assert.equal(cdsName('_foo'), '_foo', 'start with underscore')
        assert.equal(cdsName('foo-bar'), 'foo_bar', 'with dash')
    })

    it('nameFromPath', () => {
        assert.equal(nameFromPath('/', 'get'), '_root', 'root-get')
        assert.equal(nameFromPath('/', 'post'), '_root_post', 'root-post')

        assert.equal(nameFromPath('/root', 'get'), 'root', 'root-get')
        assert.equal(nameFromPath('/root', 'post'), 'root_post', 'root-post')

        assert.equal(nameFromPath('/root/{id}', 'get'), 'root_', 'root-get')
        assert.equal(nameFromPath('/root/{id}', 'post'), 'root__post', 'root-post')

        assert.equal(nameFromPath('/{var}', 'get'), '_', 'root-get')
        assert.equal(nameFromPath('/{var}', 'post'), '__post', 'root-post')

        assert.equal(nameFromPath('/{var}/{var2}', 'get'), '__', 'root-get')
        assert.equal(nameFromPath('/{var}/{var2}', 'post'), '___post', 'root-post')

        assert.equal(nameFromPath('/foo', 'get'), 'foo', 'one segment')
        assert.equal(nameFromPath('/foo', 'post'), 'foo_post', 'one segment')

        assert.equal(nameFromPath('/foo/bar', 'get'), 'foo_bar', 'two segments')
        assert.equal(nameFromPath('/foo/bar', 'post'), 'foo_bar_post', 'two segments')

        assert.equal(nameFromPath('/foo/{id}', 'get'), 'foo_', 'one segment and key segment')
        assert.equal(nameFromPath('/foo/{id}', 'post'), 'foo__post', 'one segment and key segment')
    })
})

describe('pathAndMethod', () => {
    it('function kind returns GET', () => {
        const { path, method } = pathAndMethod({ kind: 'function', '@openapi.path': '/foo' })
        assert.equal(method, 'GET')
        assert.equal(path, '/foo')
    })

    it('action with explicit method returns it', () => {
        const { method } = pathAndMethod({ '@openapi.method': 'PUT', '@openapi.path': '/foo' })
        assert.equal(method, 'PUT')
    })

    it('action without explicit method defaults to POST', () => {
        const { method } = pathAndMethod({ '@openapi.path': '/foo' })
        assert.equal(method, 'POST')
    })
})
