# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
The format is based on [Keep a Changelog](http://keepachangelog.com/).


## Version 1.1.0  - tbd

### Fixed

- Fixed allowedValues on all primitive types.
- Removed duplicates in `tags`.

## Version 1.0.7 - 17.10.2024

### Fixed

- Multiple protocols for a service now renders multiple openapi documents.
- Format and type are now preserved for function parameters.
- Fixed allowedValues on all primitive types.

### Changed

- Using `@title`, `@Core.Description` and `@Core.LongDescription` for titles and descriptions for improving the default texts in `info` object and `x-sap-shortText`.

### Added

- OpenAPI documents can now have `externalDocs` object provided through `@OpenAPI.externalDocs` annotation in the service level of CDS.
- OpenAPI documents now throws warning if `securitySchemas` are not found.

## Version 1.0.6 - 23.09.2024

### Fixed

- Entities annotated with `@cds.autoexpose[d]` but explicitly exposed in the service are now made read-write.
- Added a wrapper `properties` object for primitive return types.
- Adding protocol and service name information to the server URL incase of `openapi:servers` option.

### Changed

- Using `@title`, `@Core.Description` and `@Core.LongDescription` for titles and descriptions for improving the default texts in `info` object and `x-sap-shortText`.

## Version 1.0.5 - 30.07.2024

### Changed

- UUID type elements are not going to have the property of required.

### Fixed

- properties with `@mandatory` annotation is not added to `required` array.

## Version 1.0.4 - 14.05.2024

### Changed

- Minor changes

## Version 1.0.3 - 14.05.2024

### Changed

- Removed registering compile target

## Version 1.0.2 - 02.05.2024

### Fixed

- Bug fixes

## Version 1.0.1 - 02.05.2024

### Fixed

- Bug fixes

## Version 1.0.0 - 02.05.2024

### Added

- Initial release
- Introduced --openapi:config-file option to incorporate all the options for cds compile command in a JSON configuration file, inline options take precedence over those defined in the configuration file.
