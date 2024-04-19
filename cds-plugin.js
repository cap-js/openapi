// const cds = module.exports = require('@sap/cds/lib');

// class OpenAPI {
  
//     get compile() {
//       let compile = require('@sap/cds/lib/compile/cds-compile')
//       cds.extend (compile.to.constructor) .with (class {
//         get openapi() { return super.openapi = require('./lib/compile') }
//       })
//       return super.compile = compile
//     }
// }

// cds.extend (cds.constructor) .with (OpenAPI);

// require('./lib/compile/api').registerCompileTargets()
const cds = require('@sap/cds')
require('./lib/compile/api').registerCompileTargets()