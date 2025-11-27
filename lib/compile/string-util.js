/**
 * Convert camel-cased name into words,
 * while leaving acronyms untouched.
 * @example
 * ```
 * foo_bar_baz ->  foo bar baz
 * camelCase -> camel case
 * HTTPServerForXML -> HTTP server for XML
 * ```
 * @param {string} str string to split
 * @return {string} split string
 */
const camelCaseToWords = str => str
    .replaceAll('_', ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // Handle camelCase and numbers followed by uppercase
    .replace(/([A-Z])([A-Z])(?=[a-z])/g, '$1 $2') // Split consecutive uppercase letters before lowercase
    .replace(/\b([A-Z])([a-z]+)/g, (_, first, rest) => first.toLowerCase() + rest) // Lowercase non-acronyms
    .replace(/\b([A-Z])\b/g, match => match.toLowerCase()) // Lowercase single uppercase letters

module.exports = { camelCaseToWords };
