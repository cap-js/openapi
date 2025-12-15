/**
 * Converts OData CSDL JSON to OpenAPI 3.0.2
*/
const cds = require('@sap/cds');
const { CSDLMeta, nameParts, isIdentifier } = require('./csdl');
const { camelCaseToWords: splitName } = require('./string-util');
const { Diagram } = require('./diagram')
const pluralize = require('pluralize')
const DEBUG = cds.debug('openapi');  // Initialize cds.debug with the 'openapi'

//TODO
// - Core.Example for complex types
// - reduce number of loops over schemas
// - inject $$name into each model element to make parameter passing easier?
// - allow passing additional files for referenced documents
// - delta: headers Prefer and Preference-Applied
// - inline definitions for Edm.* to make OpenAPI documents self-contained
// - both "clickable" and freestyle $expand, $select, $orderby - does not work yet, open issue for OpenAPI UI
// - system query options for actions/functions/imports depending on $Collection
// - 200 response for PATCH
// - ETag for GET / If-Match for PATCH and DELETE depending on @Core.OptimisticConcurrency
// - CountRestrictions for GET collection-valued (containment) navigation - https://issues.oasis-open.org/browse/ODATA-1300
// - InsertRestrictions/NonInsertableProperties
// - InsertRestrictions/NonInsertableNavigationProperties
// - see //TODO comments below

/**
 * @typedef {import('./types').CSDL} CSDL
 * @typedef {import('./types').Paths} Paths
 * @typedef {import('./types').Parameter} Parameter
 * @typedef {import('./types').Response} Response
 * @typedef {import('./types').Schema} Schema
 * @typedef {import('./types').TargetRestrictions} TargetRestrictions
 */

const SUFFIX = {
    read: "",
    create: "-create",
    update: "-update",
};

const TITLE_SUFFIX = {
    "": "",
    "-create": " (for create)",
    "-update": " (for update)",
};

const SYSTEM_QUERY_OPTIONS = [
    "compute",
    "expand",
    "select",
    "filter",
    "search",
    "count",
    "orderby",
    "skip",
    "top",
    "format",
    "index",
    "schemaversion",
    "skiptoken",
    "apply",
];

/**
 * ODM annotations in CDS that should be converted into OpenAPI.
 */
const ODM_ANNOTATIONS = Object.freeze(
    {
        '@ODM.entityName': 'x-sap-odm-entity-name',
        '@ODM.oid': 'x-sap-odm-oid'
    });

const ER_ANNOTATION_PREFIX = '@EntityRelationship'
const ER_ANNOTATIONS = Object.freeze(
    {
        '@EntityRelationship.entityType': 'x-entity-relationship-entity-type',
        '@EntityRelationship.entityIds': 'x-entity-relationship-entity-ids',
        '@EntityRelationship.propertyType': 'x-entity-relationship-property-type',
        '@EntityRelationship.reference': 'x-entity-relationship-reference',
        '@EntityRelationship.compositeReferences': 'x-entity-relationship-composite-references',
        '@EntityRelationship.temporalIds': 'x-entity-relationship-temporal-ids',
        '@EntityRelationship.temporalReferences': 'x-entity-relationship-temporal-references',
        '@EntityRelationship.referencesWithConstantIds': 'x-entity-relationship-references-with-constant-ids'
    });

/**
 * Construct an OpenAPI description from a CSDL document
 * @param {CSDL} csdl CSDL document
 * @param {{ url?: string, servers?: object, odataVersion?: string, scheme?: string, host?: string, basePath?: string, diagram?: boolean, maxLevels?: number }} options Optional parameters
 * @return {object} OpenAPI description
 */
