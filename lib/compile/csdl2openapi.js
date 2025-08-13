const cds = require('@sap/cds');
const pluralize = require('pluralize');

const DEBUG = cds.debug('openapi');

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
    "compute", "expand", "select", "filter", "search", "count",
    "orderby", "skip", "top", "format", "index", "schemaversion",
    "skiptoken", "apply",
];

const ODM_ANNOTATIONS = Object.freeze({
    '@ODM.entityName': 'x-sap-odm-entity-name',
    '@ODM.oid': 'x-sap-odm-oid'
});

const ER_ANNOTATION_PREFIX = '@EntityRelationship';
const ER_ANNOTATIONS = Object.freeze({
    '@EntityRelationship.entityType': 'x-entity-relationship-entity-type',
    '@EntityRelationship.entityIds': 'x-entity-relationship-entity-ids',
    '@EntityRelationship.propertyType': 'x-entity-relationship-property-type',
    '@EntityRelationship.reference': 'x-entity-relationship-reference',
    '@EntityRelationship.compositeReferences': 'x-entity-relationship-composite-references',
    '@EntityRelationship.temporalIds': 'x-entity-relationship-temporal-ids',
    '@EntityRelationship.temporalReferences': 'x-entity-relationship-temporal-references',
    '@EntityRelationship.referencesWithConstantIds': 'x-entity-relationship-references-with-constant-ids'
});

const CSDL_KINDS = {
    ACTION: 'Action',
    FUNCTION: 'Function',
    ENTITY_TYPE: 'EntityType',
    COMPLEX_TYPE: 'ComplexType',
    ENUM_TYPE: 'EnumType',
    TYPE_DEFINITION: 'TypeDefinition',
    NAVIGATION_PROPERTY: 'NavigationProperty'
};

const EDM_TYPES = {
    STREAM: 'Edm.Stream',
    STRING: 'Edm.String',
};

function nameParts(qualifiedName) {
    const pos = qualifiedName.lastIndexOf('.');
    console.assert(pos > 0, `Invalid qualified name ${qualifiedName}`);
    return {
        qualifier: qualifiedName.substring(0, pos),
        name: qualifiedName.substring(pos + 1)
    };
}

function isIdentifier(name) {
    return !name.startsWith('$') && !name.includes('@');
}

function splitName(name) {
    return name.split(/(?=[A-Z])/g).join(' ').toLowerCase().replace(/ i d/g, ' id');
}

function enumMember(member) {
    if (typeof member === 'string') return member;
    if (typeof member === 'object') return member.$EnumMember;
    return undefined;
}

function navigationPropertyPath(path) {
    if (typeof path === 'string') return path;
    return path.$NavigationPropertyPath;
}

function propertyPath(path) {
    if (typeof path === 'string') return path;
    return path.$PropertyPath;
}

class CsdlToOpenApiConverter {
    constructor(csdl, options = {}) {
        this._csdl = JSON.parse(JSON.stringify(csdl));
        this._options = {
            scheme: 'https',
            host: 'localhost',
            basePath: '/service-root',
            diagram: false,
            maxLevels: 5,
            ...options
        };

        this._csdl.$Version = this._options.odataVersion || '4.01';
        this._options.serviceRoot = this._options.url || `${this._options.scheme}://${this._options.host}${this._options.basePath}`;
        this._queryOptionPrefix = this._csdl.$Version <= '4.01' ? '$' : '';

        this._typesToInline = {};
        this._requiredSchemas = { list: [], used: {} };

        const preprocessed = this._preProcess();
        this._boundOverloads = preprocessed.boundOverloads;
        this._derivedTypes = preprocessed.derivedTypes;
        this._alias = preprocessed.alias;
        this._namespace = preprocessed.namespace;
        this._namespaceUrl = preprocessed.namespaceUrl;
        this._voc = preprocessed.voc;
    }

