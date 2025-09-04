/**
 * OpenAPI Info and Extensions Module
 *
 * Handles generation of OpenAPI info objects, external documentation, extensions, and diagrams
 */

const { nameParts, isIdentifier, modelElement } = require('./model-navigation');

/**
 * Construct the Info Object
 * @param {import('./types').CSDL} csdl CSDL document
 * @param {object} entityContainer Entity Container object
 * @param {object} voc Vocabulary mapping
 * @param {boolean} diagram Whether to include diagram
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {object} Info Object
 */
function getInfo(csdl, entityContainer, voc, diagram, namespace) {
    const namespaceQualifier = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
    const containerSchema = csdl.$EntityContainer && namespaceQualifier? csdl[namespaceQualifier] : {};
    let description;
    if (entityContainer && entityContainer[voc.Core.LongDescription]) {
        description = entityContainer[voc.Core.LongDescription];
    }
    else if (containerSchema && containerSchema[voc.Core.LongDescription]) {
        description = containerSchema[voc.Core.LongDescription];
    }
    else {
        description = "Use @Core.LongDescription: '...' on your CDS service to provide a meaningful description.";
    }
    description += (diagram ? getResourceDiagram(csdl, entityContainer, namespace) : '');
    const title = (entityContainer && entityContainer[voc.Common.Label])
        ? entityContainer[voc.Common.Label]
        : "Use @title: '...' on your CDS service to provide a meaningful title."
    return {
        title,
        description: csdl.$EntityContainer ? description : '',
        version: containerSchema[voc.Core.SchemaVersion] || ''
    };
}

/**
 * Construct the externalDocs Object
 * @param {import('./types').CSDL} csdl CSDL document
 * @return {object} externalDocs Object
 */
