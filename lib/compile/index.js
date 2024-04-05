const csdl2openapi = require('./csdl2openapi')
const cds = require('@sap/cds/lib');

module.exports = function processor(csn, options = {}) {
    const edmOptions = Object.assign({
        odataOpenapiHints: true, // hint to cds-compiler
        edm4OpenAPI: true, // downgrades certain OData errors to warnings in cds-compiler
        to: 'openapi' // hint to cds.compile.to.edm (usually set by CLI, but also do this in programmatic usages)
    }, options)

    // must not be part of function* otherwise thrown errors are swallowed
    const csdl = cds.compile.to.edm(csn, edmOptions);

    if (csdl[Symbol.iterator]) { // generator function means multiple services
        return _iterate(csdl, csn, options)
    } else {
        const openApiOptions = toOpenApiOptions(csdl, csn, options)
        return _getOpenApi(csdl, openApiOptions);
    }
}

function* _iterate(csdl, csn, options) {
    for (let [content, metadata] of csdl) {
        if (typeof content === 'string') {
            content = JSON.parse(content);
        }
        const openApiOptions = toOpenApiOptions(content, csn, options)
        const openapi = _getOpenApi(content, openApiOptions);
        yield [openapi, { file: metadata.file }];
    }
}

function _getOpenApi(csdl, options) {
    const openapi = csdl2openapi.csdl2openapi(csdl, options);
    return openapi;
}

function toOpenApiOptions(csdl, csn, options = {}) {
    const result = {}
    for (const key in options) {
        if (/^openapi:(.*)/.test(key) && RegExp.$1) {
            result[RegExp.$1] = options[key];
        }
        else if (key === 'odata-version') {
            result['odataVersion'] = options[key];
        }
    }
    if (result.url) {
        result.url = result.url.replace(/\/*\$\{service-path\}/g, servicePath(csdl, csn))
    }
    else { // no 'url' option set: infer URL from service path
        result.url = servicePath(csdl, csn) // /catalog
    }
    return result
}

function servicePath(csdl, csn) {
    if (csdl.$EntityContainer) {
        const serviceName = csdl.$EntityContainer.replace(/\.[^.]+$/, '')
        const service = csn.definitions[serviceName]

        // if @protocol is 'none' then throw an error
        if (service['@protocol'] === 'none') {
            throw new Error(`Service "${serviceName}" is annotated with @protocol:'none' which is not supported in openAPI generation.`)
        }
        return cds.service.path4?.(service) || cds.serve.path4(service)
    }
}
