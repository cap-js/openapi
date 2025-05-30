# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Version 1.2.3 - 28.05.2025

### Added

- Now writes config file path in case of errors.

## Version 1.2.2 - 13.05.2025

### Fixed

- Properties with `@mandatory` annotation is now added to `required` array.

## Version 1.2.1 - 11.03.2025

### Changed

- Replaced `console.warn` statements with `cds.debug` logs for warning messages.

## Version 1.2.0 - 28.02.2025

### Added

- Now supports `@EntityRelationship` annotations.

### Fixed

- Parameter aliases conflict with system query options.
- Fixed action/function invocation on navigation path to align with CAP runtime.

## Version 1.1.2 - 27.01.2025

### Added

- Now supports `odata-v4` protocol in the `@protocol` allowed values in CDS along with `odata` and `rest`.

### Fixed

- Fixed the filename issue: when there is only one service in the CDL source, the OpenAPI document is now generated with the filename corresponding to the service name rather than the CDL source filename.

## Version 1.1.1 - 13.12.2024

### Fixed

- Fixes server URL based on the version provided by `--odata-version` value.

## Version 1.1.0 - 04.12.2024

### Added

- Now supports `x-sap` extensions using `@OpenAPI.Extensions` annotations in service, entity and function/action level.

### Fixed

- Fixed allowedValues on all primitive types.
- Removed duplicates in `tags`.
- No longer append protocol and service name information to the server URL incase of `openapi:servers` option.

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
- Introduced `--openapi:config-file` option to incorporate all the options for cds compile command in a JSON configuration file, inline options take precedence over those defined in the configuration file.

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
