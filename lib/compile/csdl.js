/**
 * Provides functionality to look up elements in a CSDL document
 * or meta information thereof.
 */

const cds = require('@sap/cds');
const DEBUG = cds.debug('openapi');

const CDS_TERMS = Object.freeze({
    Authorization: ['Authorizations', 'SecuritySchemes'],
    Capabilities: ['BatchSupport', 'BatchSupported', 'ChangeTracking', 'CountRestrictions', 'DeleteRestrictions', 'DeepUpdateSupport', 'ExpandRestrictions',
        'FilterRestrictions', 'IndexableByKey', 'InsertRestrictions', 'KeyAsSegmentSupported', 'NavigationRestrictions', 'OperationRestrictions',
        'ReadRestrictions', 'SearchRestrictions', 'SelectSupport', 'SkipSupported', 'SortRestrictions', 'TopSupported', 'UpdateRestrictions'],
    Core: ['AcceptableMediaTypes', 'Computed', 'ComputedDefaultValue', 'DefaultNamespace', 'Description', 'Example', 'Immutable', 'LongDescription',
        'OptionalParameter', 'Permissions', 'SchemaVersion'],
    JSON: ['Schema'],
    Validation: ['AllowedValues', 'Exclusive', 'Maximum', 'Minimum', 'Pattern']
})

/**
 * a qualified name consists of a namespace or alias, a dot, and a simple name
 * @param {string} qualifiedName
 */
function nameParts(qualifiedName) {
    const pos = qualifiedName.lastIndexOf('.');
    console.assert(pos > 0, `Invalid qualified name ${qualifiedName}`);
    return {
        qualifier: qualifiedName.substring(0, pos),
        name: qualifiedName.substring(pos + 1)
    };
}


/**
 * an identifier does not start with $ and does not contain @
 * @param {string} name
 */
function isIdentifier(name) {
    return !name.startsWith('$') && !name.includes('@');
}

class CSDLMeta {
    /** CSDL document */
    csdl = {}
    /** Map of action/function names to bound overloads */
    boundOverloads = {}
    /** Map of type names to derived types */
    derivedTypes = {}
    /** Map of namespace or alias to alias */
    alias = {}
    /** Map of namespace or alias to namespace */
    namespace = { 'Edm': 'Edm' }
    /** Map of namespace to reference URL */
    namespaceUrl = {}
    /** Map of vocabularies and terms */
    voc = {}

    constructor(csdl) {
        this.csdl = csdl;
        this.#preProcess()
    }

    /**
     * Collect model info for easier lookup
     */
    #preProcess() {
        Object.keys(this.csdl.$Reference || {}).forEach(url => {
            const reference = this.csdl.$Reference[url];
            (reference.$Include || []).forEach(include => {
                const qualifier = include.$Alias || include.$Namespace;
                this.alias[include.$Namespace] = qualifier;
                this.namespace[qualifier] = include.$Namespace;
                this.namespace[include.$Namespace] = include.$Namespace;
                this.namespaceUrl[include.$Namespace] = url;
            });
        });

        this.#getVocabularies(this.alias);

        Object.keys(this.csdl).filter(name => isIdentifier(name)).forEach(name => {
            const schema = this.csdl[name];
            const qualifier = schema.$Alias || name;
            const isDefaultNamespace = schema[this.voc.Core.DefaultNamespace];

            this.alias[name] = qualifier;
            this.namespace[qualifier] = name;
            this.namespace[name] = name;

            Object.keys(schema).filter(iName => isIdentifier(iName)).forEach(iName2 => {
                const qualifiedName = `${qualifier}.${iName2}`;
                const element = schema[iName2];
                if (Array.isArray(element)) {
                    element.filter(overload => overload.$IsBound).forEach(overload => {
                        const type = overload.$Parameter[0].$Type + (overload.$Parameter[0].$Collection ? '-c' : '');
                        if (!this.boundOverloads[type]) this.boundOverloads[type] = [];
                        this.boundOverloads[type].push({ name: (isDefaultNamespace ? iName2 : qualifiedName), overload });
                    });
                } else if (element.$BaseType) {
                    const base = this.namespaceQualifiedName(element.$BaseType);
                    if (!this.derivedTypes[base]) this.derivedTypes[base] = [];
                    this.derivedTypes[base].push(qualifiedName);
                }
            });

            Object.keys(schema.$Annotations ?? {}).forEach(target => {
                const annotations = schema.$Annotations[target];
                const segments = target.split('/');
                const firstSegment = segments[0];
                const open = firstSegment.indexOf('(');
                let element;
                if (open == -1) {
                    this.namespace
                    element = this.modelElement(firstSegment);
                } else {
                    element = this.modelElement(firstSegment.substring(0, open));
                    const args = firstSegment.substring(open + 1, firstSegment.length - 1);
                    element = element.find(
                        (overload) =>
                            (overload.$Kind == "Action" &&
                                overload.$IsBound != true &&
                                args == "") ||
                            (overload.$Kind == "Action" &&
                                args ==
                                (overload.$Parameter[0].$Collection
                                    ? `Collection(${overload.$Parameter[0].$Type})`
                                    : overload.$Parameter[0].$Type ?? "")) ||
                            (overload.$Parameter ?? [])
                                .map((p) => {
                                    const type = p.$Type ?? "Edm.String";
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

    /**
     * Construct map of qualified term names
     * @param {object} alias Map of namespace or alias to alias
     */
    #getVocabularies(alias) {
        Object.keys(CDS_TERMS).forEach(vocab => {
            this.voc[vocab] = {};
            CDS_TERMS[vocab].forEach(term => {
                if (alias[`Org.OData.${vocab}.V1`] != undefined)
                    this.voc[vocab][term] = `@${alias[`Org.OData.${vocab}.V1`]}.${term}`;
            });
        });

        this.voc.Common = {
            Label: `@${alias['com.sap.vocabularies.Common.v1']}.Label`
        }
    }

    /**
     * Find model element by qualified name
     * @param {string} qname Qualified name of model element
     * @return {object} Model element
     */
    modelElement(qname) {
        const q = nameParts(qname);
        const schema = this.csdl[q.qualifier] ?? this.csdl[this.namespace[q.qualifier]];
        return schema ? schema[q.name] : null;
    }

    /**
     * a qualified name consists of a namespace or alias, a dot, and a simple name
     * @param {string} qualifiedName
     */
    namespaceQualifiedName(qualifiedName) {
        const { qualifier, name } = nameParts(qualifiedName);
        return `${this.namespace[qualifier]}.${name}`;
    }
}

module.exports = {
    CSDLMeta,
    isIdentifier,
    nameParts
}
