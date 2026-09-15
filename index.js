const { compileToOpenAPI } = require('./lib/compile');
const importOpenAPI = require('./lib/import');

module.exports = {
    compile: compileToOpenAPI,
    import: importOpenAPI
}
