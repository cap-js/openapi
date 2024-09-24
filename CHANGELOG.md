# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).
The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Version 1.0.6 - 23.09.2024

### Fixed

- Entities annotated with `@cds.autoexpose[d]` but explicitly exposed in the service are now made read-write.
- Added a wrapper `properties` object for primitive return types.

- Adding protocol and service name information to the server URL incase of `openapi:servers` option.

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
