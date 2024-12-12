const csdl2openapi = require('./csdl2openapi')
const cds = require('@sap/cds/lib');
const fs = require("fs");

module.exports = function processor(csn, options = {}) {
  const edmOptions = Object.assign({
    odataOpenapiHints: true, // hint to cds-compiler
    edm4OpenAPI: true, // downgrades certain OData errors to warnings in cds-compiler
    to: 'openapi' // hint to cds.compile.to.edm (usually set by CLI, but also do this in programmatic usages)
  }, options)

  // must not be part of function* otherwise thrown errors are swallowed
  const csdl = cds.compile.to.edm(csn, edmOptions);
  let openApiDocs = {};

  if (csdl[Symbol.iterator]) { // generator function means multiple services
    openApiDocs = _getOpenApiForMultipleServices(csdl, csn, options)
  } else {
    const openApiOptions = toOpenApiOptions(csdl, csn, options)
    openApiDocs = _getOpenApi(csdl, openApiOptions);
  }

  if (Object.keys(openApiDocs).length == 1) {
    return openApiDocs[Object.keys(openApiDocs)[0]];
  }

  return _iterate(openApiDocs);
}

function _getOpenApiForMultipleServices(csdl, csn, options) {
  let openApiDocs = {};
  for (let [content, metadata] of csdl) {
    if (typeof content === "string") {
      content = JSON.parse(content);
    }
    const openApiOptions = toOpenApiOptions(content, csn, options);
    const openApiDocsForService = _getOpenApi(content, openApiOptions, metadata.file);
    openApiDocs = { ...openApiDocs, ...openApiDocsForService };
  }
  return openApiDocs;
}

function* _iterate(openApiDocs) {
  for (const key in openApiDocs) {
    if (key != "") {
      yield [openApiDocs[key], { file: key }];
    } else {
      yield [openApiDocs[key]];
    }
  }
}

function _getOpenApi(csdl, options, serviceName = "") {
  const openApiDocs = {};
  let filename;

  const protocols = Object.keys(options["url"]);

  protocols.forEach((protocol) => {
    let sOptions = Object.assign({}, options);
    let url = options["url"][protocol];

    if (protocol == "rest" && !options["odataVersion"]) {
      options["odataVersion"] = "4.01";
    }

    sOptions["url"] = url;

    const openapi = csdl2openapi.csdl2openapi(csdl, sOptions);

    if (protocols.length > 1) {
      filename = serviceName + "." + protocol;
    } else {
      filename = serviceName;
    }
    openApiDocs[filename] = openapi;
  });

  return openApiDocs;
}

function toOpenApiOptions(csdl, csn, options = {}) {
  const result = {};
  for (const key in options) {
    if (/^openapi:(.*)/.test(key) && RegExp.$1) {
      result[RegExp.$1] = options[key];
    } else if (key === "odata-version") {
      result["odataVersion"] = options[key];
    }
  }

  if (result["config-file"]) {
    if (fs.existsSync(result["config-file"])) {
      const fileContent = require(result["config-file"]);
      Object.keys(fileContent).forEach((key) => {
        if (key === "odata-version" && !result["odataVersion"]) {
          result["odataVersion"] = fileContent[key];
        } else if (key === "diagram") {
          result["diagram"] = !result["diagram"] && fileContent[key] === "true";
        } else if (!(key in result)) {  // inline options take precedence
          result[key] = JSON.stringify(fileContent[key]);
        }
      });
    } else {
      throw new Error("Error while parsing the openapi configuration file");
    }
  }

  const protocols = _getProtocols(csdl, csn, result["odataVersion"]);

  if (result.url) {
    const servicePaths = _servicePath(csdl, csn, protocols);
    let keys = Object.keys(servicePaths);

    let urls = {};
    keys.forEach((protocol) => {
      urls[protocol] = result.url.replace(
        /\/*\$\{service-path\}/g,
        servicePaths[protocol]
      );
    });
    result.url = urls;
  } else {
    // no 'url' option set: infer URL from service path
    result.url = _servicePath(csdl, csn, protocols); // /catalog
  }
  return result;
}

function _getProtocols(csdl, csn, odataVersion) {
  if (csdl.$EntityContainer) {
    const serviceName = csdl.$EntityContainer.replace(/\.[^.]+$/, "");
    const service = csn.definitions[serviceName];
    let protocols = [];

    if(odataVersion === "4.01"){
      protocols.push("rest");
    }
    else if(odataVersion === "4.0"){
      protocols.push("odata");
    }
    else if (!service["@protocol"]) {
      protocols.push("rest"); //taking rest as default in case no relevant protocol is there
    } else if (service["@protocol"] === "none") {
      // if @protocol is 'none' then throw an error
      throw new Error(
        `Service "${serviceName}" is annotated with @protocol:'none' which is not supported in openAPI generation.`
      );
    } else if (
      service["@protocol"] === "rest" ||
      service["@protocol"] === "odata"
    ) {
      protocols.push(service["@protocol"]);
    } else if (Array.isArray(service["@protocol"])) {
      service["@protocol"].forEach((protocol) => {
        if (protocol === "rest" || protocol === "odata") {
          protocols.push(protocol);
        } else {
          console.warn(`"${protocol}" protocol is not supported`);
        }
      });
    }

    return protocols;
  }
}

function _servicePath(csdl, csn, protocols) {
  if (csdl.$EntityContainer) {
    const serviceName = csdl.$EntityContainer.replace(/\.[^.]+$/, "");
    const service = csn.definitions[serviceName];
    let paths = {};
    let path;

    if (Array.isArray(protocols)) {
      protocols.forEach((protocol) => {
        service["@protocol"] = protocol;
        path = cds.service.path4?.(service) || cds.serve.path4(service);
        paths[protocol] = path;
      });
    }

    return paths;
  }
}