    convert() {
        const entityContainer = this._csdl.$EntityContainer ? this._modelElement(this._csdl.$EntityContainer) : {};
        if (this._csdl.$EntityContainer) {
            const serviceName = nameParts(this._csdl.$EntityContainer).qualifier;
            Object.keys(entityContainer).forEach(elementName => {
                const element = entityContainer[elementName];
                if (element.$Type) {
                    const typeName = nameParts(element.$Type).name;
                    const type = this._csdl[serviceName]?.[typeName];
                    if ((type?.['@cds.autoexpose'] || type?.['@cds.autoexposed']) && !entityContainer[typeName]) {
                        element['$cds.autoexpose'] = true;
                    }
                }
            });
        }

        const openapi = {
            openapi: '3.0.2',
            info: this._getInfo(entityContainer),
            'x-sap-api-type': 'ODATAV4',
            'x-odata-version': this._csdl.$Version,
            'x-sap-shortText': this._getShortText(entityContainer),
            servers: this._getServers(),
            tags: entityContainer ? this._getTags(entityContainer) : {},
            paths: entityContainer ? this._getPaths(entityContainer) : {},
            components: this._getComponents(entityContainer)
        };

        const externalDocs = this._getExternalDoc();
        if (Object.keys(externalDocs).length > 0) {
            openapi.externalDocs = externalDocs;
        }

        const extensions = this._getExtensions(this._csdl, 'root');
        if (Object.keys(extensions).length > 0) {
            Object.assign(openapi, extensions);
        }

        if (!this._csdl.$EntityContainer) {
            delete openapi.servers;
            delete openapi.tags;
        }

        this._addSecurity(openapi, entityContainer);

        return openapi;
    }

    _preProcess() {
        const boundOverloads = {};
        const derivedTypes = {};
        const alias = {};
        const namespace = { 'Edm': 'Edm' };
        const namespaceUrl = {};
        const voc = {};

        Object.keys(this._csdl.$Reference || {}).forEach(url => {
            const reference = this._csdl.$Reference[url];
            (reference.$Include || []).forEach(include => {
                const qualifier = include.$Alias || include.$Namespace;
                alias[include.$Namespace] = qualifier;
                namespace[qualifier] = include.$Namespace;
                namespace[include.$Namespace] = include.$Namespace;
                namespaceUrl[include.$Namespace] = url;
            });
        });

        this._getVocabularies(voc, alias);

        Object.keys(this._csdl).filter(isIdentifier).forEach(name => {
            const schema = this._csdl[name];
            const qualifier = schema.$Alias || name;
            const isDefaultNamespace = schema[voc.Core.DefaultNamespace];

            alias[name] = qualifier;
            namespace[qualifier] = name;
            namespace[name] = name;

            Object.keys(schema).filter(isIdentifier).forEach(itemName => {
                const qualifiedName = `${qualifier}.${itemName}`;
                const element = schema[itemName];
                if (Array.isArray(element)) {
                    element.filter(overload => overload.$IsBound).forEach(overload => {
                        const typeKey = `${overload.$Parameter[0].$Type}${overload.$Parameter[0].$Collection ? '-c' : ''}`;
                        if (!boundOverloads[typeKey]) boundOverloads[typeKey] = [];
                        const nameToPush = isDefaultNamespace ? itemName : qualifiedName;
                        boundOverloads[typeKey].push({ name: nameToPush, overload: overload });
                    });
                } else if (element.$BaseType) {
                    const base = this._namespaceQualifiedName(element.$BaseType, namespace);
                    if (!derivedTypes[base]) derivedTypes[base] = [];
                    derivedTypes[base].push(qualifiedName);
                }
            });

            this._processAnnotations(schema, namespace);
        });
        return { boundOverloads, derivedTypes, alias, namespace, namespaceUrl, voc };
    }

