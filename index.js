const cds = require('@sap/cds')

function _lazyRegisterCompileTarget() {
  const value = require('./lib/compile/index')
  Object.defineProperty(this, "openapi", { value })
  return value
}

const registerOpenapiCompileTarget = () => {
    Object.defineProperty(cds.compile.to, "openapi", {
      get: _lazyRegisterCompileTarget,
      configurable: true
    })
  }


module.exports = { registerOpenapiCompileTarget }
