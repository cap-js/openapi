const cds = require('@sap/cds')

const { compile, import: openapi } = require('./index')

if (cds.compile?.to) cds.compile.to.openapi = compile

if (cds.import?.from) cds.import.from.openapi = async function (filepath, options = {}) {
    const src = await cds.utils.read(filepath, 'utf-8')
    const csn = openapi.openAPI2csn(src)
    options.inputFileKind = 'rest'
    return csn
}
