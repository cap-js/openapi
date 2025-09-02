/**
 * Model Navigation Utilities
 * 
 * Provides utilities for navigating and querying CSDL model elements
 */

/**
 * An identifier does not start with $ and does not contain @
 * @param {string} name
 * @return {boolean} name is an identifier
 */
function isIdentifier(name) {
    return !name.startsWith('$') && !name.includes('@');
}

/**
 * A qualified name consists of a namespace or alias, a dot, and a simple name
 * @param {string} qualifiedName
 * @return {object} with components qualifier and name
 */
function nameParts(qualifiedName) {
    const pos = qualifiedName.lastIndexOf('.');
    console.assert(pos > 0, 'Invalid qualified name ' + qualifiedName);
    return {
        qualifier: qualifiedName.substring(0, pos),
        name: qualifiedName.substring(pos + 1)
    };
}

/**
 * Convert qualified name to namespace-qualified name
 * @param {string} qualifiedName
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {string} namespace-qualified name
 */
function namespaceQualifiedName(qualifiedName, namespace) {
    let np = nameParts(qualifiedName);
    return namespace[np.qualifier] + '.' + np.name;
}

/**
 * Find model element by qualified name
 * @param {string} qname Qualified name of model element
 * @param {object} csdl CSDL document
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {object|null} Model element or null if not found
 */
function modelElement(qname, csdl, namespace) {
    if (!qname) return null;
    const q = nameParts(qname);
    const schema = csdl[q.qualifier] || csdl[namespace[q.qualifier]];
    return schema ? schema[q.name] : null;
}

/**
 * Get all properties of a structured type, including inherited properties
 * @param {object} type Structured type (EntityType or ComplexType)
 * @param {object} csdl CSDL document
 * @param {object} namespace Map of namespace or alias to namespace
 * @return {object} Map of properties
 */
function propertiesOfStructuredType(type, csdl, namespace) {
    const properties = (type && type.$BaseType) ? propertiesOfStructuredType(modelElement(type.$BaseType, csdl, namespace), csdl, namespace) : {};
    if (type) {
        Object.keys(type).filter(name => isIdentifier(name)).forEach(name => {
            properties[name] = type[name];
        });
    }
    return properties;
}

/**
 * Unpack EnumMember value if it uses CSDL JSON CS01 style, like CAP does
 * @param {string | object} member Qualified name of referenced type
 * @return {string} Reference Object
 */
function enumMember(member) {
    if (typeof member == 'string')
        return member;
    else if (typeof member == 'object' && member.$EnumMember)
        return member.$EnumMember;
    return '';
}

/**
 * Unpack NavigationPropertyPath value if it uses CSDL JSON CS01 style, like CAP does
 * @param {string | object} path Qualified name of referenced type
 * @return {string} Reference Object
 */
function navigationPropertyPath(path) {
    if (typeof path == 'string')
        return path;
    else if (typeof path == 'object' && path.$NavigationPropertyPath)
        return path.$NavigationPropertyPath;
    return '';
}

/**
 * Unpack PropertyPath value if it uses CSDL JSON CS01 style, like CAP does
 * @param {string | object} path Qualified name of referenced type
 * @return {string} Reference Object
 */
function propertyPath(path) {
    if (typeof path == 'string')
        return path;
    else if (typeof path == 'object' && path.$PropertyPath)
        return path.$PropertyPath;
    return '';
}

module.exports = {
    isIdentifier,
    nameParts,
    namespaceQualifiedName,
    modelElement,
    propertiesOfStructuredType,
    enumMember,
    navigationPropertyPath,
    propertyPath
};
