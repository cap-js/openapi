const {
  cdsName,
  nameFromPath,
  pathAndMethod,
  serviceName,
} = require("./utilities");
const cds = require('@sap/cds');

module.exports = { importOpenAPI };

// we are not interested (yet) in HEAD, OPTIONS, TRACE
const IS_METHOD = {
  delete: true,
  get: true,
  patch: true,
  post: true,
  put: true,
};

const STANDARD_HEADERS = [
  "accept",
  "accept-encoding",
  "accept-language",
  "authorization",
  "content-type",
  "if-match",
];

function importOpenAPI(input) {
  const csn = {
    definitions: {},
    meta: { creator: "cds-import-openapi" },
  };

  const context = {
    serviceName: serviceName(cds.cli.options["into-namespace"]
      ?? input.info?.title
      ?? "TODO.service"
    ),
    oasVersion: input.openapi || input.swagger,
    v3: !!input.openapi,
    schemas: input.openapi ? input.components?.schemas : input.definitions,
    anonymous: [],
    JSON: false,
  };

  //TODO: complain if neither swagger nor openapi3, i.e. context.oasVersion is undefined
  const service = {
    kind: "service",
    "@Capabilities.BatchSupported": false,
    "@Capabilities.KeyAsSegmentSupported": true,
  };
  if (input.info?.title) service["@Core.Description"] = input.info.title;
  if (input.info?.version) service["@Core.SchemaVersion"] = input.info.version;
  if (input.info?.description)
    service["@Core.LongDescription"] = input.info.description;
  csn.definitions[context.serviceName] = service;

  operations(context, csn, input);

  reuseTypes(context, csn);

  anonymousTypes(context, csn);

  return csn;
}

function reuseTypes(context, csn) {
  for (const [name, schema] of Object.entries(context.schemas || {})) {
    const typeName = `${context.serviceName}_types.${cdsName(name)}`;
    csn.definitions[typeName] = cdsType(context, schema, false, true);
    csn.definitions[typeName].kind = "type";
    delete csn.definitions[typeName].notNull;
  }
}

function anonymousTypes(context, csn) {
  for (const a of context.anonymous) {
    csn.definitions[a.name] = a.type;
    csn.definitions[a.name].kind = "type";
  }
  if (context.JSON) {
    csn.definitions["common.JSON"] = { kind: "type", type: "cds.LargeString" };
  }
}

