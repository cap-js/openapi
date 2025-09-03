/**
 * CSDL Preprocessing Module
 *
 * Handles CSDL model preprocessing and vocabulary setup
 */

const { isIdentifier, modelElement, namespaceQualifiedName } = require('./model-navigation');

// Import CDS for debug functionality
const cds = require('@sap/cds');
const DEBUG = cds.debug('openapi');

/**
 * Construct map of qualified term names
 * @param {object} voc Map of vocabularies and terms
 * @param {object} alias Map of namespace or alias to alias
 */
function getVocabularies(voc, alias) {
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
            if (alias['Org.OData.' + vocab + '.V1'] != undefined)
                voc[vocab][term] = '@' + alias['Org.OData.' + vocab + '.V1'] + '.' + term;
        });
    });

    voc.Common = {
        Label: `@${alias['com.sap.vocabularies.Common.v1']}.Label`
    }
}

/**
 * Collect model info for easier lookup
 * @param {object} csdl CSDL document
 * @param {object} boundOverloads Map of action/function names to bound overloads
 * @param {object} derivedTypes Map of type names to derived types
 * @param {object} alias Map of namespace or alias to alias
 * @param {object} namespace Map of namespace or alias to namespace
 * @param {object} namespaceUrl Map of namespace to reference URL
 * @param {object} voc Map of vocabularies and terms
 */
function preProcess(csdl, boundOverloads, derivedTypes, alias, namespace, namespaceUrl, voc) {
    Object.keys(csdl.$Reference || {}).forEach(url => {
        const reference = csdl.$Reference[url];
        (reference.$Include || []).forEach(include => {
            const qualifier = include.$Alias || include.$Namespace;
            alias[include.$Namespace] = qualifier;
            namespace[qualifier] = include.$Namespace;
            namespace[include.$Namespace] = include.$Namespace;
            namespaceUrl[include.$Namespace] = url;
        });
    });

    getVocabularies(voc, alias);

    Object.keys(csdl).filter(name => isIdentifier(name)).forEach(name => {
        const schema = csdl[name];
        const qualifier = schema.$Alias || name;
        const isDefaultNamespace = schema[voc.Core.DefaultNamespace];

        alias[name] = qualifier;
        namespace[qualifier] = name;
        namespace[name] = name;

        Object.keys(schema).filter(iName => isIdentifier(iName)).forEach(iName2 => {
            const qualifiedName = qualifier + '.' + iName2;
            const element = schema[iName2];
            if (Array.isArray(element)) {
                element.filter(overload => overload.$IsBound).forEach(overload => {
                    const type = overload.$Parameter[0].$Type + (overload.$Parameter[0].$Collection ? '-c' : '');
                    boundOverloads[type] ??= [];
                    boundOverloads[type].push({ name: (isDefaultNamespace ? iName2 : qualifiedName), overload: overload });
                });
            } else if (element.$BaseType) {
                const base = namespaceQualifiedName(element.$BaseType, namespace);
                derivedTypes[base] ??= [];
                derivedTypes[base].push(qualifiedName);
            }
        });

        Object.keys(schema.$Annotations || {}).forEach(target => {
            const annotations = schema.$Annotations[target];
            const segments = target.split('/');
            const firstSegment = segments[0];
            const open = firstSegment.indexOf('(');
            let element;
            if (open == -1) {
                element = modelElement(firstSegment, csdl, namespace);
            } else {
                element = modelElement(firstSegment.substring(0, open), csdl, namespace);
                let args = firstSegment.substring(open + 1, firstSegment.length - 1);
                element = element.find(
                    (overload) =>
                        (overload.$Kind === "Action" &&
                            overload.$IsBound != true &&
                            args === "") ||
                        (overload.$Kind === "Action" &&
                            args ===
                            (overload.$Parameter[0].$Collection
                                ? `Collection(${overload.$Parameter[0].$Type})`
                                : overload.$Parameter[0].$Type || "")) ||
                        (overload.$Parameter || [])
                            .map((p) => {
                                const type = p.$Type || "Edm.String";
                                return p.$Collection ? `Collection(${type})` : type;
                            })
                            .join(",") == args
                );
            }
            if (!element) {
                DEBUG?.(`Invalid annotation target '${target}'`);
            } else if (Array.isArray(element)) {
                //TODO: action or function:
                //- loop over all overloads
                //- if there are more segments, a parameter or the return type is targeted
            } else {
                switch (segments.length) {
                    case 1:
                        Object.assign(element, annotations);
                        break;
                    case 2: {
                        const secondSegment = /**@type{string}*/(segments[1])
                        if (['Action', 'Function'].includes(element.$Kind)) {
                            if (secondSegment === '$ReturnType') {
                                if (element.$ReturnType)
                                    Object.assign(element.$ReturnType, annotations);
                            } else {
                                const parameter = element.$Parameter.find(p => p.$Name == secondSegment);
                                Object.assign(parameter, annotations);
                            }
                        } else if (element[secondSegment]) {
                            Object.assign(element[secondSegment], annotations);
                        }
                        break;
                    }
                    default:
                        DEBUG?.('More than two annotation target path segments');
                }
            }
        });
    });
}

module.exports = {
    preProcess,
    getVocabularies
};