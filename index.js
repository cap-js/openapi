const { compileToOpenAPI, events, emitter } = require('./lib/compile');

module.exports = {
    compile: compileToOpenAPI,
    events,
    emitter
}