    _processAnnotations(schema, namespace) {
        Object.keys(schema.$Annotations || {}).forEach(target => {
            const annotations = schema.$Annotations[target];
            const segments = target.split('/');
            const openParen = segments[0].indexOf('(');
            let element;

            if (openParen === -1) {
                element = this._modelElement(segments[0], namespace);
            } else {
                element = this._modelElement(segments[0].substring(0, openParen), namespace);
                const args = segments[0].substring(openParen + 1, segments[0].length - 1);
                element = element.find(overload => {
                    if (overload.$Kind === CSDL_KINDS.ACTION && !overload.$IsBound && args === "") return true;
                    if (overload.$Kind === CSDL_KINDS.ACTION) {
                        const paramType = overload.$Parameter[0].$Collection ? `Collection(${overload.$Parameter[0].$Type})` : overload.$Parameter[0].$Type || "";
                        return args === paramType;
                    }
                    const paramString = (overload.$Parameter || []).map(p => {
                        const type = p.$Type || EDM_TYPES.STRING;
                        return p.$Collection ? `Collection(${type})` : type;
                    }).join(",");
                    return paramString === args;
                });
            }

            if (!element) {
                DEBUG?.(`Invalid annotation target '${target}'`);
            } else if (Array.isArray(element)) {
                // Not implemented
            } else if (segments.length === 1) {
                Object.assign(element, annotations);
            } else if (segments.length === 2) {
                const [ , segment2 ] = segments;
                if ([CSDL_KINDS.ACTION, CSDL_KINDS.FUNCTION].includes(element.$Kind)) {
                    if (segment2 === '$ReturnType' && element.$ReturnType) {
                        Object.assign(element.$ReturnType, annotations);
                    } else {
                        const parameter = element.$Parameter.find(p => p.$Name === segment2);
                        if(parameter) Object.assign(parameter, annotations);
                    }
                } else if (element[segment2]) {
                    Object.assign(element[segment2], annotations);
                }
            } else {
                DEBUG?.('More than two annotation target path segments');
            }
        });
    }

    _getVocabularies(voc, alias) {
        const terms = {
            Authorization: ['Authorizations', 'SecuritySchemes'],
            Capabilities: ['BatchSupport', 'BatchSupported', 'ChangeTracking', 'CountRestrictions', 'DeleteRestrictions', 'DeepUpdateSupport', 'ExpandRestrictions',
                'FilterRestrictions', 'IndexableByKey', 'InsertRestrictions', 'KeyAsSegmentSupported', 'NavigationRestrictions', 'OperationRestrictions',
                'ReadRestrictions', 'SearchRestrictions', 'SelectSupport', 'SkipSupported', 'SortRestrictions', 'TopSupported', 'UpdateRestrictions'],
            Core: ['AcceptableMediaTypes', 'Computed', 'ComputedDefaultValue', 'DefaultNamespace', 'Description', 'Example', 'Immutable', 'LongDescription',
                'OptionalParameter', 'Permissions', 'SchemaVersion'],
            JSON: ['Schema'],
            Validation: ['AllowedValues', 'Exclusive', 'Maximum', 'Minimum', 'Pattern']
        };

        Object.keys(terms).forEach(vocab => {
            voc[vocab] = {};
            terms[vocab].forEach(term => {
                if (alias[`Org.OData.${vocab}.V1`] !== undefined) {
                    voc[vocab][term] = `@${alias[`Org.OData.${vocab}.V1`]}.${term}`;
                }
            });
        });

        if (alias['com.sap.vocabularies.Common.v1']) {
            voc.Common = { Label: `@${alias['com.sap.vocabularies.Common.v1']}.Label` };
        }
    }

    _getInfo(entityContainer) {
        const namespace = this._csdl.$EntityContainer ? nameParts(this._csdl.$EntityContainer).qualifier : null;
        const containerSchema = this._csdl.$EntityContainer ? this._csdl[namespace] : {};

        let description = entityContainer?.[this._voc.Core.LongDescription]
            || containerSchema?.[this._voc.Core.LongDescription]
            || "Use @Core.LongDescription: '...' on your CDS service to provide a meaningful description.";

        if (this._options.diagram) {
            description += this._getResourceDiagram(entityContainer);
        }

        const title = entityContainer?.[this._voc.Common.Label]
            || "Use @title: '...' on your CDS service to provide a meaningful title.";

        return {
            title: title,
            description: this._csdl.$EntityContainer ? description : '',
            version: containerSchema?.[this._voc.Core.SchemaVersion] || ''
        };
    }

    _getExternalDoc() {
        const namespace = this._csdl.$EntityContainer ? nameParts(this._csdl.$EntityContainer).qualifier : null;
        const containerSchema = this._csdl.$EntityContainer ? this._csdl[namespace] : {};
        const externalDocs = {};
        if (containerSchema?.['@OpenAPI.externalDocs.description']) {
            externalDocs.description = containerSchema['@OpenAPI.externalDocs.description'];
        }
        if (containerSchema?.['@OpenAPI.externalDocs.url']) {
            externalDocs.url = containerSchema['@OpenAPI.externalDocs.url'];
        }
        return externalDocs;
    }