function getExternalDoc(csdl) {
    const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
    const containerSchema = csdl.$EntityContainer && namespace ? csdl[namespace] : {};
    let externalDocs = {};
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
 * @param {import('./types').CSDL} csdl CSDL document
 * @param {object} entityContainer Entity Container object
 * @param {object} voc Vocabulary mapping
 * @return {string} short text
 */
function getShortText(csdl, entityContainer, voc) {
    const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
    const containerSchema = csdl.$EntityContainer && namespace ? csdl[namespace] : {};
    let shortText;
    if (entityContainer && entityContainer[voc.Core.Description]) {
        shortText = entityContainer[voc.Core.Description];
    }
    else if (containerSchema && containerSchema[voc.Core.Description]) {
        shortText = containerSchema[voc.Core.Description];
    }
    else {
        shortText = "Use @Core.Description: '...' on your CDS service to provide a meaningful short text.";
    }
    return shortText;
}

/**
 * Function to read @OpenAPI.Extensions and get them in the generated openAPI document
 * @param {import('./types').CSDL} csdl CSDL document
 * @param {string} level Processing level ('root', 'schema', 'operation')
 * @return {object} Extensions object
 */
function getExtensions(csdl, level) {
    let extensionObj = {};
    let containerSchema = {};
    if (level ==='root'){
        const namespace = csdl.$EntityContainer ? nameParts(csdl.$EntityContainer).qualifier : null;
        containerSchema = csdl.$EntityContainer && namespace ? csdl[namespace] : {};
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
    let extensionEnums = {
        "x-sap-compliance-level": {allowedValues: ["sap:base:v1", "sap:core:v1", "sap:core:v2" ] } ,
        "x-sap-api-type": {allowedValues: [ "ODATA", "ODATAV4", "REST" , "SOAP"] },
        "x-sap-direction": {allowedValues: ["inbound", "outbound", "mixed"] , default : "inbound" },
        "x-sap-dpp-entity-semantics": {allowedValues: ["sap:DataSubject", "sap:DataSubjectDetails", "sap:Other"] },
        "x-sap-dpp-field-semantics": {allowedValues: ["sap:DataSubjectID", "sap:ConsentID", "sap:PurposeID", "sap:ContractRelatedID", "sap:LegalEntityID", "sap:DataControllerID", "sap:UserID", "sap:EndOfBusinessDate", "sap:BlockingDate", "sap:EndOfRetentionDate"] },
    };
    checkForExtensionEnums(extensionObj, extensionEnums);

    let extensionSchema = {
        "x-sap-stateInfo": ['state', 'deprecationDate', 'decomissionedDate', 'link'],
        "x-sap-ext-overview": ['name', 'values'],
        "x-sap-deprecated-operation" : ['deprecationDate', 'successorOperationRef', "successorOperationId"],
        "x-sap-odm-semantic-key" : ['name', 'values'],
    };

    checkForExtentionSchema(extensionObj, extensionSchema);
    return extensionObj;
}

/**
 * Check and validate extension enums
 * @param {object} extensionObj Extensions object to validate
 * @param {object} extensionEnums Valid enum values
 */
function checkForExtensionEnums(extensionObj, extensionEnums){
    for (const [key, value] of Object.entries(extensionObj)) {
        if(extensionEnums[key] && extensionEnums[key].allowedValues && !extensionEnums[key].allowedValues.includes(value)){
            if(extensionEnums[key].default){
                extensionObj[key] = extensionEnums[key].default;
            }
            else {
                delete extensionObj[key];
            }
        }
    }
}

/**
 * Check and validate extension schema
 * @param {object} extensionObj Extensions object to validate
 * @param {object} extensionSchema Valid schema properties
 */
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

/**
 * Handle nested annotation properties
 * @param {object} resObj Result object
 * @param {string} openapiProperty OpenAPI property name
 * @param {string[]} keys Property keys
 * @param {any} value Property value
 */
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

/**
 * Construct resource diagram using web service at https://yuml.me
 * @param {import('./types').CSDL} csdl CSDL document
 * @param {object} entityContainer Entity Container object
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {string} resource diagram
 */
function getResourceDiagram(csdl, entityContainer, namespace) {
    let diagram = '';
    let comma = '';
    //TODO: make colors configurable
    let color = { resource: '{bg:lawngreen}', entityType: '{bg:lightslategray}', complexType: '', external: '{bg:whitesmoke}' }

    Object.keys(csdl).filter(name => isIdentifier(name)).forEach(namespaceName => {
        const schema = csdl[namespaceName];
        Object.keys(schema).filter(name => isIdentifier(name) && ['EntityType', 'ComplexType'].includes(schema[name].$Kind))
            .forEach(typeName => {
                const type = schema[typeName];
                diagram += comma
                    + (type.$BaseType ? '[' + nameParts(type.$BaseType).name + ']^' : '')
                    + '[' + typeName + (type.$Kind == 'EntityType' ? color.entityType : color.complexType) + ']';
                Object.keys(type).filter(name => isIdentifier(name)).forEach(propertyName => {
                    const property = type[propertyName];
                    const targetNP = nameParts(property.$Type || 'Edm.String');
                    if (property.$Kind == 'NavigationProperty' || targetNP.qualifier != 'Edm') {
                        const target = modelElement(property.$Type, csdl, namespace);
                        const bidirectional = property.$Partner && target && target[property.$Partner] && target[property.$Partner].$Partner == propertyName;
                        // Note: if the partner has the same name then it will also be depicted
                        if (!bidirectional || propertyName <= property.$Partner) {
                            diagram += ',[' + typeName + ']'
                                + ((property.$Kind != 'NavigationProperty' || property.$ContainsTarget) ? '++' : (bidirectional ? cardinality(target[property.$Partner]) : ''))
                                + '-'
                                + cardinality(property)
                                + ((property.$Kind != 'NavigationProperty' || bidirectional) ? '' : '>')
                                + '['
                                + (target ? targetNP.name : property.$Type + color.external)
                                + ']';
                        }
                    }
                });
                comma = ',';
            });
    });

    Object.keys(entityContainer).filter(name => isIdentifier(name)).reverse().forEach(name => {
        const resource = entityContainer[name];
        if (resource.$Type) {
            diagram += comma
                + '[' + name + '%20' + color.resource + ']' // additional space in case entity set and type have same name
                + '++-'
                + cardinality(resource)
                + '>[' + nameParts(resource.$Type).name + ']';
        } else {
            if (resource.$Action) {
                diagram += comma
                    + '[' + name + color.resource + ']';
                const overload = modelElement(resource.$Action, csdl, namespace).find(pOverload => !pOverload.$IsBound);
                diagram += overloadDiagram(name, overload, color, comma, csdl, namespace);
            } else if (resource.$Function) {
                diagram += comma
                    + '[' + name + color.resource + ']';
                const overloads = modelElement(resource.$Function, csdl, namespace);
                if (overloads) {
                    const unbound = overloads.filter(overload => !overload.$IsBound);
                    // TODO: loop over all overloads, add new source box after first arrow
                    diagram += overloadDiagram(name, unbound[0], color, comma, csdl, namespace);
                }
            }
        }
    });

    if (diagram != '') {
        diagram = '\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/'
            + diagram
            + ')\n\n### Legend\n![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type' + color.external
            + '],[ComplexType' + color.complexType + '],[EntityType' + color.entityType
            + '],[EntitySet/Singleton/Operation' + color.resource + '])';
    }

    return diagram;
}

/**
 * Diagram representation of property cardinality
 * @param {object} typedElement Typed model element, e.g. property
 * @return {string} cardinality
 */
function cardinality(typedElement) {
    return typedElement.$Collection ? '*' : (typedElement.$Nullable ? '0..1' : '');
}

/**
 * Diagram representation of action or function overload
 * @param {string} name Name of action or function import
 * @param {object} overload Action or function overload
 * @param {object} color Color configuration
 * @param {string} comma Comma separator
 * @param {import('./types').CSDL} csdl CSDL document
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {string} diagram part
 */
function overloadDiagram(name, overload, color, comma, csdl, namespace) {
    let diag = "";
    if (overload.$ReturnType) {
        const type = modelElement(overload.$ReturnType.$Type || "Edm.String", csdl, namespace);
        if (type) {
            diag += "-" + cardinality(overload.$ReturnType) + ">[" + nameParts(overload.$ReturnType.$Type).name + "]";
        }
    }
    for (const param of overload.$Parameter || []) {
        const type = modelElement(param.$Type || "Edm.String", csdl, namespace);
        if (type) {
            diag += comma + "[" + name + color.resource + "]in-" + cardinality(param.$Type) + ">[" + nameParts(param.$Type).name + "]";
        }
    }
    return diag;
}

module.exports = {
    getInfo,
    getExternalDoc,
    getShortText,
    getExtensions
};
