/** @typedef {import('./csdl').CSDLMeta} CSDLMeta */

/**
 * @typedef {object} CSDLProperty
 * @property {string} [$Kind]
 * @property {string} [$Type]
 * @property {string} [$Partner]
 * @property {boolean} [$ContainsTarget]
 * @property {boolean} [$Collection]
 * @property {string} [$OnDelete]
 */

/**
 * @typedef {object} PropertyPredicates
 * @property {(property: CSDLProperty) => boolean} isNavBackReference - True when the nav property is the back-reference side of a composition (child -> parent)
 * @property {(property: CSDLProperty) => boolean} isNavWritable - True when the nav property may be written by the client (create/update)
 * @property {(property: CSDLProperty) => boolean} isScalarReadOnly - True when the scalar property is read-only or computed (must be removed from required)
 * @property {(property: CSDLProperty) => boolean} isScalarWritable - True when the scalar property may be written by the client (create/update)
 */

/**
 * Returns property predicate functions bound to the given CSDL metadata instance.
 * @param {CSDLMeta} meta
 * @returns {PropertyPredicates}
 */
module.exports = (meta) => ({
    isNavBackReference: (property) =>
        !!property.$Partner
        && !!property.$Type
        && !!meta.modelElement(property.$Type)?.[property.$Partner]?.$ContainsTarget,

    isNavWritable: (property) =>
        property[meta.voc.Core.Permissions] != "Read"
        && !property[meta.voc.Core.Computed]
        && (property.$ContainsTarget || property.$OnDelete === 'Cascade'),

    isScalarReadOnly: (property) =>
        property[meta.voc.Core.Permissions] === "Read"
        || property[meta.voc.Core.Computed]
        || property[meta.voc.Core.ComputedDefaultValue],

    isScalarWritable: (property) =>
        property[meta.voc.Core.Permissions] !== "Read"
        && !property[meta.voc.Core.Computed],
});
