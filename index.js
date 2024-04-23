const cds = require('@sap/cds')

function _lazyRegisterCompileTargets() {
  const value = require('./lib/compile/index')
  Object.defineProperty(this, "openapi", { value })
  return value
}

const registerCompileTargets = () => {
    Object.defineProperty(cds.compile.to, "openapi", {
      get: _lazyRegisterCompileTargets,
      configurable: true
    })
  }


module.exports = { registerCompileTargets }