    _getServers() {
        if (this._options.serversObject) {
            try {
                const servers = JSON.parse(this._options.serversObject);
                if (!Array.isArray(servers) || servers.length === 0) {
                    throw new Error('The input server object should be a non-empty array.');
                }
                return servers;
            } catch (err) {
                throw new Error('The input server object is invalid JSON.');
            }
        }
        return [{ url: this._options.serviceRoot }];
    }

    _getTags(container) {
        const tags = new Map();
        Object.keys(container)
            .filter(name => isIdentifier(name) && container[name].$Type)
            .forEach(childName => {
                const child = container[childName];
                const type = this._modelElement(child.$Type) || {};
                const tagName = type[this._voc.Common.Label] || childName;
                const description = child[this._voc.Core.Description] || type[this._voc.Core.Description];
                const tag = { name: tagName };
                if (description) tag.description = description;
                tags.set(tagName, tag);
            });
        return Array.from(tags.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    _getPaths(container) {
        const paths = {};
        const resources = Object.keys(container).filter(isIdentifier);
        resources.forEach(name => {
            const child = container[name];
            if (child.$Type) {
                const type = this._modelElement(child.$Type);
                const sourceName = (type && type[this._voc.Common.Label]) || name;
                child.$ContainsTarget = true;
                this._pathItems(paths, `/${name}`, [], child, child, sourceName, sourceName, child, 0, '');
            } else if (child.$Action) {
                this._pathItemActionImport(paths, name, child);
            } else if (child.$Function) {
                this._pathItemFunctionImport(paths, name, child);
            } else {
                DEBUG?.(`Unrecognized entity container child: ${name}`);
            }
        });
        if (resources.length > 0) this._pathItemBatch(paths, container);
        const sortedPaths = Object.keys(paths).sort().reduce((acc, key) => {
            acc[key] = paths[key];
            return acc;
        }, {});
        return sortedPaths;
    }

    _pathItems(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath) {
        const name = prefix.substring(prefix.lastIndexOf('/') + 1);
        const pathItem = {};
        const restrictions = this._navigationPropertyRestrictions(root, navigationPath);
        const nonExpandable = this._nonExpandableProperties(root, navigationPath);

        paths[prefix] = pathItem;
        if (prefixParameters.length > 0) {
            pathItem.parameters = prefixParameters;
        }

        this._operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, false, nonExpandable);
        if (!root['$cds.autoexpose'] && element.$Collection && (element.$ContainsTarget || (level < 2 && target))) {
            this._operationCreate(pathItem, element, name, sourceName, targetName, target, level, restrictions);
        }
        this._pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);

        if (element.$ContainsTarget) {
            if (element.$Collection) {
                if (level < this._options.maxLevels) {
                    this._pathItemsWithKey(paths, prefix, prefixParameters, element, root, sourceName, targetName, target, level, navigationPath, restrictions, nonExpandable);
                }
            } else {
                if (!root['$cds.autoexpose']) {
                    this._operationUpdate(pathItem, element, name, sourceName, target, level, restrictions);
                    if (element.$Nullable) {
                        this._operationDelete(pathItem, element, name, sourceName, target, level, restrictions);
                    }
                }
                this._pathItemsForBoundOperations(paths, prefix, prefixParameters, element, sourceName);
                this._pathItemsWithNavigation(paths, prefix, prefixParameters, this._modelElement(element.$Type), root, sourceName, level, navigationPath);
            }
        }

        if (Object.keys(pathItem).filter(key => key !== 'parameters').length === 0) {
            delete paths[prefix];
        }
    }
    
