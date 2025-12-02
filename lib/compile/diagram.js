/**
 * Functionality to create a yuml.me diagram from CSDL.
 */

const { isIdentifier, nameParts } = require('./csdl');

/**
 * Diagram representation of property cardinality
 * @param {object} typedElement Typed model element, e.g. property
 * @return {string} cardinality
 */
function cardinality(typedElement) {
    return typedElement.$Collection ? '*' : (typedElement.$Nullable ? '0..1' : '');
}

class Diagram {
    /** @type {import('./csdl').CSDLMeta} */
    #meta
    #comma = ''
    // TODO: make colors configurable
    #color = { resource: '{bg:lawngreen}', entityType: '{bg:lightslategray}', complexType: '', external: '{bg:whitesmoke}' }

    constructor(meta) {
        this.#meta = meta;
    }

    /**
     * Construct resource diagram using web service at https://yuml.me
     * @param {object} entityContainer Entity Container object
     * @return {string} resource diagram
     */
    getResourceDiagram(entityContainer) {
        let diagram = '';
        this.#comma = '';

        Object.keys(this.#meta.csdl).filter(name => isIdentifier(name)).forEach(namespace => {
            const schema = this.#meta.csdl[namespace];
            Object.keys(schema)
                .filter(name => isIdentifier(name) && ['EntityType', 'ComplexType'].includes(schema[name].$Kind))
                .forEach(typeName => {
                    const type = schema[typeName];
                    diagram += `${this.#comma + (type.$BaseType ? `[${nameParts(type.$BaseType).name}]^` : '')}[${typeName}${type.$Kind == 'EntityType' ? this.#color.entityType : this.#color.complexType}]`;
                    Object.keys(type).filter(name => isIdentifier(name)).forEach(propertyName => {
                        const property = type[propertyName];
                        const targetNP = nameParts(property.$Type || 'Edm.String');
                        if (property.$Kind == 'NavigationProperty' || targetNP.qualifier != 'Edm') {
                            const target = this.#meta.modelElement(property.$Type);
                            const bidirectional = property.$Partner && target && target[property.$Partner] && target[property.$Partner].$Partner == propertyName;
                            // Note: if the partner has the same name then it will also be depicted
                            if (!bidirectional || propertyName <= property.$Partner) {
                                diagram += `,[${typeName}]${(property.$Kind != 'NavigationProperty' || property.$ContainsTarget) ? '++' : (bidirectional ? cardinality(target[property.$Partner]) : '')}-${cardinality(property)}${(property.$Kind != 'NavigationProperty' || bidirectional) ? '' : '>'}[${target ? targetNP.name : property.$Type + this.#color.external}]`;
                            }
                        }
                    });
                    this.#comma = ',';
                });
        });

        Object.keys(entityContainer).filter(name => isIdentifier(name)).reverse().forEach(name => {
            const resource = entityContainer[name];
            if (resource.$Type) {
                diagram += `${this.#comma}[${name}%20${this.#color.resource}]` // additional space in case entity set and type have same name
                    + `++-${cardinality(resource)}>[${nameParts(resource.$Type).name}]`;
            } else if (resource.$Action) {
                    diagram += `${this.#comma}[${name}${this.#color.resource}]`;
                    const overload = this.#meta.modelElement(resource.$Action).find(pOverload => !pOverload.$IsBound);
                    diagram += this.#overloadDiagram(name, overload);
                } else if (resource.$Function) {
                    diagram += `${this.#comma}[${name}${this.#color.resource}]`;
                    const overloads = this.#meta.modelElement(resource.$Function);
                    if (overloads) {
                        const unbound = overloads.filter(overload => !overload.$IsBound);
                        // TODO: loop over all overloads, add new source box after first arrow
                        diagram += this.#overloadDiagram(name, unbound[0]);
                    }
                }
        });

        if (diagram != '') {
            diagram = `\n\n## Entity Data Model\n![ER Diagram](https://yuml.me/diagram/class/${diagram})\n\n### Legend\n![Legend](https://yuml.me/diagram/plain;dir:TB;scale:60/class/[External.Type${this.#color.external}],[ComplexType${this.#color.complexType}],[EntityType${this.#color.entityType}],[EntitySet/Singleton/Operation${this.#color.resource}])`;
        }

        return diagram;
    }

    /**
     * Diagram representation of action or function overload
     * @param {string} name Name of action or function import
     * @param {object} overload Action or function overload
     * @return diagram part
     */
    #overloadDiagram(name, overload) {
        let diag = "";
        if (overload.$ReturnType) {
            const type = this.#meta.modelElement(overload.$ReturnType.$Type || "Edm.String");
            if (type) {
                diag += `-${cardinality(overload.$ReturnType)}>[${nameParts(overload.$ReturnType.$Type).name}]`;
            }
        }
        for (const param of overload.$Parameter || []) {
            const type = this.#meta.modelElement(param.$Type || "Edm.String");
            if (type) {
                diag += `${this.#comma}[${name}${this.#color.resource}]in-${cardinality(param.$Type)}>[${nameParts(param.$Type).name}]`;
            }
        }
        return diag;
    }
}

module.exports = {
    Diagram
}