function operations(context, csn, input) {
  const reuseParameters = context.v3
    ? input.components?.parameters
    : input.parameters;
  const reuseResponses = context.v3
    ? input.components?.responses
    : input.responses;
  for (const [path, item] of Object.entries(input.paths || {})) {
    const globalParameters = item.parameters || [];
    for (const [method, operation] of Object.entries(item)) {
      if (!IS_METHOD[method]) continue;
      const cdsOperation = {
        kind: method === "get" ? "function" : "action",
        params: {},
      };
      if (operation.tags) cdsOperation["@Common.Label"] = operation.tags[0];
      if (operation.summary)
        cdsOperation["@Core.Description"] = operation.summary;
      if (operation.description)
        cdsOperation["@Core.LongDescription"] = operation.description;
      if (cdsOperation.kind === "action" && method !== "post")
        cdsOperation["@openapi.method"] = method.toUpperCase();
      cdsOperation["@openapi.path"] = path;

      let bodyParam;

      for (let param of globalParameters.concat(operation.parameters || [])) {
        if (param.$ref) {
          // resolve reuse parameter
          const expectedPrefix = context.v3
            ? "#/components/parameters/"
            : "#/parameters/";
          if (!param.$ref.startsWith(expectedPrefix)) {
            throw new Error(
              `TODO: unexpected reference ${param.$ref} in parameter for ${method} of ${path}`,
            );
          }
          param = reuseParameters[param.$ref.substring(expectedPrefix.length)];
        }

        if (param.in === "body") {
          bodyParam = param;
          continue;
        }
        if (STANDARD_HEADERS.includes(param.name.toLowerCase())) continue;

        const cdsParam = cdsType(
          context,
          context.v3 ? param?.schema : param,
          false,
          false,
          true,
        );
        if (param.description) cdsParam["@description"] = param.description;
        cdsParam["@openapi.in"] = param.in;

        // only add the annotation "@openapi.explode" for true scenario
        if (param.explode || param.style === "form")
          cdsParam["@openapi.explode"] = true;
        if (!param.explode) delete cdsParam["@openapi.explode"];

        if (
          (param.in === "path" && param.style && param.style !== "simple") ||
          (param.in === "query" && param.style && param.style !== "form")
        )
          cdsParam["@openapi.style"] = param.style;
        if (param.in === "query" && param.collectionFormat === "ssv")
          cdsParam["@openapi.style"] = "spaceDelimited";
        if (param.in === "query" && param.collectionFormat === "pipes")
          cdsParam["@openapi.style"] = "pipeDelimited";

        if (param.in === "query" && param.allowReserved === true)
          cdsParam["@openapi.allowReserved"] = true;

        if (param.required && param.in !== "path")
          cdsParam["@openapi.required"] = true;

        if (!param.required) {
          delete param.notNull;
          if (param.default !== undefined)
            cdsParam["default"] = { val: param.default };
        }
        const name = cdsName(param.name);
        if (name !== param.name) cdsParam["@openapi.name"] = param.name;
        cdsOperation.params[name] = cdsParam;
      }

      const schema = context.v3
        ? requestBodySchema(context, operation.requestBody, input.components)
        : v2Schema(context, bodyParam?.schema, operation.consumes);
      if (schema) {
        cdsOperation.params.body = cdsType(context, schema);
        cdsOperation.params.body["@openapi.in"] = "body";
      }

      if (!operation.responses)
        throw new Error(
          `TODO: no responses for path ${path}, method ${method}`,
        );

      const successCode = Object.keys(operation.responses || {}).find((r) =>
        r.startsWith("2"),
      );
      if (successCode) {
        let response = operation.responses[successCode];
        if (response?.$ref) {
          // resolve reuse response
          const expectedPrefix = context.v3
            ? "#/components/responses/"
            : "#/responses/";
          if (!response.$ref.startsWith(expectedPrefix))
            throw new Error(
              `TODO: unexpected reference ${response.$ref} in ${successCode} response for method ${method} of path ${path}`,
            );
          else
            response =
              reuseResponses[response.$ref.substring(expectedPrefix.length)];
        }
        const responseSchema = context.v3
          ? v3Schema(context, response)
          : v2Schema(context, response.schema, operation.produces);
        if (responseSchema)
          cdsOperation.returns = cdsType(context, responseSchema);
        else if (method === "get")
          cdsOperation.returns = { type: "cds.Boolean" };
      } else if (method === "get")
        cdsOperation.returns = { type: "cds.Boolean" };

      const operationName = `${context.serviceName}.${nameFromPath(
        path,
        method,
      )}`;

      if (csn.definitions[operationName]) {
        const existing = pathAndMethod(csn.definitions[operationName]);
        throw new Error(
          `Name collision: same name ${operationName} for method ${method} of path ${path} and method ${existing.method.toLowerCase()} of path ${existing.path
          }`,
        );
      }
      csn.definitions[operationName] = cdsOperation;
    }
  }
}

function requestBodySchema(context, requestBody, components) {
  while (requestBody?.$ref) {
    const expectedPrefix = "#/components/requestBodies/";
    if (!requestBody.$ref.startsWith(expectedPrefix)) {
      throw new Error(
        `Unexpected request body reference ${requestBody.$ref}`,
      );
    } else {
      requestBody =
        components?.requestBodies[
        requestBody.$ref.substring(expectedPrefix.length)
        ];
    }
  }

  return v3Schema(context, requestBody);
}

function v3Schema(context, body) {
  if (!body?.content) return undefined;

  const contentTypes = Object.keys(body.content);
  if (contentTypes.includes("application/json"))
    return body.content["application/json"].schema;

  if (contentTypes.length === 0) return undefined;

  // if (contentTypes.length > 1)
  //   context.messages.push({
  //     message: `Multiple requestBody content-types not including application/json`,
  //     input: contentTypes,
  //   });

  const contentType = contentTypes[0];

  return {
    $contentType: contentType,
    ...body.content[contentType]?.schema,
  };
}

function v2Schema(context, schema, contentTypes) {
  if (
    !schema ||
    !contentTypes ||
    contentTypes.includes("application/json") ||
    contentTypes.includes("application/json;charset=utf-8") ||
    contentTypes.includes("application/json;charset=UTF-8")
  )
    return schema;

  // take the first content type if there are multiple
  const contentType = contentTypes[0];

  return {
    $contentType: contentType,
    ...schema,
  };
}