    _operationRead(pathItem, element, name, sourceName, targetName, target, level, restrictions, byKey, nonExpandable) {
        const targetRestrictions = target?.[this._voc.Capabilities.ReadRestrictions];
        const readRestrictions = restrictions.ReadRestrictions || targetRestrictions || {};
        const readByKeyRestrictions = readRestrictions.ReadByKeyRestrictions;
        
        let readable = true;
        if (byKey && readByKeyRestrictions && readByKeyRestrictions.Readable !== undefined) {
            readable = readByKeyRestrictions.Readable;
        } else if (readRestrictions.Readable !== undefined) {
            readable = readRestrictions.Readable;
        }

        if (readable) {
            const countRestrictions = target && (target[this._voc.Capabilities.CountRestrictions]?.Countable === false);
            const descriptions = (level === 0 ? targetRestrictions : restrictions.ReadRestrictions) || {};
            const byKeyDescriptions = byKey ? descriptions.ReadByKeyRestrictions || {} : {};
            const lname = splitName(name);
            const collection = !byKey && element.$Collection;

            const operation = {
                summary: byKeyDescriptions.Description || descriptions.Description || this._operationSummary('Retrieves', name, sourceName, level, element.$Collection, byKey),
                tags: [sourceName],
                parameters: [],
                responses: this._response(200, `Retrieved ${byKey ? pluralize.singular(lname) : lname}`, { $Type: element.$Type, $Collection: collection },
                    byKey ? readByKeyRestrictions?.ErrorResponses : readRestrictions?.ErrorResponses, !countRestrictions)
            };

            const deltaSupported = element[this._voc.Capabilities.ChangeTracking]?.Supported;
            if (!byKey && deltaSupported) {
                operation.responses[200].content['application/json'].schema.properties['@odata.deltaLink'] = {
                    type: 'string',
                    example: `${this._options.basePath}/${name}?$deltatoken=...`
                };
            }

            if (byKeyDescriptions.LongDescription || descriptions.LongDescription) {
                operation.description = byKeyDescriptions.LongDescription || descriptions.LongDescription;
            }
            if (target && sourceName !== targetName) {
                operation.tags.push(targetName);
            }
            this._customParameters(operation, byKey ? readByKeyRestrictions || readRestrictions : readRestrictions);

            if (collection) {
                this._optionTop(operation.parameters, target, restrictions);
                this._optionSkip(operation.parameters, target, restrictions);
                if (this._csdl.$Version >= '4.0') this._optionSearch(operation.parameters, target, restrictions);
                this._optionFilter(operation.parameters, target, restrictions);
                this._optionCount(operation.parameters, target);
                this._optionOrderBy(operation.parameters, element, target, restrictions);
            }

            this._optionSelect(operation.parameters, element, target, restrictions);
            this._optionExpand(operation.parameters, element, target, nonExpandable);

            pathItem.get = operation;
        }
    }

    _getComponents(entityContainer) {
        const components = {
            schemas: this._getSchemas()
        };

        if (this._csdl.$EntityContainer) {
            components.parameters = this._getParameters();
            components.responses = {
                error: {
                    description: 'Error',
                    content: {
                        'application/json': {
                            schema: this._ref('error')
                        }
                    }
                }
            };
        }

        this._getSecuritySchemes(components, entityContainer);
        return components;
    }

    _getSchemas() {
        const unordered = {};

        for (const required of this._requiredSchemas.list) {
            const type = this._modelElement(`${required.namespace}.${required.name}`);
            if (!type) continue;
            switch (type.$Kind) {
                case CSDL_KINDS.COMPLEX_TYPE:
                case CSDL_KINDS.ENTITY_TYPE:
                    this._schemasForStructuredType(unordered, required.namespace, required.name, type, required.suffix);
                    break;
                case CSDL_KINDS.ENUM_TYPE:
                    this._schemaForEnumerationType(unordered, required.namespace, required.name, type);
                    break;
                case CSDL_KINDS.TYPE_DEFINITION:
                    this._schemaForTypeDefinition(unordered, required.namespace, required.name, type);
                    break;
            }
        }

        Object.keys(this._csdl).filter(isIdentifier).forEach(namespace => {
            const schema = this._csdl[namespace];
            Object.keys(schema).filter(isIdentifier).forEach(name => {
                const type = schema[name];
                if (type.$Kind === CSDL_KINDS.ENTITY_TYPE || type.$Kind === CSDL_KINDS.COMPLEX_TYPE) {
                    const schemaName = `${namespace}.${name}${SUFFIX.read}`;
                    const extensions = this._getExtensions(type, 'schema');
                    if (Object.keys(extensions).length > 0) {
                        unordered[schemaName] = unordered[schemaName] || {};
                        Object.assign(unordered[schemaName], extensions);
                    }
                }
            });
        });

        const ordered = {};
        Object.keys(unordered).sort().forEach(name => {
            ordered[name] = unordered[name];
        });

        this._inlineTypes(ordered);

        if (this._csdl.$EntityContainer) {
            ordered.count = this._countSchema();
            ordered.error = this._errorSchema();
        }
        return ordered;
    }

