/**
 * Convert camel-cased name into words,
 * while leaving acronyms untouched.
 * @example
 * ```
 * foo_bar_baz ->  foo bar baz
 * camelCase -> camel case
 * HTTPServer -> HTTP server
 * XMLHTTPServer -> XML HTTP server
 * ```
 * @param {string} str string to split
 * @return {string} split string
 */
const camelCaseToWords = str => str
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Handle sequences of uppercase letters
    .replace(/\b([A-Z])([a-z]+)/g, (_, first, rest) => first.toLowerCase() + rest) // Lowercase non-acronyms

module.exports = { camelCaseToWords };