module.exports.csdl2openapi = function (
    csdl,
    {
        url: serviceRoot,
        servers: serversObject,
        odataVersion: odataVersion,
        scheme: scheme = 'https',
        host: host = 'localhost',
        basePath: basePath = '/service-root',
        diagram: diagram = false,
        maxLevels: maxLevels = 5
    } = {}
) {
    // as preProcess below mutates the csdl, copy it before, to avoid side-effects on the caller side
    csdl = JSON.parse(JSON.stringify(csdl))
    csdl.$Version = odataVersion ? odataVersion : '4.01'
    const meta = new CSDLMeta(csdl)
    serviceRoot = serviceRoot ?? (`${scheme}://${host}${basePath}`);
    const queryOptionPrefix = csdl.$Version <= '4.01' ? '$' : '';
    const typesToInline = {}; // filled in schema() and used in inlineTypes()

    /** @type {{ list: { namespace:string, name: string, suffix: string }[], used: Record<string, boolean> }} */
    const requiredSchemas = { list:  [], used: {} };

    const entityContainer = csdl.$EntityContainer ? meta.modelElement(csdl.$EntityContainer) : {};
    if (csdl.$EntityContainer) {
        const serviceName = nameParts(csdl.$EntityContainer).qualifier;
        Object.keys(entityContainer).forEach(element => {
            if (entityContainer[element].$Type) {
                const type = nameParts(entityContainer[element].$Type).name;
                if ((csdl[serviceName]?.[type]?.['@cds.autoexpose'] || csdl[serviceName]?.[type]?.['@cds.autoexposed']) && !entityContainer[type])
                    entityContainer[element]['$cds.autoexpose'] = true;
            }
        });
    }

    const keyAsSegment = entityContainer ? entityContainer[meta.voc.Capabilities.KeyAsSegmentSupported] : {};

    const openapi = {
        openapi: '3.0.2',
        info: getInfo(csdl, entityContainer),
        'x-sap-api-type': 'ODATAV4',
        'x-odata-version': csdl.$Version,
        'x-sap-shortText': getShortText(csdl, entityContainer),
        servers: getServers(serviceRoot, serversObject),
        tags: entityContainer ? getTags(entityContainer) : {},
        paths: entityContainer ? getPaths(entityContainer) : {},
        components: getComponents(csdl, entityContainer)
    };

    const externalDocs = getExternalDoc(csdl);
    if (externalDocs && Object.keys(externalDocs).length > 0) {
        openapi.externalDocs = externalDocs;
    }
    const extensions = getExtensions(csdl, 'root');
    if (extensions && Object.keys(extensions).length > 0) {
        Object.assign(openapi, extensions);
    }

    // function to read @OpenAPI.Extensions and get them in the generated openAPI document
    function getExtensions(csdl, level) {
        const extensionObj = {};
        let containerSchema = {};
        if (level ==='root'){
            const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
            containerSchema = namespace ? csdl[namespace] : {};
        }
        else if(level === 'schema' || level === 'operation'){
            containerSchema = csdl;
        }

        for (const [key, value] of Object.entries(containerSchema)) {
            if (key.startsWith('@OpenAPI.Extensions')) {
                const annotationProperties = key.split('@OpenAPI.Extensions.')[1] ?? ''
                const keys = annotationProperties.split('.');
                if (!keys[0].startsWith("x-sap-")) {
                    keys[0] = (keys[0].startsWith("sap-") ? "x-" : "x-sap-") + keys[0];
                }
                if (keys.length === 1) {
                    extensionObj[keys[0]] = value;
                } else {
                    nestedAnnotation(extensionObj, keys[0], keys, value);
                }
            }
        }
        const extensionEnums = {
            "x-sap-compliance-level": {allowedValues: ["sap:base:v1", "sap:core:v1", "sap:core:v2" ] } ,
            "x-sap-api-type": {allowedValues: [ "ODATA", "ODATAV4", "REST" , "SOAP"] },
            "x-sap-direction": {allowedValues: ["inbound", "outbound", "mixed"] , default : "inbound" },
            "x-sap-dpp-entity-semantics": {allowedValues: ["sap:DataSubject", "sap:DataSubjectDetails", "sap:Other"] },
            "x-sap-dpp-field-semantics": {allowedValues: ["sap:DataSubjectID", "sap:ConsentID", "sap:PurposeID", "sap:ContractRelatedID", "sap:LegalEntityID", "sap:DataControllerID", "sap:UserID", "sap:EndOfBusinessDate", "sap:BlockingDate", "sap:EndOfRetentionDate"] },
        };
        checkForExtensionEnums(extensionObj, extensionEnums);

        const extensionSchema = {
            "x-sap-stateInfo": ['state', 'deprecationDate', 'decomissionedDate', 'link'],
            "x-sap-ext-overview": ['name', 'values'],
            "x-sap-deprecated-operation" : ['deprecationDate', 'successorOperationRef', "successorOperationId"],
            "x-sap-odm-semantic-key" : ['name', 'values'],
        };

        checkForExtentionSchema(extensionObj, extensionSchema);
        return extensionObj;
    }

    function checkForExtensionEnums(extensionObj, extensionEnums){
        for (const [key, value] of Object.entries(extensionObj)) {
            if(extensionEnums[key] && extensionEnums[key].allowedValues && !extensionEnums[key].allowedValues.includes(value)){
                if(extensionEnums[key].default){
                    extensionObj[key] = extensionEnums[key].default;
                }
                else{
                delete extensionObj[key];
                }
            }
        }
    }

    function checkForExtentionSchema(extensionObj, extensionSchema) {
        for (const [key, value] of Object.entries(extensionObj)) {
            if (extensionSchema[key]) {
                if (Array.isArray(value)) {
                    extensionObj[key] = value.filter((v) => extensionSchema[key].includes(v));
                } else if (typeof value === "object" && value !== null) {
                    for (const field in value) {
                        if (!extensionSchema[key].includes(field)) {
                            delete extensionObj[key][field];
                        }
                    }
                }
            }
        }
    }


    function nestedAnnotation(resObj, openapiProperty, keys, value) {
        if (resObj[openapiProperty] === undefined) {
            resObj[openapiProperty] = {};
        }

        let node = resObj[openapiProperty];

        // traverse the annotation property and define the objects if they're not defined
        for (let nestedIndex = 1; nestedIndex < keys.length - 1; nestedIndex++) {
            const nestedElement = keys[nestedIndex];
            if (node[nestedElement] === undefined) {
                node[nestedElement] = {};
            }
            node = node[nestedElement];
        }

        // set value annotation property
        node[keys[keys.length - 1]] = value;
    }

    if (!csdl.$EntityContainer) {
        // explicit cast required as .servers and .tags are not declared as optional
        delete /**@type{any}*/(openapi).servers;
        delete /**@type{any}*/(openapi).tags;
    }

    security(openapi, entityContainer);

    return openapi;


    function getContainerSchema(csdl) {
        const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
        return namespace ? csdl[namespace] : {};
    }

    /**
     * Construct the Info Object
     * @param {CSDL} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {object} Info Object
     */
    function getInfo(csdl, entityContainer) {
        const containerSchema = getContainerSchema(csdl)
        let description;
        if (entityContainer && entityContainer[meta.voc.Core.LongDescription]) {
            description = entityContainer[meta.voc.Core.LongDescription];
        }
        else if (containerSchema && containerSchema[meta.voc.Core.LongDescription]) {
            description = containerSchema[meta.voc.Core.LongDescription];
        }
        else if (entityContainer && entityContainer[meta.voc.Core.Description]) {
            description = entityContainer[meta.voc.Core.Description];
        }
        else if (containerSchema && containerSchema[meta.voc.Core.Description]) {
            description = containerSchema[meta.voc.Core.Description];
        }
        else {
            description = "Use @Core.LongDescription: '...' or @Core.Description: '...' on your CDS service to provide a meaningful description.";
        }
        description += (diagram ? new Diagram(meta).getResourceDiagram(entityContainer) : '');
        let title;
        if (entityContainer && entityContainer[meta.voc.Common.Label]) {
            title = entityContainer[meta.voc.Common.Label];
        }
        else {
            title = "Use @title: '...' on your CDS service to provide a meaningful title.";
        }
        return {
            title,
            description: csdl.$EntityContainer ? description : '',
            version: containerSchema[meta.voc.Core.SchemaVersion] || ''
        };
    }

    /**
     * Construct the externalDocs Object
     * @param {CSDL} csdl CSDL document
     * @return {object} externalDocs Object
     */
    function getExternalDoc(csdl) {
        const containerSchema = getContainerSchema(csdl)
        const externalDocs = {};
        if (containerSchema?.['@OpenAPI.externalDocs.description']) {
            externalDocs.description = containerSchema['@OpenAPI.externalDocs.description'];
        }
        if (containerSchema?.['@OpenAPI.externalDocs.url']) {
            externalDocs.url = containerSchema['@OpenAPI.externalDocs.url'];
        }
        return externalDocs;
    }

    /**
     * Construct the short text
     * @param {CSDL} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {string} short text
     */
    function getShortText(csdl, entityContainer) {
        const containerSchema = getContainerSchema(csdl);
        let shortText;
        if (entityContainer && entityContainer[meta.voc.Core.Description]) {
            shortText = entityContainer[meta.voc.Core.Description];
        }
        else if (containerSchema && containerSchema[meta.voc.Core.Description]) {
            shortText = containerSchema[meta.voc.Core.Description];
        }
        else {
            shortText = "Use @Core.Description: '...' on your CDS service to provide a meaningful short text.";
        }
        return shortText;
    }

    /**
     * Construct an array of Server Objects
     * @param {object} serviceRoot The service root
     * @param {object} serversObject Input servers object
     * @return {{url: string}[]} The list of servers
     */
    function getServers(serviceRoot, serversObject) {
        let servers;
        if (serversObject) {
            try {
                servers = JSON.parse(serversObject);
            } catch {
                throw new Error(`The input server object is invalid.`);
            }

            if (!servers.length) {
                throw new Error(`The input server object should be an array.`);
            }
        } else {
            servers = [{ url: serviceRoot }];
        }
        return servers;
    }

    /**
     * Construct an array of Tag Objects from the entity container
     * @param {object} container The entity container
     * @return {Array} The list of tags
     */
    function getTags(container) {
        /** @type {Map<string, { name: string, description?: string }>} */
        const tags = new Map();
        // all entity sets and singletons
        Object.keys(container)
            .filter(name => isIdentifier(name) && container[name].$Type)
            .forEach(child => {
                const type = meta.modelElement(container[child].$Type) || {};
                const tag = {
                    name: type[meta.voc.Common.Label] || child
                };
                const description = container[child][meta.voc.Core.Description] || type[meta.voc.Core.Description];
                if (description) tag.description = description;
                tags.set(tag.name, tag);
            });
        return Array
            .from(tags.values())
            .map(normaliseTag)
            .sort((pre, next) => pre.name.localeCompare(next.name));
    }

    /**
     * @template {string | { name: string }} T
     * @param {T} tag
     * @returns {T}
     */
    function normaliseTag(tag) {
        const normalise = s => s
            .replaceAll('_', ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2');  // "camelCase" to "camel Case"
        if (typeof tag === 'string') {
            tag = normalise(tag);
        } else {
            tag.name = normalise(tag.name);
        }
        return tag;
    }

    /**
     * Construct the Paths Object from the entity container
     * @param {object} container Entity container
     * @return {Paths} Paths Object
     */
    function getPaths(container) {
        /** @type {Paths} */
        const paths = {};
        const resources = Object.keys(container).filter(name => isIdentifier(name));
        resources.forEach(name => {
            const child = container[name];
            if (child.$Type) {
                const type = meta.modelElement(child.$Type);
                const sourceName = (type && type[meta.voc.Common.Label]) || name;
                // entity sets and singletons are almost containment navigation properties
                child.$ContainsTarget = true;
                pathItems(paths, `/${name}`, [], child, child, sourceName, sourceName, child, 0, '');
            } else if (child.$Action) {
                pathItemActionImport(paths, name, child);
            } else if (child.$Function) {
                pathItemFunctionImport(paths, name, child);
            } else {
                DEBUG?.(`Unrecognized entity container child: ${name}`);
            }
        })
        if (resources.length > 0) pathItemBatch(paths, container);
        return Object.keys(paths).sort().reduce((p, c) => (p[c] = paths[c], p), {});
    }

    /**
     * Add path and Path Item Object for a navigation segment
     * @param {Paths} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     * @param {object} root Root model element
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {string} navigationPath Path for finding navigation restrictions
     */
    function pathItems(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath) {
        const name = prefix.substring(prefix.lastIndexOf('/') + 1);
        const type = meta.modelElement(element.$Type);
        const pathItem = {};
        const restrictions = navigationPropertyRestrictions(root, navigationPath);
        const nonExpandable = nonExpandableProperties(root, navigationPath);

        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) pathItem.parameters = prefixParameters;

        operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, false, nonExpandable);
        if (!root['$cds.autoexpose'] && element.$Collection && (element.$ContainsTarget || level < 2 && target)) {
            operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions);
        }
        pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);

        if (element.$ContainsTarget) {
            if (element.$Collection) {
                if (level < maxLevels)
                    pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, nonExpandable);
            } else {
                if (!root['$cds.autoexpose']) {
                    operationUpdate(pathItem, element, name, sourceName, target, level, restrictions);
                    if (element.$Nullable) {
                        operationDelete(pathItem, element, name, sourceName, target, level, restrictions);
                    }
                }
                pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);
                pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceName, level, navigationPath);
            }
        }

        if (Object.keys(pathItem).filter((i) => i !== "parameters").length === 0)
            delete paths[prefix];
    }

    /**
     * Find navigation restrictions for a navigation path
     * @param {object} root Root model element
     * @param {string} navigationPath Path for finding navigation restrictions
     * @return Navigation property restrictions of navigation segment
     */
    function navigationPropertyRestrictions(root, navigationPath) {
        const navigationRestrictions = root[meta.voc.Capabilities.NavigationRestrictions] ?? {};
        return (navigationRestrictions.RestrictedProperties ?? []).find(item => navigationPropertyPath(item.NavigationProperty) == navigationPath)
            ?? {};
    }

    /**
     * Find non-expandable properties for a navigation path
     * @param {object} root Root model element
     * @param {string} navigationPath Path for finding navigation restrictions
     * @return Navigation property restrictions of navigation segment
     */
    function nonExpandableProperties(root, navigationPath) {
        const expandRestrictions = root[meta.voc.Capabilities.ExpandRestrictions] || {};
        const prefix = navigationPath.length === 0 ? '' : `${navigationPath}/`
        const from = prefix.length
        const nonExpandable = []
        for (const path of (expandRestrictions.NonExpandableProperties ?? [])) {
            if (path.startsWith(prefix)) {
                nonExpandable.push(path.substring(from))
            }
        }
        return nonExpandable;
    }

    /**
     * Add path and Path Item Object for a navigation segment with key
     * @param {Paths} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element of navigation segment
     * @param {object} root Root model element
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {null | object} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {string} navigationPath Path for finding navigation restrictions
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, nonExpandable) {
        const targetIndexable = target == null || target[meta.voc.Capabilities.IndexableByKey] != false;
        if (restrictions.IndexableByKey == true || restrictions.IndexableByKey != false && targetIndexable) {
            const name = prefix.substring(prefix.lastIndexOf('/') + 1);
            const type = meta.modelElement(element.$Type);
            const key = entityKey(type, level);
            if (key.parameters.length > 0) {
                const path = prefix + key.segment;
                const parameters = prefixParameters.concat(key.parameters);
                const pathItem = { parameters };
                paths[path] = pathItem;

                operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, true, nonExpandable);
                if (!root['$cds.autoexpose']) {
                    operationUpdate(pathItem, element, name, sourceName, target, level, restrictions, true);
                    operationDelete(pathItem, element, name, sourceName, target, level, restrictions, true);
                }
                if (Object.keys(pathItem).filter((i) => i !== "parameters").length === 0)
                    delete paths[path];

                pathItemsForBoundOperations(paths, path, parameters, element, sourceName, true);
                pathItemsWithNavigation(paths, path, parameters, type, root, sourceName, level, navigationPath);
            }
        }
    }

    /**
     * Construct Operation Object for create
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions) {
        const insertRestrictions = restrictions.InsertRestrictions || target?.[meta.voc.Capabilities.InsertRestrictions] || {};
        const countRestrictions = target?.[meta.voc.Capabilities.CountRestrictions]?.Countable === false // count property will be added if CountRestrictions is false
        if (insertRestrictions.Insertable !== false) {
            const lname = pluralize.singular(splitName(name));
            const type = meta.modelElement(element.$Type);
            pathItem.post = {
                summary: insertRestrictions.Description || operationSummary('Creates', name, sourceName, level, true, true),
                tags: [normaliseTag(sourceName)],
                requestBody: {
                    description: type && type[meta.voc.Core.Description] || `New ${lname}`,
                    required: true,
                    content: {
                        'application/json': {
                            schema: ref(element.$Type, SUFFIX.create),
                        }
                    }
                },
                responses: response(201, `Created ${lname}`, { $Type: element.$Type }, insertRestrictions.ErrorResponses, !countRestrictions),
            };
            if (insertRestrictions.LongDescription) pathItem.post.description = insertRestrictions.LongDescription;
            if (targetName && sourceName != targetName) pathItem.post.tags.push(normaliseTag(targetName));
            customParameters(pathItem.post, insertRestrictions);
        }
    }

    /**
     * Construct operation summary
     * @param {string} operation Operation (verb)
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {number} level Number of navigation segments so far
     * @param {boolean} collection Access a collection
     * @param {boolean} byKey Access by key
     * @return Operation Text
     */
    function operationSummary(operation, name, sourceName, level, collection, byKey) {
        const lname = splitName(name);
        const sname = splitName(sourceName);

        return `${operation} ${
             byKey ? 'a single ' : (collection ? 'a list of ' : '')
             }${byKey ? pluralize.singular(lname) : lname
            //TODO: suppress "a" for all singletons
             }${level == 0 ? '' : (level == 1 && sname == 'me' ? ' of me' : ` of a ${pluralize.singular(sname)}`)
             }.`
    }

    /**
     * Construct Operation Object for read
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {string} targetName Name of path target
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {boolean} byKey Read by key
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, byKey, nonExpandable) {
        const targetRestrictions = target?.[meta.voc.Capabilities.ReadRestrictions];
        const readRestrictions = restrictions.ReadRestrictions || targetRestrictions || {};
        const readByKeyRestrictions = readRestrictions.ReadByKeyRestrictions;
        let readable = true;
        const countRestrictions = target && (target[meta.voc.Capabilities.CountRestrictions]?.Countable === false);
        if (byKey && readByKeyRestrictions && readByKeyRestrictions.Readable !== undefined)
            readable = readByKeyRestrictions.Readable;
        else if (readRestrictions.Readable !== undefined)
            readable = readRestrictions.Readable;

        if (readable) {
            let descriptions = (level == 0 ? targetRestrictions : restrictions.ReadRestrictions) || {};
            if (byKey) descriptions = descriptions.ReadByKeyRestrictions || {};
            const lname = splitName(name);
            const collection = !byKey && element.$Collection;
            const operation = {
                summary: descriptions.Description || operationSummary('Retrieves', name, sourceName, level, element.$Collection, byKey),
                tags: [normaliseTag(sourceName)],
                parameters: [],
                responses: response(200, `Retrieved ${byKey ? pluralize.singular(lname) : lname}`, { $Type: element.$Type, $Collection: collection },
                    byKey ? readByKeyRestrictions?.ErrorResponses : readRestrictions?.ErrorResponses, !countRestrictions)
            };
            const deltaSupported = element[meta.voc.Capabilities.ChangeTracking] && element[meta.voc.Capabilities.ChangeTracking].Supported;
            if (!byKey && deltaSupported) {
                // @ts-expect-error - set above
                operation.responses[200].content['application/json'].schema.properties['@odata.deltaLink'] = {
                    type: 'string',
                    example: `${basePath}/${name}?$deltatoken=opaque server-generated token for fetching the delta`
                }
            }
            if (descriptions.LongDescription) operation.description = descriptions.LongDescription;
            if (target && sourceName != targetName) operation.tags.push(normaliseTag(targetName));
            customParameters(operation, byKey ? readByKeyRestrictions || readRestrictions : readRestrictions);

            if (collection) {
                // @ts-expect-error - see FIXME in optionTop and optionSkip
                optionTop(operation.parameters, target, restrictions);
                // @ts-expect-error
                optionSkip(operation.parameters, target, restrictions);
                if (csdl.$Version >= '4.0') optionSearch(operation.parameters, target, restrictions);
                // @ts-expect-error
                optionFilter(operation.parameters, target, restrictions);
                optionCount(operation.parameters, target);
                optionOrderBy(operation.parameters, element, target, restrictions);
            }

            optionSelect(operation.parameters, element, target, restrictions);
            optionExpand(operation.parameters, element, target, nonExpandable);

            pathItem.get = operation;
        }
    }

    /**
     * Add custom headers and query options
     * @param {object} operation Operation object to augment
     * @param {object} restrictions Restrictions for operation
     */
    function customParameters(operation, restrictions) {
        if (
            !operation.parameters &&
            (restrictions.CustomHeaders || restrictions.CustomQueryOptions)
        )
            operation.parameters = [];
        for (const custom of restrictions.CustomHeaders || []) {
            operation.parameters.push(customParameter(custom, "header"));
        }

        for (const custom of restrictions.CustomQueryOptions || []) {
            operation.parameters.push(customParameter(custom, "query"));
        }
    }

    /**
     * Construct custom parameter
     * @param {object} custom custom parameter in OData format
     * @param {string} location "header" or "query"
     */
    function customParameter(custom, location) {
        return {
            name: custom.Name,
            in: location,
            required: custom.Required || false,
            ...(custom.Description && { description: custom.Description }),
            schema: {
                type: "string",
                ...(custom.DocumentationURL && {
                    externalDocs: { url: custom.DocumentationURL },
                }),
                //TODO: Examples
            },
        };
    }

    /**
     * Add parameter for query option $count
     * @param {Array} parameters Array of parameters to augment
     * @param {null | TargetRestrictions[]} target Target container child of path
     */
    function optionCount(parameters, target) {
        const targetRestrictions = target?.[meta.voc.Capabilities.CountRestrictions];
        const targetCountable = target == null
            || targetRestrictions == null
            || targetRestrictions.Countable !== false;

        if (targetCountable) {
            parameters.push({

                $ref: '#/components/parameters/count'
            });
        }
    }

    /**
     * Add parameter for query option $expand
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {array} nonExpandable Non-expandable navigation properties
     */
    function optionExpand(parameters, element, target, nonExpandable) {
        const targetRestrictions = target?.[meta.voc.Capabilities.ExpandRestrictions];
        const supported = targetRestrictions == null || targetRestrictions.Expandable != false;
        if (supported) {
            const expandItems = ['*'].concat(navigationPaths(element).filter(path => !nonExpandable.includes(path)));
            if (expandItems.length > 1) {
                parameters.push({
                    name: `${queryOptionPrefix}expand`,
                    description: (targetRestrictions && targetRestrictions[meta.voc.Core.Description])
                        || 'The value of $expand query option is a comma-separated list of navigation property names, \
stream property names, or $value indicating the stream content of a media-entity. \
The corresponding related entities and stream values will be represented inline, \
see [Expand](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionexpand)',
                    in: 'query',
                    explode: false,
                    schema: {
                        type: 'array',
                        uniqueItems: true,
                        items: {
                            type: 'string',
                            enum: expandItems
                        }
                    }
                });
            }
        }
    }

    /**
     * Collect navigation paths of a navigation segment and its potentially structured components
     * @param {object} element Model element of navigation segment
     * @param {string} prefix Navigation prefix
     * @param {number} level Number of navigation segments so far
     * @return {Array} Array of navigation property paths
     */
    function navigationPaths(element, prefix = '', level = 0) {
        const paths = [];
        const type = meta.modelElement(element.$Type);
        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(key => {
            if (properties[key].$Kind == 'NavigationProperty') {
                paths.push(prefix + key)
            } else if (properties[key].$Type && level < maxLevels) {
                paths.push(...navigationPaths(properties[key], `${prefix + key}/`, level + 1));
            }
        })
        return paths;
    }

    /**
     * Add parameter for query option $filter
     * @param {Array} parameters Array of parameters to augment
     * @param {null | TargetRestrictions} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionFilter(parameters, target, restrictions) {
        const filterRestrictions = restrictions.FilterRestrictions || target?.[meta.voc.Capabilities.FilterRestrictions] || {};

        if (filterRestrictions.Filterable !== false) {
            const filter = {
                name: `${queryOptionPrefix}filter`,
                description: filterRestrictions[meta.voc.Core.Description]
                    || 'Filter items by property values, see [Filtering](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionfilter)',
                in: 'query',
                schema: {
                    type: 'string'
                }
            };
            if (filterRestrictions.RequiresFilter)
                filter.required = true;
            if (filterRestrictions.RequiredProperties) {
                filter.description += '\n\nRequired filter properties:';
                filterRestrictions.RequiredProperties.forEach(
                    item => filter.description += `\n- ${propertyPath(item)}`
                );
            }
            parameters.push(filter);
        }
    }

    /**
     * Add parameter for query option $orderby
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionOrderBy(parameters, element, target, restrictions) {
        const sortRestrictions = restrictions.SortRestrictions || target?.[meta.voc.Capabilities.SortRestrictions] || {};

        if (sortRestrictions.Sortable !== false) {
            const nonSortable = {};
            (sortRestrictions.NonSortableProperties || []).forEach(name => {
                nonSortable[propertyPath(name)] = true;
            });
            const orderbyItems = [];
            primitivePaths(element).filter(property => !nonSortable[property]).forEach(property => {
                orderbyItems.push(property);
                orderbyItems.push(`${property} desc`);
            });
            if (orderbyItems.length > 0) {
                parameters.push({
                    name: `${queryOptionPrefix}orderby`,
                    description: sortRestrictions[meta.voc.Core.Description]
                        || 'Order items by property values, see [Sorting](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionorderby)',
                    in: 'query',
                    explode: false,
                    schema: {
                        type: 'array',
                        uniqueItems: true,
                        items: {
                            type: 'string',
                            enum: orderbyItems
                        }
                    }
                });
            }
        }
    }

    /**
     * Unpack EnumMember value if it uses CSDL JSON CS01 style, like CAP does
     * @param {string | object} member Qualified name of referenced type
     * @return {object} Reference Object
     */
    function enumMember(member) {
        if (typeof member == 'string')
            return member;
        else if (typeof member == 'object')
            return member.$EnumMember;
    }

    /**
     * Unpack NavigationPropertyPath value if it uses CSDL JSON CS01 style, like CAP does
     * @param {string | object} path Qualified name of referenced type
     * @return {object} Reference Object
     */
    function navigationPropertyPath(path) {
        if (typeof path == 'string')
            return path;
        return path.$NavigationPropertyPath;
    }

    /**
     * Unpack PropertyPath value if it uses CSDL JSON CS01 style, like CAP does
     * @param {string | object} path Qualified name of referenced type
     * @return {object} Reference Object
     */
    function propertyPath(path) {
        if (typeof path == 'string')
            return path;
        return path.$PropertyPath;
    }

    /**
     * Collect primitive paths of a navigation segment and its potentially structured components
     * @param {object} element Model element of navigation segment
     * @param {string} prefix Navigation prefix
     * @return {Array} Array of primitive property paths
     */
    function primitivePaths(element, prefix = '') {
        const paths = [];
        const elementType = meta.modelElement(element.$Type);

        if (!elementType) {
            DEBUG?.(`Unknown type for element: ${JSON.stringify(element)}`);
            return paths;
        }

        const propsOfType = propertiesOfStructuredType(elementType);
        const ignore = Object.entries(propsOfType)
            .filter(entry => entry[1].$Kind !== 'NavigationProperty')
            .filter(entry => entry[1].$Type)
            .filter(entry => nameParts(entry[1].$Type).qualifier !== 'Edm')
            .filter(entry => !meta.modelElement(entry[1].$Type));

        // Keep old logging
        ignore.forEach(entry => DEBUG?.(`Unknown type for element: ${JSON.stringify(entry)}`));

        const properties = Object.entries(propsOfType)
            .filter(entry => entry[1].$Kind !== 'NavigationProperty')
            .filter(entry => !ignore.includes(entry))
            .map(entryToProperty({ path: prefix, typeRefChain: [] }));

        for (let i = 0; i < properties.length; i++) {
            const property = properties[i];
            if (!property.isComplex) {
                paths.push(property.path);
                continue;
            }

            const typeRefChainTail = property.typeRefChain[property.typeRefChain.length - 1];

            // Allow full cycle to be shown (0) times
            if (property.typeRefChain.filter(_type => _type === typeRefChainTail).length > 1) {
                DEBUG?.(`Cycle detected ${property.typeRefChain.join('->')}`);
                continue;
            }

            const expanded = Object.entries(property.properties)
                .filter(pProperty => pProperty[1].$Kind !== 'NavigationProperty')
                .map(entryToProperty(property))
            properties.splice(i + 1, 0, ...expanded);
        }

        return paths;
    }

    function entryToProperty(parent) {

        return function (entry) {
            const key = entry[0];
            const property = entry[1];
            const propertyType = property.$Type && meta.modelElement(property.$Type);

            if (propertyType && propertyType.$Kind && propertyType.$Kind === 'ComplexType') {
                return {
                    properties: propertiesOfStructuredType(propertyType),
                    path: `${parent.path}${key}/`,
                    typeRefChain: parent.typeRefChain.concat(property.$Type),
                    isComplex: true
                }
            }

            return {
                properties: {},
                path: `${parent.path}${key}`,
                typeRefChain: [],
                isComplex: false,
            }
        };
    }

    /**
     * Add parameter for query option $search
     * @param {Array} parameters Array of parameters to augment
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSearch(parameters, target, restrictions) {
        const searchRestrictions = restrictions.SearchRestrictions ?? target?.[meta.voc.Capabilities.SearchRestrictions] ?? {};

        if (searchRestrictions.Searchable !== false) {
            if (searchRestrictions[meta.voc.Core.Description]) {
                parameters.push({
                    name: `${queryOptionPrefix}search`,
                    description: searchRestrictions[meta.voc.Core.Description],
                    in: 'query',
                    schema: { type: 'string' }
                });
            } else {
                parameters.push({ $ref: '#/components/parameters/search' });
            }
        }
    }

    /**
     * Add parameter for query option $select
     * @param {Array} parameters Array of parameters to augment
     * @param {object} element Model element of navigation segment
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSelect(parameters, element, target, restrictions) {
        const selectSupport = restrictions.SelectSupport ?? target?.[meta.voc.Capabilities.SelectSupport] ?? {};

        if (selectSupport.Supported !== false) {
            const type = meta.modelElement(element.$Type) || {};
            const properties = propertiesOfStructuredType(type);
            const selectItems = [];
            Object.keys(properties).filter(key => properties[key].$Kind != 'NavigationProperty').forEach(
                key => selectItems.push(key)
            )
            if (selectItems.length > 0) {
                parameters.push({
                    name: `${queryOptionPrefix}select`,
                    description: 'Select properties to be returned, see [Select](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionselect)',
                    in: 'query',
                    explode: false,
                    schema: {
                        type: 'array',
                        uniqueItems: true,
                        items: {
                            type: 'string',
                            enum: selectItems
                        }
                    }
                });
            }
        }
    }

    /**
     * Add parameter for query option $skip
     * @param {Array} parameters Array of parameters to augment
     * @param {Record<string, boolean>} target Target container child of path  FIXME: this seems to be an incorrect use of TargetRestrictions
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionSkip(parameters, target, restrictions) {
        const supported = restrictions.SkipSupported !== undefined
            ? restrictions.SkipSupported
            : target == null || target[meta.voc.Capabilities.SkipSupported] !== false;

        if (supported) {
            parameters.push({
                $ref: '#/components/parameters/skip'
            });
        }
    }

    /**
     * Add parameter for query option $top
     * @param {Array} parameters Array of parameters to augment
     * @param {Record<string, boolean>} target Target container child of path  FIXME: this seems to be an incorrect use of TargetRestrictions
     * @param {object} restrictions Navigation property restrictions of navigation segment
     */
    function optionTop(parameters, target, restrictions) {
        const supported = restrictions.TopSupported !== undefined
            ? restrictions.TopSupported
            : target == null || target?.[meta.voc.Capabilities.TopSupported] !== false;

        if (supported) {
            parameters.push({
                $ref: '#/components/parameters/top'
            });
        }
    }

    /**
     * Construct Operation Object for update
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {boolean} byKey Update by key
     */
    function operationUpdate(pathItem, element, name, sourceName, target, level, restrictions, byKey = false) {
        const updateRestrictions = restrictions.UpdateRestrictions || target?.[meta.voc.Capabilities.UpdateRestrictions] || {};
        const countRestrictions = target?.[meta.voc.Capabilities.CountRestrictions]?.Countable === false;
        if (updateRestrictions.Updatable !== false && !element[meta.voc.Core.Immutable]) {

            const type = meta.modelElement(element.$Type);
            const operation = {
                summary: updateRestrictions.Description || operationSummary('Changes', name, sourceName, level, element.$Collection, byKey),
                tags: [normaliseTag(sourceName)],
                requestBody: {
                    description: type && type[meta.voc.Core.Description] || 'New property values',
                    required: true,
                    content: {
                        'application/json': {
                            schema: ref(element.$Type, SUFFIX.update),
                        }
                    }
                },
                responses: response(204, "Success", undefined, updateRestrictions.ErrorResponses, !countRestrictions),
            };
            if (updateRestrictions.LongDescription) operation.description = updateRestrictions.LongDescription;
            customParameters(operation, updateRestrictions);
            const updateMethod = updateRestrictions.UpdateMethod?.['$Capabilities.HttpMethod']?.toLowerCase() ?? 'patch';
            pathItem[updateMethod] = operation;
        }
    }

    /**
     * Construct Operation Object for delete
     * @param {object} pathItem Path Item Object to augment
     * @param {object} element Model element of navigation segment
     * @param {string} name Name of navigation segment
     * @param {string} sourceName Name of path source
     * @param {null | TargetRestrictions[]} target Target container child of path
     * @param {number} level Number of navigation segments so far
     * @param {object} restrictions Navigation property restrictions of navigation segment
     * @param {boolean} byKey Delete by key
     */
    function operationDelete(pathItem, element, name, sourceName, target, level, restrictions, byKey = false) {
        const deleteRestrictions = restrictions.DeleteRestrictions || target?.[meta.voc.Capabilities.DeleteRestrictions] || {};
        const countRestrictions = target?.[meta.voc.Capabilities.CountRestrictions]?.Countable === false
        if (deleteRestrictions.Deletable !== false) {
            pathItem.delete = {
                summary: deleteRestrictions.Description || operationSummary('Deletes', name, sourceName, level, element.$Collection, byKey),
                tags: [normaliseTag(sourceName)],
                responses: response(204, "Success", undefined, deleteRestrictions.ErrorResponses, !countRestrictions),
            };
            if (deleteRestrictions.LongDescription) pathItem.delete.description = deleteRestrictions.LongDescription;
            customParameters(pathItem.delete, deleteRestrictions);
        }
    }

    /**
     * Add paths and Path Item Objects for navigation segments
     * @param {object} paths The Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} type Entity type object of navigation segment
     * @param {string} sourceName Name of path source
     * @param {number} level Number of navigation segments so far
     * @param {string} navigationPrefix Path for finding navigation restrictions
     */
    function pathItemsWithNavigation(paths, prefix, prefixParameters, type, root, sourceName, level, navigationPrefix) {
        const navigationRestrictions = root[meta.voc.Capabilities.NavigationRestrictions] ?? {};
        const rootNavigable = level == 0 && enumMember(navigationRestrictions.Navigability) != 'None'
            || level == 1 && enumMember(navigationRestrictions.Navigability) != 'Single'
            || level > 1;

        if (type && level < maxLevels) {
            const properties = navigationPathMap(type);
            Object.keys(properties).forEach(name => {
                const parentRestrictions = navigationPropertyRestrictions(root, navigationPrefix);
                if (enumMember(parentRestrictions.Navigability) == 'Single') return;

                const navigationPath = navigationPrefix + (navigationPrefix.length > 0 ? '/' : '') + name;
                const restrictions = navigationPropertyRestrictions(root, navigationPath);
                if (['Recursive', 'Single'].includes(enumMember(restrictions.Navigability))
                    || restrictions.Navigability == null && rootNavigable) {
                    const targetSetName = root.$NavigationPropertyBinding && root.$NavigationPropertyBinding[navigationPath];
                    const target = entityContainer[targetSetName];
                    const targetType = target && meta.modelElement(target.$Type);
                    const targetName = (targetType && targetType[meta.voc.Common.Label]) || targetSetName;
                    pathItems(paths, `${prefix}/${name}`, prefixParameters, properties[name], root, sourceName, targetName, target, level + 1, navigationPath);
                }
            });
        }
    }

    /**
     * Collect navigation paths of a navigation segment and its potentially structured components
     * @param {object} type Structured type
     * @param {object} map Map of navigation property paths and their types
     * @param {string} prefix Navigation prefix
     * @param {number} level Number of navigation segments so far
     * @return {object} Map of navigation property paths and their types
     */
    function navigationPathMap(type, map = {}, prefix = '', level = 0) {
        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(key => {
            if (properties[key].$Kind == 'NavigationProperty') {
                map[prefix + key] = properties[key];
            } else if (properties[key].$Type && !properties[key].$Collection && level < maxLevels) {
                navigationPathMap(meta.modelElement(properties[key].$Type), map, `${prefix + key}/`, level + 1);
            }
        })
        return map;
    }

    /**
     * Construct map of key names for an entity type
     * @param {object} type Entity type object
     * @return {object} Map of key names
     */
    function keyMap(type) {
        const map = {};
        if (type.$Kind == 'EntityType') {
            const keys = getKey(type) || [];
            keys.forEach(key => {
                if (typeof key == 'string')
                    map[key] = true;
            });
        }
        return map;
    }

    /**
     * Key for path item
     * @param {object} entityType Entity Type object
     * @return {array} Key of entity type or null
     */
    function getKey(entityType) {
        let type = entityType;
        let keys = null;
        while (type) {
            keys = type.$Key;
            if (keys || !type.$BaseType) break;
            type = meta.modelElement(type.$BaseType);
        }
        return keys;
    }

    /**
     * Get description with fallback
     * @param {object} element Model element
     * @param {string} [fallback] Optional fallback text
     * @return {string} Description text
     */
    function getDescriptionWithFallback(element, fallback) {
        return element[meta.voc.Core.LongDescription]
            || element[meta.voc.Core.Description]
            || fallback;
    }

    /**
     * Key for path item
     * @param {object} entityType Entity Type object
     * @param {number} level Number of navigation segments so far
     * @return {object} key: Key segment, parameters: key parameters
     */
    function entityKey(entityType, level) {
        let segment = '';
        const params = [];
        const keys = getKey(entityType) || [];
        const properties = propertiesOfStructuredType(entityType);

        keys.forEach((key, index) => {
            const suffix = level > 0 ? `_${level}` : '';
            if (keyAsSegment)
                segment += '/';
            else {
                if (index > 0) segment += ',';
                if (keys.length != 1) segment += `${key}=`;
            }
            let parameter;
            let property = {};
            if (typeof key == 'string') {
                parameter = key;
                property = properties[key];
            } else {
                parameter = Object.keys(key)[0];
                const segments = key[parameter].split('/');
                property = properties[segments[0]];
                for (let i = 1; i < segments.length; i++) {
                    const complexType = meta.modelElement(property.$Type);
                    const properties = propertiesOfStructuredType(complexType);
                    property = properties[segments[i]];
                }
            }
            const propertyType = property.$Type;
            segment += `${pathValuePrefix(propertyType)}{${parameter}${suffix}}${pathValueSuffix(propertyType)}`;
            const param = {
                description: getDescriptionWithFallback(property, `key: ${parameter}`),
                in: 'path',
                name: parameter + suffix,
                required: true,
                schema: getSchema(property, '', true)
            };
            params.push(param);
        })
        return { segment: (keyAsSegment ? '' : '(') + segment + (keyAsSegment ? '' : ')'), parameters: params };
    }

    /**
      * Prefix for key value in key segment
      * @param {string} typename Qualified name of key property type
      * @return {string} value prefix
      */
    function pathValuePrefix(typename) {
        //TODO: handle other Edm types, enumeration types, and type definitions
        if (['Edm.Int64', 'Edm.Int32', 'Edm.Int16', 'Edm.SByte', 'Edm.Byte',
            'Edm.Double', 'Edm.Single', 'Edm.Date', 'Edm.DateTimeOffset', 'Edm.Guid'].includes(typename)) return '';
        if (keyAsSegment) return '';
        return `'`;
    }

    /**
     * Suffix for key value in key segment
     * @param {string} typename Qualified name of key property type
     * @return {string} value prefix
     */
    function pathValueSuffix(typename) {
        //TODO: handle other Edm types, enumeration types, and type definitions
        if (['Edm.Int64', 'Edm.Int32', 'Edm.Int16', 'Edm.SByte', 'Edm.Byte',
            'Edm.Double', 'Edm.Single', 'Edm.Date', 'Edm.DateTimeOffset', 'Edm.Guid'].includes(typename)) return '';
        if (keyAsSegment) return '';
        return `'`;
    }

    /**
     * Add path and Path Item Object for actions and functions bound to the element
     * @param {Paths} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {object} element Model element the operations are bound to
     * @param {string} sourceName Name of path source
     * @param {boolean} byKey read by key
     */
    function pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName, byKey = false) {
        //ignore operations on navigation path
        if (element.$Kind === "NavigationProperty") {
            return;
        }
        const overloads = meta.boundOverloads[element.$Type + (!byKey && element.$Collection ? '-c' : '')] || [];
        overloads.forEach(item => {
            if (item.overload.$Kind == 'Action')
                pathItemAction(paths, `${prefix}/${item.name}`, prefixParameters, item.name, item.overload, sourceName);
            else
                pathItemFunction(paths, `${prefix}/${item.name}`, prefixParameters, item.name, item.overload, sourceName);
        });
    }

    /**
    * Add path and Path Item Object for an action import
    * @param {Paths} paths Paths Object to augment
    * @param {string} name Name of action import
    * @param {object} child Action import object
    */
    function pathItemActionImport(paths, name, child) {
        const overload = meta.modelElement(child.$Action).find(pOverload => !pOverload.$IsBound);
        pathItemAction(paths, `/${name}`, [], child.$Action, overload, child.$EntitySet, child);
    }

    /**
     * Add path and Path Item Object for action overload
     * @param {Paths} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} actionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     * @param {object} actionImport Action import
     */
    function pathItemAction(paths, prefix, prefixParameters, actionName, overload, sourceName, actionImport = {}) {
        const name = actionName.indexOf('.') === -1 ? actionName : nameParts(actionName).name;
        const pathItem = {
            post: {
                summary: actionImport[meta.voc.Core.Description] || overload[meta.voc.Core.Description] || `Invokes action ${name}`,
                tags: [normaliseTag(overload[meta.voc.Common.Label] || sourceName || 'Service Operations')],
                responses: overload.$ReturnType ? response(200, "Success", overload.$ReturnType, overload[meta.voc.Capabilities.OperationRestrictions]?.ErrorResponses)
                    : response(204, "Success", undefined, overload[meta.voc.Capabilities.OperationRestrictions]?.ErrorResponses),
            }
        };
        const actionExtension = getExtensions(overload, 'operation');
            if (Object.keys(actionExtension).length > 0) {
                Object.assign(pathItem.post, actionExtension);
            }
        const description = actionImport[meta.voc.Core.LongDescription] || overload[meta.voc.Core.LongDescription];
        if (description) pathItem.post.description = description;
        if (prefixParameters.length > 0) pathItem.post.parameters = [...prefixParameters];
        let parameters = overload.$Parameter || [];
        if (overload.$IsBound) parameters = parameters.slice(1);
        if (parameters.length > 0) {
            const requestProperties = {};
            parameters.forEach(p => { requestProperties[p.$Name] = getSchema(p) });
            pathItem.post.requestBody = {
                description: 'Action parameters',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: requestProperties
                        }
                    }
                }
            }
        } else {
            // Actions without parameters still need Content-Type: application/json
            pathItem.post.requestBody = {
                required: false,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object'
                        }
                    }
                }
            }
        }
        customParameters(pathItem.post, overload[meta.voc.Capabilities.OperationRestrictions] || {});
        paths[prefix] = pathItem;
    }

    /**
     * Add path and Path Item Object for an action import
     * @param {Paths} paths Paths Object to augment
     * @param {string} name Name of function import
     * @param {object} child Function import object
     */
    function pathItemFunctionImport(paths, name, child) {
        const overloads = meta.modelElement(child.$Function);
        console.assert(overloads, `Unknown function "${child.$Function}" in function import "${name}"`);
        overloads && overloads.filter(overload => !overload.$IsBound).forEach(overload => pathItemFunction(paths, `/${name}`, [], child.$Function, overload, child.$EntitySet, child));
    }

    /**
     * Add path and Path Item Object for function overload
     * @param {Paths} paths Paths Object to augment
     * @param {string} prefix Prefix for path
     * @param {Array} prefixParameters Parameter Objects for prefix
     * @param {string} functionName Qualified name of function
     * @param {object} overload Function overload
     * @param {string} sourceName Name of path source
     * @param {object} functionImport Function Import
     */
    function pathItemFunction(paths, prefix, prefixParameters, functionName, overload, sourceName, functionImport = {}) {
        const name = functionName.indexOf('.') === -1 ? functionName : nameParts(functionName).name;
        let parameters = overload.$Parameter || [];
        if (overload.$IsBound) parameters = parameters.slice(1);
        const pathSegments = [];
        const params = [];

        const implicitAliases = csdl.$Version > '4.0' || parameters.some(p => p[meta.voc.Core.OptionalParameter]);

        parameters.forEach(p => {
            const description = getDescriptionWithFallback(p);
            /** @type {Parameter} */
            const param = {
                ...(description && { description }),
                required: implicitAliases ? !p[meta.voc.Core.OptionalParameter] : true
            };
            const type = meta.modelElement(p.$Type || 'Edm.String');
            // TODO: check whether parameter or type definition of Edm.Stream is annotated with JSON.Schema
            if (p.$Collection || p.$Type == 'Edm.Stream'
                || type && ['ComplexType', 'EntityType'].includes(type.$Kind)
                || type && type.$UnderlyingType == 'Edm.Stream') {
                param.in = 'query';
                if (
                    implicitAliases &&
                    csdl.$Version !== '2.0' &&
                    SYSTEM_QUERY_OPTIONS.includes(p.$Name.toLowerCase())
                ) {
                    param.name = `@${p.$Name}`;
                } else if (implicitAliases) {
                    param.name = p.$Name;
                } else {
                    pathSegments.push(`${p.$Name}=@${p.$Name}`);
                    param.name = `@${p.$Name}`;
                }
                param.schema = { type: 'string' };
                if (param.description) param.description += '  \n'; else param.description = '';
                param.description += `This is ${
                     p.$Collection ? 'a ' : ''
                     }URL-encoded JSON ${
                     p.$Collection ? 'array with items ' : ''
                     }of type ${
                     meta.namespaceQualifiedName(p.$Type ?? 'Edm.String')
                     }, see [Complex and Collection Literals](https://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part2-url-conventions.html#sec_ComplexandCollectionLiterals)`;
                param.example = p.$Collection ? '[]' : '{}';
            } else {
                if (implicitAliases) {
                    param.in = 'query';
                } else {
                    pathSegments.push(`${p.$Name}={${p.$Name}}`);
                    param.in = 'path';
                }
                if (
                    implicitAliases &&
                    csdl.$Version !== '2.0' &&
                    SYSTEM_QUERY_OPTIONS.includes(p.$Name.toLowerCase())
                )
                    param.name = `@${p.$Name}`;
                else
                    param.name = p.$Name;
                if (!p.$Type || p.$Type === "Edm.String" || (type && (!type.$Type || type.$Type === "Edm.String"))) {
                    if (param.description) param.description += '  \n';
                    else param.description = '';
                    param.description += "String value needs to be enclosed in single quotes";
                }
                param.schema = getSchema(p, '', true, true);
            }
            params.push(param);
        });

        const pathParameters = implicitAliases ? '' : `(${pathSegments.join(',')})`;
        const pathItem = {
            get: {
                summary: functionImport[meta.voc.Core.Description] || overload[meta.voc.Core.Description] || `Invokes function ${name}`,
                tags: [normaliseTag(overload[meta.voc.Common.Label] || sourceName || 'Service Operations')],
                parameters: prefixParameters.concat(params),
                responses: response(200, "Success", overload.$ReturnType, overload[meta.voc.Capabilities.OperationRestrictions]?.ErrorResponses),
            }
        };
        const functionExtension = getExtensions(overload, 'operation');
        if (Object.keys(functionExtension).length > 0) {
            Object.assign(pathItem.get, functionExtension);
        }
        const iDescription = functionImport[meta.voc.Core.LongDescription] || overload[meta.voc.Core.LongDescription];
        if (iDescription) pathItem.get.description = iDescription;
        customParameters(pathItem.get, overload[meta.voc.Capabilities.OperationRestrictions] || {});
        paths[prefix + pathParameters] = pathItem;
    }

    /**
     * Add path and Path Item Object for batch requests
     * @param {Paths} paths Paths Object to augment
     * @param {object} container Entity container
     */
    function pathItemBatch(paths, container) {
        const batchSupport = container[meta.voc.Capabilities.BatchSupport] || {};
        const supported = container[meta.voc.Capabilities.BatchSupported] !== false && batchSupport.Supported !== false;
        if (supported) {
            const firstEntitySet = Object.keys(container).filter(child => isIdentifier(child) && container[child].$Collection)[0];
            paths['/$batch'] = {
                post: {
                    summary: batchSupport[meta.voc.Core.Description] ?? 'Sends a group of requests',
                    description: `${batchSupport[meta.voc.Core.LongDescription] ?? 'Group multiple requests into a single request payload, see '
                        + '[Batch Requests](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_BatchRequests).'
                         }\n\n*Please note that "Try it out" is not supported for this request.*`,
                    tags: [normaliseTag('Batch Requests')],
                    requestBody: {
                        required: true,
                        description: 'Batch request',
                        content: {
                            'multipart/mixed;boundary=request-separator': {
                                schema: {
                                    type: 'string'
                                },
                                example: `--request-separator\n`
                                    + `Content-Type: application/http\n`
                                    + `Content-Transfer-Encoding: binary\n\n`
                                    + `GET ${firstEntitySet} HTTP/1.1\n`
                                    + `Accept: application/json\n\n`
                                    + `\n--request-separator--`
                            }
                        }
                    },
                    responses: {
                        '4XX': {
                            $ref: '#/components/responses/error'
                        }
                    }
                }
            };
            // @ts-expect-error - set above
            paths['/$batch'].post.responses[csdl.$Version < '4.0' ? 202 : 200] = {
                description: 'Batch response',
                content: {
                    'multipart/mixed': {
                        schema: {
                            type: 'string'
                        },
                        example: '--response-separator\n'
                            + 'Content-Type: application/http\n\n'
                            + 'HTTP/1.1 200 OK\n'
                            + 'Content-Type: application/json\n\n'
                            + '{...}'
                            + '\n--response-separator--'
                    }
                }
            };
        }
    }

    /**
     * Construct Responses Object
     * @param {string | number} code HTTP response code
     * @param {string} description Description
     * @param {object} type Response type object
     * @param {array} errors Array of operation-specific status codes with descriptions
     * @returns {Record<string, Response>}
     */
    function response(code, description, type, errors, isCount = true) {
        /** @type {Record<string, Response>}  */
        const r = {
            [code]: {
                description
            }
        };
        const CountPropertyObj = { [csdl.$Version > '4.0' ? '@count' : '@odata.count']: ref('count') };
        if (code != 204) {
            const s = getSchema(type);
            r[code].content = {
                'application/json': {}
            };

            if (type.$Collection) {
                // @ts-ignore - not undefined, we set it above
                r[code].content['application/json'].schema = {
                    type: 'object',
                    title: `Collection of ${nameParts(type.$Type ? type.$Type : 'Edm.String').name}`,
                    properties: {
                        ...(isCount && CountPropertyObj),
                        value: s
                    }
                };
            }

            else if (
                type.$Type === undefined ||
                (type.$Type.startsWith("Edm.") &&
                    !["Edm.Stream", "Edm.EntityType", "Edm.ComplexType"].includes(
                        type.$Type,
                    ))
            ) {
                // @ts-expect-error - set above
                r[code].content['application/json'].schema = { type: "object", properties: { value: s } };
            }

            else {
                // @ts-expect-error - set above
                r[code].content['application/json'].schema = s;
            }
        }
        if (errors) {
            for (const e of errors) {
                r[e.StatusCode] = {
                    description: e.Description,
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/error" },
                        },
                    },
                };
            }
        } else {
            r["4XX"] = {
                $ref: "#/components/responses/error",
            };
        }
        return r;
    }

    /**
     * Construct the Components Object from the types of the CSDL document
     * @param {CSDL} csdl CSDL document
     * @param {object} entityContainer Entity Container object
     * @return {object} Components Object
     */
    function getComponents(csdl, entityContainer) {
        const c = {
            schemas: getSchemas(csdl)
        };

        if (csdl.$EntityContainer) {
            c.parameters = getParameters();
            c.responses = {
                error: {
                    description: 'Error',
                    content: {
                        'application/json': {
                            schema: ref('error')
                        }
                    }
                }
            };
        }

        getSecuritySchemes(c, entityContainer)

        return c;
    }

    /**
     * Construct Schema Objects from the types of the CSDL document
     * @param {CSDL} csdl CSDL document
     * @return {object} Map of Schema Objects
     */
    function getSchemas(csdl) {
        const unordered = {};

        for (const r of requiredSchemas.list) {
            const type = meta.modelElement(`${r.namespace}.${r.name}`);
            if (!type) continue;
            switch (type.$Kind) {
                case "ComplexType":
                case "EntityType":
                    schemasForStructuredType(unordered, r.namespace, r.name, type, r.suffix);
                    break;
                case "EnumType":
                    schemaForEnumerationType(unordered, r.namespace, r.name, type);
                    break;
                case "TypeDefinition":
                    schemaForTypeDefinition(unordered, r.namespace, r.name, type);
                    break;
            }
        }

        // Add @OpenAPI.Extensions at entity level to schema object
        Object.keys(csdl).filter(name => isIdentifier(name)).forEach(namespace => {
            const schema = csdl[namespace];
            Object.keys(schema).filter(name => isIdentifier(name)).forEach(name => {
            const type = schema[name];
            if (type.$Kind === 'EntityType' || type.$Kind === 'ComplexType') {
                const schemaName = `${namespace}.${name}${SUFFIX.read}`;
                const extensions = getExtensions(type, 'schema');
                if (Object.keys(extensions).length > 0) {
                unordered[schemaName] = unordered[schemaName] || {};
                Object.assign(unordered[schemaName], extensions);
                }
            }
            });
        });

        const ordered = {};
        for (const name of Object.keys(unordered).sort()) {
            ordered[name] = unordered[name];
        }

        inlineTypes(ordered);

        if (csdl.$EntityContainer) {
            ordered.count = count();
            ordered.error = error();
        }

        return ordered;
    }

    /**
     * Construct Schema Objects from the types of the CSDL document
     * @param {object} schemas Map of Schema Objects to augment
     */
    function inlineTypes(schemas) {
        if (typesToInline.geoPoint) {
            schemas.geoPoint = {
                type: 'object',
                properties: {
                    coordinates: ref('geoPosition'),
                    type: {
                        type: 'string',
                        enum: ['Point'],
                        default: 'Point'
                    }
                },
                required: ['type', 'coordinates']
            };
            schemas.geoPosition = {
                type: 'array',
                minItems: 2,
                items: {
                    type: 'number'
                }
            }
        }
    }

    /**
     * Construct Schema Objects for an enumeration type
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemaForEnumerationType(schemas, qualifier, name, type) {
        const members = [];
        Object.keys(type).filter(iName => isIdentifier(iName)).forEach(iName2 => {
            members.push(iName2);
        });

        const s = {
            type: 'string',
            title: name,
            enum: members
        };
        const description = type[meta.voc.Core.LongDescription];
        if (description) s.description = description;
        schemas[`${qualifier}.${name}`] = s;
    }

    /**
     * Construct Schema Objects for a type definition
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemaForTypeDefinition(schemas, qualifier, name, type) {
        const s = getSchema({$Type: type.$UnderlyingType, ...type});
        s.title = name;
        const description = type[meta.voc.Core.LongDescription];
        if (description) s.description = description;
        schemas[`${qualifier}.${name}`] = s;
    }

    /**
     * Construct Schema Objects for a structured type
     * @param {object} schemas Map of Schema Objects to augment
     * @param {string} qualifier Qualifier for structured type
     * @param {string} name Simple name of structured type
     * @param {string} suffix Suffix for read/create/update
     * @param {object} type Structured type
     * @return {object} Map of Schemas Objects
     */
    function schemasForStructuredType(schemas, qualifier, name, type, suffix) {
        const schemaName = `${qualifier}.${name}${suffix}`;
        const baseName = `${qualifier}.${name}`;
        const isKey = keyMap(type);
        const required = Object.keys(isKey);
        const schemaProperties = {};
        let isCount = true;
        if (csdl[qualifier]?.$Annotations) {
            const annotations = csdl[qualifier].$Annotations[`${qualifier}.EntityContainer/${name}`];
            if (annotations && annotations[meta.voc.Capabilities.CountRestrictions] && annotations[meta.voc.Capabilities.CountRestrictions]?.Countable === false) {
                isCount = false;
            }
        }
        const properties = propertiesOfStructuredType(type);
        Object.keys(properties).forEach(iName => {
            const property = properties[iName];
            if (suffix === SUFFIX.read) schemaProperties[iName] = getSchema(property);
            if ((Object.prototype.hasOwnProperty.call(property, '@Common.FieldControl')) && property['@Common.FieldControl'] === 'Mandatory') { required.push(iName) }
            if (property.$Kind == 'NavigationProperty') {
                if (property.$Collection && suffix === "" && isCount === true) {
                    schemaProperties[`${iName}@${csdl.$Version === '4.0' ? 'odata.' : ''}count`] = ref('count');
                }
                if (property[meta.voc.Core.Permissions] != "Read" && !property[meta.voc.Core.Computed] && (property.$ContainsTarget || property.$OnDelete === 'Cascade')) {
                    if (suffix === SUFFIX.create) {
                        schemaProperties[iName] = getSchema(property, SUFFIX.create);
                    }
                    if (suffix === SUFFIX.update && !property[meta.voc.Core.Immutable]) {
                        schemaProperties[iName] = getSchema(property, SUFFIX.create);
                    }
                }
            } else {
                if (property[meta.voc.Core.Permissions] === "Read" || property[meta.voc.Core.Computed] || property[meta.voc.Core.ComputedDefaultValue]) {
                    const index = required.indexOf(iName);
                    if (index != -1) required.splice(index, 1);
                }
                if (!(property[meta.voc.Core.Permissions] === "Read" || property[meta.voc.Core.Computed])) {
                    if (suffix === SUFFIX.create)
                        schemaProperties[iName] = getSchema(property, SUFFIX.create);
                    if (suffix === SUFFIX.update && !isKey[iName] && !property[meta.voc.Core.Immutable])
                        schemaProperties[iName] = getSchema(property, SUFFIX.update);
                }
            }
        });


        schemas[schemaName] = {
            title: (type[meta.voc.Core.Description] || name) + TITLE_SUFFIX[suffix],
            type: 'object'
        };
        if (Object.keys(schemaProperties).length > 0)
            schemas[schemaName].properties = schemaProperties;

        if (suffix === SUFFIX.read && type["@ODM.root"]) schemas[schemaName]["x-sap-root-entity"] = type["@ODM.root"]
        odmExtensions(type, schemas[schemaName]);
        erExtensions(type, schemas[schemaName]);

        if (suffix === SUFFIX.create && required.length > 0)
            schemas[schemaName].required = [...new Set(required)];

        const description = type[meta.voc.Core.LongDescription];
        if (description) {
            schemas[schemaName].description = description;
        }

        if (meta.derivedTypes[baseName]) {
            schemas[schemaName].anyOf = [];
            meta.derivedTypes[baseName].forEach((derivedType) => {
                schemas[schemaName].anyOf.push(ref(derivedType, suffix));
            });
            if (!type.$Abstract) schemas[schemaName].anyOf.push({});
        }
    }

    /**
     * Add ODM extensions to OpenAPI schema for a structured type
     * @param {object} type Structured type
     * @param {object} schema OpenAPI schema to augment
     */
    function odmExtensions(type, schema) {
        for (const [annotation, openApiExtension] of Object.entries(ODM_ANNOTATIONS)) {
            if (type[annotation]) schema[openApiExtension] = type[annotation];
        }
    }

    /**
     * Add entity relationship extensions to OpenAPI schema for a structured type
     * @param {object} type Structured type
     * @param {object} schema OpenAPI schema to augment
     */
    function erExtensions(type, schema) {
        for (const [annotation, openApiExtension] of Object.entries(ER_ANNOTATIONS)) {
            if (type[annotation]) schema[openApiExtension] = type[annotation];
        }
    }

    /**
     * Collect all properties of a structured type along the inheritance hierarchy
     * @param {object} type Structured type
     * @return {object} Map of properties
     */
    function propertiesOfStructuredType(type) {
        const properties = (type && type.$BaseType) ? propertiesOfStructuredType(meta.modelElement(type.$BaseType)) : {};
        if (type) {
            Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
                properties[name] = type[name];
            });
        }
        return properties;
    }

    /**
     * Construct Parameter Objects for type-independent OData system query options
     * @return {object} Map of Parameter Objects
     */
    function getParameters() {
        const param = {
            top: {
                name: `${queryOptionPrefix}top`,
                in: 'query',
                description: 'Show only the first n items, see [Paging - Top](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptiontop)',
                schema: {
                    type: 'integer',
                    minimum: 0
                },
                example: 50
            },
            skip: {
                name: `${queryOptionPrefix}skip`,
                in: 'query',
                description: 'Skip the first n items, see [Paging - Skip](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionskip)',
                schema: {
                    type: 'integer',
                    minimum: 0
                }
            },
            count: {
                name: `${queryOptionPrefix}count`,
                in: 'query',
                description: 'Include count of items, see [Count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount)',
                schema: {
                    type: 'boolean'
                }
            }
        };

        if (csdl.$Version >= '4.0') param.search = {
            name: `${queryOptionPrefix}search`,
            in: 'query',
            description: 'Search items by search phrases, see [Searching](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptionsearch)',
            schema: {
                type: 'string'
            }
        };

        return param;
    }

    /**
     * Construct OData error response
     */
    function error() {
        const err = {
            type: 'object',
            required: ['error'],
            properties: {
                error: {
                    type: 'object',
                    required: ['code', 'message'],
                    properties: {
                        code: { type: 'string' },
                        message: { type: 'string' },
                        target: { type: 'string' },
                        details: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['code', 'message'],
                                properties: {
                                    code: { type: 'string' },
                                    message: { type: 'string' },
                                    target: { type: 'string' }
                                }
                            }
                        },
                        innererror: {
                            type: 'object',
                            description: 'The structure of this object is service-specific'
                        }
                    }
                }
            }
        };

        if (csdl.$Version < '4.0') {
            err.properties.error.properties.message = {
                type: 'object',
                properties: {
                    lang: { type: 'string' },
                    value: { type: 'string' }
                },
                required: ['lang', 'value']
            };
            // explicit cast required, as .details and .target are no inferred as optional above
            delete /**@type{any}*/(err.properties.error.properties).details;
            delete /**@type{any}*/(err.properties.error.properties).target;
        }

        return err;
    }

    /**
     * Construct OData count response
     */
    function count() {
        return {
            anyOf: [
                { type: 'number' },
                { type: 'string' }
            ],
            description: 'The number of entities in the collection. Available when using the [$count](http://docs.oasis-open.org/odata/odata/v4.01/odata-v4.01-part1-protocol.html#sec_SystemQueryOptioncount) query option.',
        };
    }

    /**
     * Construct Schema Object for model object referencing a type
     * @param {object} element referencing a type
     * @return {object} Schema Object
     */
    function getSchema(element, suffix = '', forParameter = false, forFunction = false) {

        /** @type {Schema} */
        let s = {};
        switch (element.$Type) {
            case 'Edm.AnnotationPath':
            case 'Edm.meta.modelElementPath':
            case 'Edm.NavigationPropertyPath':
            case 'Edm.PropertyPath':
                s = { type: 'string' };
                break;
            case 'Edm.Binary':
                s = {
                    type: 'string',
                    format: 'base64url'
                };
                if (element.$MaxLength) s.maxLength = Math.ceil(4 * element.$MaxLength / 3);
                break;
            case 'Edm.Boolean':
                s = { type: 'boolean' };
                break;
            case 'Edm.Byte':
                s = {
                    type: 'integer',
                    format: 'uint8'
                };
                break;
            case 'Edm.Date':
                s = {
                    type: 'string',
                    format: 'date',
                    example: '2017-04-13'
                };
                break;
            case 'Edm.DateTime':
            case 'Edm.DateTimeOffset':
                s = {
                    type: 'string',
                    format: 'date-time',
                    example: `2017-04-13T15:51:04${isNaN(element.$Precision) || element.$Precision === 0 ? '' : `.${'0'.repeat(element.$Precision)}`}Z`
                };
                break;
            case 'Edm.Decimal': {
                const preDecimal = /** @type {const}*/({ type: 'number', format: 'decimal' })
                s = {
                    anyOf: [preDecimal, { type: 'string' }],
                    example: 0
                };
                if (!isNaN(element.$Precision)) s['x-sap-precision'] = element.$Precision;
                if (!isNaN(element.$Scale)) s['x-sap-scale'] = element.$Scale;
                const scale = !isNaN(element.$Scale) ? element.$Scale : null;
                if (scale !== null) {
                    // Node.js 20 has problems with negative exponents, 10 ** -5 --> 0.000009999999999999999
                    if (scale <= 0)
                        preDecimal.multipleOf = 10 ** -scale;
                    else
                        preDecimal.multipleOf = 1 / 10 ** scale;
                }
                if (element.$Precision < 16) {
                    const limit = 10 ** (element.$Precision - scale);
                    const delta = 10 ** -scale;
                    preDecimal.maximum = limit - delta;
                    preDecimal.minimum = -preDecimal.maximum;
                }
                break;
            }
            case 'Edm.Double':
                s = {
                    anyOf: [{ type: 'number', format: 'double' }, { type: 'string' }],
                    example: 3.14
                };
                break;
            case 'Edm.Duration':
                s = {
                    type: 'string',
                    format: 'duration',
                    example: 'P4DT15H51M04S'
                };
                break;
            case 'Edm.GeographyPoint':
            case 'Edm.GeometryPoint':
                s = ref('geoPoint');
                typesToInline.geoPoint = true;
                break;
            case 'Edm.Guid':
                s = {
                    type: 'string',
                    format: 'uuid',
                    example: '01234567-89ab-cdef-0123-456789abcdef'
                };
                break;
            case 'Edm.Int16':
                s = {
                    type: 'integer',
                    format: 'int16'
                };
                break;
            case 'Edm.Int32':
                s = {
                    type: 'integer',
                    format: 'int32'
                };
                break;
            case 'Edm.Int64':
                s = {
                    anyOf: [{ type: 'integer', format: 'int64' }, { type: 'string' }],
                    example: "42"
                };
                break;
            case 'Edm.PrimitiveType':
                s = {
                    anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }]
                };
                break;
            case 'Edm.SByte':
                s = {
                    type: 'integer',
                    format: 'int8'
                };
                break;
            case 'Edm.Single':
                s = {
                    anyOf: [{ type: 'number', format: 'float' }, { type: 'string' }],
                    example: 3.14
                };
                break;
            case 'Edm.Stream':
                // eslint-disable-next-line no-case-declarations
                const jsonSchema = element[meta.voc.JSON.Schema];
                if (jsonSchema) {
                    if (typeof jsonSchema == 'string')
                        s = JSON.parse(jsonSchema);
                    else
                        s = jsonSchema;
                } else {
                    s = {
                        type: 'string',
                        format: 'base64url'
                    };
                }
                break;
            case 'Edm.String':
            case undefined: {
                s = { type: 'string' };
                if (element.$MaxLength) s.maxLength = element.$MaxLength;
                const pattern = element[meta.voc.Validation.Pattern];
                if (pattern) s.pattern = pattern;
                break;
            }
            case 'Edm.TimeOfDay':
                s = {
                    type: 'string',
                    format: 'time',
                    example: '15:51:04'
                };
                break;
            default:
                if (element.$Type.startsWith('Edm.')) {
                    DEBUG?.(`Unknown type: ${element.$Type}`);
                } else {
                    const type = meta.modelElement(element.$Type);
                    const isStructured = type && ['ComplexType', 'EntityType'].includes(type.$Kind);
                    s = ref(element.$Type, (isStructured ? suffix : ''));
                    if (element.$MaxLength) {
                        s = {
                            allOf: [s],
                            maxLength: element.$MaxLength
                        };
                    }
                }
        }

        allowedValues(s, element);

        if (element.$Nullable) {
            if (s.$ref) s = { allOf: [s] };
            s.nullable = true;
        }

        if (element.$DefaultValue !== undefined) {
            if (s.$ref) s = { allOf: [s] };
            s.default = element.$DefaultValue;
        }

        if (element[meta.voc.Core.Example]) {
            if (s.$ref) s = { allOf: [s] };
            s.example = element[meta.voc.Core.Example].Value;
        }

        /** @returns {s is import('./types.d.ts').StringSchema} */
        const isStringSchema = s => s?.type === 'string'
        /** @returns {s is import('./types.d.ts').NumberSchema} */
        const isNumberSchema = s => s?.type === 'number' || s?.type === 'integer'
        /** @returns {s is import('./types.d.ts').AnyOf} */
        const isAnyOfSchema = s => Boolean(s?.anyOf)

        if (forFunction) {
            if (s.example && typeof s.example === "string") {
                s.example = `${pathValuePrefix(element.$Type)}${s.example
                    }${pathValueSuffix(element.$Type)} `;
            }
            if (isStringSchema(s)) {
                if (s.pattern) {
                    const pre = pathValuePrefix(element.$Type);
                    const suf = pathValueSuffix(element.$Type);
                    s.pattern = s.pattern.replace(/^\^/, `^ ${pre} (`);
                    s.pattern = s.pattern.replace(/\$$/, `)${suf} $`);
                } else if (!element.$Type || element.$Type === "Edm.String") {
                    s.pattern = "^'([^']|'')*'$";
                }
            }
            if (element.$Nullable) {
                s.default = "null";
                if (isStringSchema(s) && s.pattern) {
                    s.pattern = s.pattern
                        .replace(/^\^/, "^(null|")
                        .replace(/\$$/, ")$");
                }
            }
        }

        if (element[meta.voc.Validation.Maximum] != undefined) {
            if (s.$ref) s = { allOf: [s] };
            if (isAnyOfSchema(s) && isNumberSchema(s.anyOf[0])) {
                s.anyOf[0].maximum = element[meta.voc.Validation.Maximum];
            }
            // TODO: this implies that we could be handling an AnyOfSchema here. So exclusiveMinimum is attach to that? Or to its first element, as above?
            // @ts-expect-error
            if (element[meta.voc.Validation.Maximum + meta.voc.Validation.Exclusive]) s.exclusiveMaximum = true;
        }

        if (element[meta.voc.Validation.Minimum] != undefined) {
            if (s.$ref) s = { allOf: [s] };
            if (isAnyOfSchema(s) && isNumberSchema(s.anyOf[0])) {
                s.anyOf[0].minimum = element[meta.voc.Validation.Minimum];
            }
            // TODO: see above
            // @ts-expect-error
            if (element[meta.voc.Validation.Minimum + meta.voc.Validation.Exclusive]) s.exclusiveMinimum = true;
        }

        if (element.$Collection) {
            s = {
                type: 'array',
                items: s
            };
        }

        const description = forParameter ? undefined : (element[meta.voc.Core.LongDescription] || element[meta.voc.Core.Description]);
        if (description) {
            if (s.$ref) s = { allOf: [s] };
            s.description = description;
        }

        if (element['@ODM.oidReference']?.entityName) {
            s['x-sap-odm-oid-reference-entity-name'] = element['@ODM.oidReference'].entityName
        }

        for (const key in element) {
            if (key.startsWith(ER_ANNOTATION_PREFIX) && ER_ANNOTATIONS[key]) {
                s[ER_ANNOTATIONS[key]] = element[key];
            }
        }
        return s;
    }

    /**
     * Add allowed values enum to Schema Object for string-like model element
     * @param {object} schema Schema Object to augment
     * @param {object} element Model element
     */
    function allowedValues(schema, element) {
        const values = element[meta.voc.Validation.AllowedValues];
        if (values) schema.enum = values.map(record => record.Value);
    }

    /**
     * Construct Reference Object for a type
     * @param {string} typename Qualified name of referenced type
     * @param {string} suffix Optional suffix for referenced schema
     * @return {object} Reference Object
     */
    function ref(typename, suffix = '') {
        let name = typename;
        let nsp = '';
        let url = '';
        if (typename.indexOf('.') != -1) {
            const parts = nameParts(typename);
            nsp = meta.namespace[parts.qualifier];
            name = `${nsp}.${parts.name}`;
            url = meta.namespaceUrl[nsp] ?? '';
            if (url === "" && !requiredSchemas.used[name + suffix]) {
                requiredSchemas.used[name + suffix] = true;
                requiredSchemas.list.push({ namespace: nsp, name: parts.name, suffix });
            }
            //TODO: introduce better way than guessing
            if (url.endsWith('.xml')) url = `${url.substring(0, url.length - 3)}openapi3.json`;
        }
        return {
            $ref: `${url}#/components/schemas/${name}${suffix}`
        };
    }

    /**
     * Augment Components Object with map of Security Scheme Objects
     * @param {object} components Components Object to augment
     * @param {object} entityContainer Entity Container object
     */
    function getSecuritySchemes(components, entityContainer) {
        const authorizations = entityContainer && entityContainer[meta.voc.Authorization.Authorizations] ? entityContainer[meta.voc.Authorization.Authorizations] : [];
        const schemes = {};
        const location = { Header: 'header', QueryOption: 'query', Cookie: 'cookie' };
        authorizations.forEach(auth => {
            const scheme = {};
            const flow = {};
            if (auth.Description) scheme.description = auth.Description;
            const qualifiedType = auth['@type'] || auth['@odata.type']
            const type = qualifiedType.substring(qualifiedType.lastIndexOf(".") + 1);
            let unknown = false
            switch (type) {
                case 'ApiKey':
                    scheme.type = 'apiKey';
                    scheme.name = auth.KeyName;
                    scheme.in = location[auth.Location];
                    break;
                case 'Http':
                    scheme.type = 'http';
                    scheme.scheme = auth.Scheme;
                    scheme.bearerFormat = auth.BearerFormat;
                    break;
                case 'OAuth2AuthCode':
                    scheme.type = 'oauth2';
                    scheme.flows = { authorizationCode: flow };
                    flow.authorizationUrl = auth.AuthorizationUrl;
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = getScopes(auth);
                    break;
                case 'OAuth2ClientCredentials':
                    scheme.type = 'oauth2';
                    scheme.flows = { clientCredentials: flow };
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = getScopes(auth);
                    break;
                case 'OAuth2Implicit':
                    scheme.type = 'oauth2';
                    scheme.flows = { implicit: flow };
                    flow.authorizationUrl = auth.AuthorizationUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = getScopes(auth);
                    break;
                case 'OAuth2Password':
                    scheme.type = 'oauth2';
                    scheme.flows = {};
                    scheme.flows = { password: flow };
                    flow.tokenUrl = auth.TokenUrl;
                    if (auth.RefreshUrl) flow.refreshUrl = auth.RefreshUrl;
                    flow.scopes = getScopes(auth);
                    break;
                case 'OpenIDConnect':
                    scheme.type = 'openIdConnect';
                    scheme.openIdConnectUrl = auth.IssuerUrl;
                    break;
                default:
                    unknown = true
                    DEBUG?.(`Unknown Authorization type ${qualifiedType}`);
            }
            if (!unknown) schemes[auth.Name] = scheme;
        });
        if (Object.keys(schemes).length > 0) components.securitySchemes = schemes
    }

    function getScopes(authorization) {
        const scopes = {};
        authorization.Scopes.forEach(scope => { scopes[scope.Scope] = scope.Description });
        return scopes;
    }

    /**
     * Augment OpenAPI document with Security Requirements Object
     * @param {object} openapi OpenAPI document to augment
     * @param {object} entityContainer Entity Container object
     */
    function security(openapi, entityContainer) {
        const securitySchemes = entityContainer && entityContainer[meta.voc.Authorization.SecuritySchemes] ? entityContainer[meta.voc.Authorization.SecuritySchemes] : [];
        // check if securitySchemas exist if it does not exist then throw a warning
        if (securitySchemes.length === 0) {
            DEBUG?.('No security schemes defined in the entity container');
        }
        if (securitySchemes.length > 0) openapi.security = [];
        securitySchemes.forEach(scheme => {
            const s = {};
            s[scheme.Authorization] = scheme.RequiredScopes || [];
            openapi.security.push(s);
        });
    }
};