    _getSchema(element, suffix = '', forParameter = false, forFunction = false) {
        let s = {};
        switch (element.$Type) {
            case 'Edm.AnnotationPath':
            case 'Edm.ModelElementPath':
            case 'Edm.NavigationPropertyPath':
            case 'Edm.PropertyPath':
                s.type = 'string';
                break;
            case 'Edm.Binary':
                s = { type: 'string', format: 'base64url' };
                if (element.$MaxLength) s.maxLength = Math.ceil(4 * element.$MaxLength / 3);
                break;
            case 'Edm.Boolean':
                s.type = 'boolean';
                break;
            case 'Edm.Byte':
                s = { type: 'integer', format: 'uint8' };
                break;
            case 'Edm.Date':
                s = { type: 'string', format: 'date', example: '2017-04-13' };
                break;
            case 'Edm.DateTime':
            case 'Edm.DateTimeOffset':
                s = this._getSchemaForDateTime(element);
                break;
            case 'Edm.Decimal':
                s = this._getSchemaForDecimal(element);
                break;
            case 'Edm.Double':
                s = { anyOf: [{ type: 'number', format: 'double' }, { type: 'string' }], example: 3.14 };
                break;
            case 'Edm.Duration':
                s = { type: 'string', format: 'duration', example: 'P4DT15H51M04S' };
                break;
            case 'Edm.GeographyPoint':
            case 'Edm.GeometryPoint':
                s = this._ref('geoPoint');
                this._typesToInline.geoPoint = true;
                break;
            case 'Edm.Guid':
                s = { type: 'string', format: 'uuid', example: '01234567-89ab-cdef-0123-456789abcdef' };
                break;
            case 'Edm.Int16':
                s = { type: 'integer', format: 'int16' };
                break;
            case 'Edm.Int32':
                s = { type: 'integer', format: 'int32' };
                break;
            case 'Edm.Int64':
                s = { anyOf: [{ type: 'integer', format: 'int64' }, { type: 'string' }], example: '42' };
                break;
            case 'Edm.PrimitiveType':
                s = { anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] };
                break;
            case 'Edm.SByte':
                s = { type: 'integer', format: 'int8' };
                break;
            case 'Edm.Single':
                s = { anyOf: [{ type: 'number', format: 'float' }, { type: 'string' }], example: 3.14 };
                break;
            case EDM_TYPES.STREAM:
                s = this._getSchemaForStream(element);
                break;
            case EDM_TYPES.STRING:
            case undefined:
                s.type = 'string';
                if (element.$MaxLength) s.maxLength = element.$MaxLength;
                this._addPattern(s, element);
                break;
            case 'Edm.TimeOfDay':
                s = { type: 'string', format: 'time', example: '15:51:04' };
                break;
            default:
                s = this._getSchemaForUnknownType(element, suffix);
        }

