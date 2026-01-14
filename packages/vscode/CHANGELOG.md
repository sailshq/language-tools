# Changelog

All notable changes to the Sails.js VS Code extension will be documented in this file.

## [0.6.1] - 2025-01-14

### Fixed

- Fixed false positive errors when files from other projects are opened in the same VS Code window

## [0.6.0] - 2025-01-11

### Added

- **Command Palette Generators** - Run Sails generators directly from VS Code (`Cmd/Ctrl + Shift + P`):

  - `Sails: Generate Action` - Create actions at `api/controllers/`
  - `Sails: Generate Model` - Create models at `api/models/`
  - `Sails: Generate Helper` - Create helpers at `api/helpers/`
  - `Sails: Generate Hook` - Create Sails hooks
  - `Sails: Generate Response` - Create custom responses at `api/responses/`
  - `Sails: Generate Adapter` - Create custom adapters at `api/adapters/`

- **Quick Fixes** - Click the lightbulb to generate missing actions and models directly from error diagnostics

- **Auto-Refresh Validation** - Extension automatically refreshes when files are created, deleted, or renamed in `api/` and `config/` directories

### Fixed

- Fixed cascade validation error where all routes showed "action not found" when only one was missing
- Fixed action existence validation to properly detect missing action files
- Removed circular devDependency in language-server package

### Changed

- Refactored code actions with factory pattern for better extensibility
- Improved rspack configuration with absolute output path

## [0.5.2] - 2024-12-15

### Added

- Helper input validation and completions
- Model attribute validation in Waterline queries
- Go-to-definition for helper inputs

### Fixed

- Various bug fixes and performance improvements

## [0.4.1] - 2024-11-20

### Added

- Initial release with core features:
  - IntelliSense for actions, models, helpers, policies, and views
  - Go-to-definition support
  - Diagnostics and validation
  - EJS template support
