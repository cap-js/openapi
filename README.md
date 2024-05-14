[![REUSE status](https://api.reuse.software/badge/github.com/cap-js/openapi)](https://api.reuse.software/info/github.com/cap-js/openapi)

# OpenAPI 

## About this project

The `@cap-js/openapi` is a package that provides support for OpenAPI document compilation.

### Table of Contents

- [Requirements and Setup](#requirements-and-setup)
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

## Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/cap-js/openapi/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/cap-js/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2023 SAP SE or an SAP affiliate company and contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/cap-js/openapi).