        this._addAllowedValues(s, element);
        this._addNullability(s, element);
        this._addDefault(s, element);
        this._addExample(s, element);
        this._addValidation(s, element);
        if (forFunction) this._adjustSchemaForFunction(s, element);
        if (element.$Collection) s = { type: 'array', items: s };
        if (!forParameter && element[this._voc.Core.LongDescription]) {
            if (s.$ref) s = { allOf: [s] };
            s.description = element[this._voc.Core.LongDescription];
        }
        this._addOdmAndErExtensions(s, element);
        return s;
    }

    _getSchemaForDateTime(element) {
        const precision = isNaN(element.$Precision) || element.$Precision === 0 ? '' : `.${'0'.repeat(element.$Precision)}`;
        return {
            type: 'string',
            format: 'date-time',
            example: `2017-04-13T15:51:04${precision}Z`
        };
    }

    _getSchemaForDecimal(element) {
        const s = {
            anyOf: [{ type: 'number', format: 'decimal' }, { type: 'string' }],
            example: 0
        };
        if (!isNaN(element.$Precision)) s['x-sap-precision'] = element.$Precision;
        if (!isNaN(element.$Scale)) s['x-sap-scale'] = element.$Scale;
        const scale = !isNaN(element.$Scale) ? element.$Scale : null;
        if (scale !== null) {
            s.anyOf[0].multipleOf = scale <= 0 ? 10 ** -scale : 1 / (10 ** scale);
        }
        if (element.$Precision < 16) {
            const limit = 10 ** (element.$Precision - (scale || 0));
            const delta = scale !== null ? 10 ** -scale : 0;
            s.anyOf[0].maximum = limit - delta;
            s.anyOf[0].minimum = -s.anyOf[0].maximum;
        }
        return s;
    }
    
    _primitivePaths(element) {
        const paths = [];
        const elementType = this._modelElement(element.$Type);
        if (!elementType) {
            DEBUG?.(`Unknown type for element: ${JSON.stringify(element)}`);
            return paths;
        }

        const initialProperties = Object.entries(this._propertiesOfStructuredType(elementType))
            .filter(([, prop]) => prop.$Kind !== CSDL_KINDS.NAVIGATION_PROPERTY)
            .map(this._mapEntryToProperty({ path: '', typeRefChain: [] }));

        const queue = [...initialProperties];
        
        while (queue.length > 0) {
            const property = queue.shift();
            if (!property.isComplex) {
                paths.push(property.path);
                continue;
            }

            const typeRefChainTail = property.typeRefChain[property.typeRefChain.length - 1];
            if (property.typeRefChain.filter(t => t === typeRefChainTail).length > 1) {
                DEBUG?.(`Cycle detected ${property.typeRefChain.join('->')}`);
                continue;
            }

            const expanded = Object.entries(property.properties)
                .filter(([, prop]) => prop.$Kind !== CSDL_KINDS.NAVIGATION_PROPERTY)
                .map(this._mapEntryToProperty(property));
            
            queue.unshift(...expanded);
        }

        return paths;
    }

    _mapEntryToProperty(parent) {
        return ([key, property]) => {
            const propertyType = property.$Type && this._modelElement(property.$Type);
            const isComplex = propertyType && propertyType.$Kind === CSDL_KINDS.COMPLEX_TYPE;

            if (isComplex) {
                return {
                    properties: this._propertiesOfStructuredType(propertyType),
                    path: `${parent.path}${key}/`,
                    typeRefChain: parent.typeRefChain.concat(property.$Type),
                    isComplex: true,
                };
            }

            return {
                properties: {},
                path: `${parent.path}${key}`,
                typeRefChain: [],
                isComplex: false,
            };
        };
    }

    _ref(typename, suffix = '') {
        let name = typename;
        let nsp = '';
        let url = '';
        if (typename.indexOf('.') !== -1) {
            const parts = nameParts(typename);
            nsp = this._namespace[parts.qualifier];
            name = `${nsp}.${parts.name}`;
            url = this._namespaceUrl[nsp] || '';
            if (url === "" && !this._requiredSchemas.used[`${name}${suffix}`]) {
                this._requiredSchemas.used[`${name}${suffix}`] = true;
                this._requiredSchemas.list.push({ namespace: nsp, name: parts.name, suffix });
            }
            if (url.endsWith('.xml')) {
                url = `${url.substring(0, url.length - 3)}openapi3.json`;
            }
        }
        return { $ref: `${url}#/components/schemas/${name}${suffix}` };
    }

    _namespaceQualifiedName(qualifiedName, namespace = this._namespace) {
        const np = nameParts(qualifiedName);
        return `${namespace[np.qualifier]}.${np.name}`;
    }

    _modelElement(qname, namespace = this._namespace) {
        if (!qname) return null;
        const q = nameParts(qname);
        const schema = this._csdl[q.qualifier] || this._csdl[namespace[q.qualifier]];
        return schema ? schema[q.name] : null;
    }

    _propertiesOfStructuredType(type) {
        const properties = (type && type.$BaseType) ? this._propertiesOfStructuredType(this._modelElement(type.$BaseType)) : {};
        if (type) {
            Object.keys(type)
                .filter(isIdentifier)
                .forEach(name => {
                    properties[name] = type[name];
                });
        }
        return properties;
    }
}

module.exports.csdl2openapi = function (csdl, options) {
    const converter = new CsdlToOpenApiConverter(csdl, options);
    return converter.convert();
};