function cdsType(
  context,
  schema,
  arrayItem = false,
  namedType = false,
  forParameter = false,
) {
  let type = {};
  let hasIncludes = false;

  if (!arrayItem) if (schema.title) type["@title"] = schema.title;
  if (schema.description) type["@description"] = schema.description;
  if (schema.$contentType && schema.$contentType !== "*/*")
    type["@openapi.contentType"] = schema.$contentType;

  if (schema.$ref) {
    const refType = referencedType(context, schema.$ref);
    let nRefType = refType;
    if (refType.schema?.$ref)
      nRefType = indirectlyReferencedType(context, refType.schema);
    if (namedType && normalizeSchemaType(nRefType.schema) === "object") {
      type.kind = "type";
      type.includes = [refType.name];
      type.elements = {};
    } else {
      type.type = refType.name;
      if (schema.maxLength) type.length = schema.maxLength;
    }
    return type;
  }

  let schemaType = normalizeSchemaType(schema);

  switch (schemaType) {
    case "array":
      //TODO: complain if "xml"
      if (schema.items) {
        const itemsType = cdsType(
          context,
          schema.items,
          true,
          false,
          forParameter,
        );
        const annotations = Object.keys(itemsType).filter((k) =>
          k.startsWith("@"),
        );
        // make anonymous type for item if
        // - item has annotation
        // - item has default
        // - item is itself an array (inline or via $ref)
        if (isArrayType(context, schema.items, itemsType)) {
          // OData forbids chained array-of: wrap inner array in { value: [...] } struct.
          const wrapper = {
            elements: { value: itemsType },
          };
          type.items = anonymousType(context, wrapper);
        } else if (annotations.length > 0 || itemsType.default) {
          type.items = anonymousType(context, itemsType);
        } else {
          type.items = itemsType;
        }
      } else {
        type = someJSON(context, schema, arrayItem, type);
      }
      break;

    case "boolean":
      type.type = "cds.Boolean";
      addDefault(type, schema, forParameter);
      break;

    case "file":
      type.type = "cds.String";
      break;

    case "integer":
      type.type = "cds.Integer";
      if (schema.format === "int64") type.type = "cds.Integer64";
      addDefault(type, schema, forParameter);
      addPrimitiveExample(type, schema);
      break;

    case "number":
      type.type = "cds.Decimal";
      if (schema.format === "double" || schema.format === "float")
        type.type = "cds.Double";
      addDefault(type, schema, forParameter);
      addPrimitiveExample(type, schema);
      break;

    case "object":
      type.elements = {};
      //TODO: discriminator(context, type, schema);

      if (schema.anyOf) {
        type["@openapi.anyOf"] = JSON.stringify(schema.anyOf);
        type["@open"] = true;
      }
      if (schema.oneOf) {
        type["@openapi.oneOf"] = JSON.stringify(schema.oneOf);
        type["@open"] = true;
      }

      for (const subSchema of schema.allOf || []) {
        if (subSchema.$ref) {
          hasIncludes = true;
          const refType = referencedType(context, subSchema.$ref);
          if (!type.includes) type.includes = [];
          type.includes.push(refType.name);
        } else if (subSchema.type === "object" || subSchema.properties) {
          //TODO: what if subSchema has allOf/...? Better recurse here and "merge" the types?
          structElements(context, type, subSchema);
        } else {
          // should not get here
          throw new Error(`Error: object with non-object sub-schema`);
        }
      }

      structElements(context, type, schema);

      if (!namedType && hasIncludes) {
        type = anonymousType(context, type);
      }

      break;

    case "string":
      switch (schema.format) {
        case "binary":
          type.type = "cds.LargeBinary";
          break;
        case "date":
          type.type = "cds.Date";
          break;
        case "date-time":
          type.type = "cds.Timestamp";
          break;
        case "time":
          type.type = "cds.Time";
          break;
        case "uuid":
          type.type = "cds.UUID";
          break;
        default:
          type.type = "cds.String";
          if (schema.maxLength) type.length = schema.maxLength;
      }
      if (Array.isArray(schema.enum)) {
        type["@assert.range"] = true;
        type.enum = Object.fromEntries(
          schema.enum
            .filter((val) => val !== null)
            .map((val) => {
              const key = cdsName(val);
              return key === val ? [val, {}] : [key, { val }];
            }),
        );
      }
      if (schema.pattern) type["@assert.format"] = schema.pattern;
      addDefault(type, schema, forParameter);
      addPrimitiveExample(type, schema);
      break;

    case undefined:
      schemaType = bestMatchingType(context, schema);
      if (
        (!namedType || schemaType !== "object") &&
        schema.allOf &&
        schema.allOf.length === 1 &&
        Object.keys(schema).filter(
          (k) =>
            !["description", "nullable"].includes(k) && !k.startsWith("x-"),
        ).length === 1
      ) {
        const normalizedSchema = { ...schema.allOf[0] };
        if (schema.description)
          normalizedSchema.description = schema.description;
        type = cdsType(
          context,
          normalizedSchema,
          arrayItem,
          namedType,
          forParameter,
        );
        break;
      }
      if (
        schema.allOf &&
        schema.allOf.length === 2 &&
        schema.allOf[0].$ref &&
        !schema.allOf[1].$ref &&
        normalizeSchemaType(schema.allOf[1]) !== "object"
      ) {
        const normalizedSchema = Object.assign(
          { ...schema.allOf[0] },
          schema.allOf[1],
        );
        type = cdsType(
          context,
          normalizedSchema,
          arrayItem,
          namedType,
          forParameter,
        );
        break;
      }

      if (schemaType) {
        schema.type = schemaType;
        type = cdsType(context, schema, arrayItem, namedType, forParameter);
        break;
      }

    // last resort
    // eslint-disable-next-line no-fallthrough
    default:
      type = someJSON(context, schema, arrayItem, type);
      break;
  }
  return type;
}

