[![REUSE status](https://api.reuse.software/badge/github.com/cap-js/openapi)](https://api.reuse.software/info/github.com/cap-js/openapi)

# OpenAPI

## About this project

The `@cap-js/openapi` is a package that provides support for OpenAPI document compilation.

### Table of Contents

- [OpenAPI](#openapi)
  - [About this project](#about-this-project)
    - [Table of Contents](#table-of-contents)
  - [Requirements and Setup](#requirements-and-setup)
    - [Installation](#installation)
    - [Usage](#usage)
      - [Customizing OpenAPI Output](#customizing-openapi-output)
  - [Contributing](#contributing)
  - [Code of Conduct](#code-of-conduct)
  - [Licensing](#licensing)

## Requirements and Setup

### Installation

```sh
$ npm install @cap-js/openapi
```

### Usage

```js
const cds = require('@sap/cds')
const { compile } = require('@cap-js/openapi')
```

```js
const csn = await cds.load(cds.env.folders.srv)
const openapiDocument = compile(csn)
```

#### Customizing OpenAPI Output

You can synchronously hook into the compilation process using the `after:compile.to.openapi` event to modify the generated OpenAPI document:

```js
cds.on('after:compile.to.openapi', ({ csn, options, result }) => {
  // Add custom vendor extensions
  result['x-api-id'] = 'my-api-id'

  // Enhance the info section
  result.info.contact = {
    name: 'API Support',
    email: 'support@example.com'
  }
  result.info.license = {
    name: 'Apache 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
  }

  // Add additional servers for different environments
  result.servers.push({
    url: 'https://api-dev.example.com',
    description: 'Development server'
  })
})
```

The event handler receives an object with:
- `csn` - The input CSN model
- `options` - The compilation options used
- `result` - The generated OpenAPI document (can be modified by reference)

In the same vein, you can also subscribe to `compile.to.openapi`, to modify the incoming CSN before it is converted:

```js
cds.on('compile.to.openapi', ({ csn, options }) => {
  // exclude MySecretEntity from output
  delete csn.definitions.MySecretEntity
})
```

The handler for events should never be async to avoid race conditions between the handler and the conversion process!


## Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js/openapi/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/cap-js/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2023 SAP SE or an SAP affiliate company and contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js/openapi).