function isArrayType(context, schema, cdsResult) {
  if (cdsResult.items) return true; // inline array
  if (!schema?.$ref) return false;
  const resolved = indirectlyReferencedType(context, schema);
  return normalizeSchemaType(resolved.schema) === "array";
}

function someJSON(context, schema, arrayItem, type) {
  context.JSON = true;
  const jsonSchema = minimalSchema(schema);
  if (arrayItem && jsonSchema !== "{}") {
    type = anonymousType(context, {
      type: "common.JSON",
      "@openapi.schema": jsonSchema,
    });
  } else {
    type.type = "common.JSON";
    if (jsonSchema !== "{}") type["@openapi.schema"] = jsonSchema;
  }
  return type;
}

function addDefault(type, schema, forParameter) {
  if (schema.default !== undefined) type.default = { val: schema.default };
  if (forParameter) return;
}

function addPrimitiveExample(type, schema) {
  const example = schema.examples?.[0] || schema.example;
  if (!example || example.$ref) return;
  type["@Core.Example.$Type"] = "Core.PrimitiveExampleValue";
  type["@Core.Example.Value"] = example;
}

function minimalSchema(schema) {
  const s = { ...schema };
  delete s.title;
  delete s.description;
  delete s.$contentType;
  return JSON.stringify(s);
}

function anonymousType(context, type) {
  //TODO: construct newName from path leading here instead of using a counter
  // pro: makes imported models more stable
  // con: may cause name clashes
  const newName = `${context.serviceName}.anonymous.type${context.anonymous.length}`;
  context.anonymous.push({ name: newName, type: type });
  return { type: newName };
}

function bestMatchingType(context, schema) {
  if (schema.type) return schema.type;
  let type;
  if (schema.allOf || schema.anyOf || schema.oneOf) {
    const xOf = (schema.allOf || []).concat(
      schema.anyOf || [],
      schema.oneOf || [],
    );
    for (const subSchema of xOf) {
      // determine overall type of this construct
      if (subSchema.$ref) {
        const refType = indirectlyReferencedType(context, subSchema);
        if (!refType.schema) return undefined;

        if (
          refType.schema.allOf ||
          refType.schema.anyOf ||
          refType.schema.oneOf
        ) {
          const subType = bestMatchingType(context, refType.schema);
          type = betterType(type, { type: subType });
        } else type = betterType(type, refType.schema);
      } else {
        //TODO: nested xOf - not yet encountered
        type = betterType(type, subSchema);
      }
    }
  }
  return type;
}

function indirectlyReferencedType(context, subSchema) {
  let refType = { schema: subSchema };
  let limit = 10;
  while (refType.schema?.$ref && limit-- > 0)
    refType = referencedType(context, refType.schema.$ref);
  return refType;
}

function referencedType(context, ref) {
  const expectedPrefix = context.v3
    ? "#/components/schemas/"
    : "#/definitions/";
  if (!ref.startsWith(expectedPrefix)) {
    throw new Error(`TODO: unexpected reference ${ref} in schema.`);
  }
  const schemaName = decodeURIComponent(ref.substring(expectedPrefix.length));
  const schema = context.schemas[schemaName];

  return {
    name: `${context.serviceName}_types.${cdsName(schemaName)}`,
    schema,
  };
}

function normalizeSchemaType(schema) {
  if (!schema) return undefined;
  if (!schema.type && schema.items) return "array";
  if (!schema.type && schema.maxLength) return "string";
  if (!schema.type && schema.pattern) return "string";

  if (!schema.type && schema.enum?.every((v) => typeof v === "string"))
    return "string";

  if (
    !schema.type &&
    (schema.properties ||
      schema.patternProperties ||
      schema.additionalProperties ||
      schema.discriminator)
  )
    return "object";

  let schemaType = schema.type;
  if (Array.isArray(schemaType)) {
    schemaType = schemaType.sort();
    if (schemaType.includes("null")) {
      const index = schemaType.indexOf("null");
      schemaType.splice(index, 1);
    }
    if (schemaType.length === 1) schemaType = schemaType[0];
    if (
      schemaType.length === 2 &&
      schemaType[0] === "integer" &&
      schemaType[1] === "number"
    )
      return "number";
  }
  return schemaType;
}

//TODO: better name :-)
function betterType(currentType, schema) {
  const schemaType = normalizeSchemaType(schema);
  if (currentType === undefined) return schemaType;
  if (currentType === schemaType) return currentType;
  if (currentType === "string" && ["integer", "number"].includes(schemaType))
    return "string";
  if (["integer", "number"].includes(currentType) && schemaType === "string")
    return "string";
  //TODO: more cases here?
  return null;
}

// function discriminator(context, type, schema) {
//   if (!schema.discriminator) return;
//   console.log("hi");
//   const propertyName =
//     schema.discriminator.propertyName || schema.discriminator;
//   type["@openapi.discriminator"] = { propertyName };
//   if (schema.discriminator.mapping) {
//     const mapping = {};
//     for (const [value, reference] of Object.entries(
//       schema.discriminator.mapping
//     )) {
//       mapping[value] = referencedType(context, reference).name;
//     }
//     type["@openapi.discriminator"].mapping = mapping;
//   }
// }

function structElements(context, type, schema) {
  checkCircularReference(schema);
  const schemaName = Object.keys(context.schemas || {}).find(
    (key) => context.schemas[key] === schema,
  );
  const refPath = `#/components/schemas/${schemaName}`;
  //TODO: interpret "required"
  for (const [prop, propSchema] of Object.entries(schema.properties || {})) {
    const name = cdsName(prop);
    //to detect recursive data types
    if (propSchema?.$ref === refPath || propSchema?.items?.$ref === refPath) {
      console.warn(
        `Recursive data type detected: ${schemaName} for the property ${name}`,
      );
    }
    //TODO: check if property "name" already exists and has identical cdsType, warn otherwise
    type.elements[name] = cdsType(context, propSchema);
    if (name !== prop) type.elements[name]["@openapi.name"] = prop;
    // Add @mandatory if the property is in the required array
    if (schema.required && schema.required.includes(prop)) {
      type.elements[name]["@mandatory"] = true;
    }
  }
}

// function to check circular references and throw error if found
function checkCircularReference(schema, visited = new Set()) {
  if (schema.$ref) {
    const ref = schema.$ref;
    if (visited.has(ref)) {
      console.warn(`Circular reference detected: ${ref}`);
    }
    visited.add(ref);
  }

  if (schema.allOf) {
    schema.allOf.forEach((subSchema) =>
      checkCircularReference(subSchema, visited),
    );
  }

  if (schema.anyOf) {
    schema.anyOf.forEach((subSchema) =>
      checkCircularReference(subSchema, visited),
    );
  }

  if (schema.oneOf) {
    schema.oneOf.forEach((subSchema) =>
      checkCircularReference(subSchema, visited),
    );
  }

  if (schema.properties) {
    Object.values(schema.properties).forEach((subSchema) =>
      checkCircularReference(subSchema, visited),
    );
  }

  if (schema.items) {
    checkCircularReference(schema.items, visited);
  }
}
