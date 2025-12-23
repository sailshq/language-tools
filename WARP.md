# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Sails Language Tools is a monorepo containing a Language Server Protocol (LSP) implementation and VS Code extension for Sails.js development. The project provides IntelliSense, go-to-definition, validation, and diagnostics for Sails.js applications.

## Repository Structure

This is a monorepo with two main packages:

- `packages/language-server/` - The LSP server that provides all language features
- `packages/vscode/` - VS Code extension client that communicates with the language server

### Language Server Architecture (`packages/language-server/`)

The language server is built around a central `SailsParser` class that parses Sails.js projects and builds a comprehensive type map. Key components:

- `SailsParser.js` - Core parser that uses Acorn to analyze JavaScript files and extract metadata about actions, models, helpers, views, policies, and Inertia pages
- `index.js` - Main LSP server entry point that handles initialization, document sync, completions, and go-to-definition requests
- `completions/` - 12 completion providers for different Sails.js contexts (actions, models, data types, policies, views, helpers, Inertia pages, etc.)
- `go-to-definitions/` - 6 go-to-definition providers for navigating between Sails.js components
- `validators/` - 11 validators that provide real-time diagnostics for common Sails.js errors

The typeMap is rebuilt when files in `api/` or `config/` directories change, ensuring accurate completions and diagnostics.

### VS Code Extension (`packages/vscode/`)

- `src/index.js` - Extension activation logic that starts the language client
- Bundles both client and server code using Rspack for distribution
- Activates when `.sailsrc` file is detected in workspace
- Provides EJS syntax highlighting and language configuration

## Development Commands

### Building & Watching

```bash
npm run watch
```

Builds the VS Code extension in watch mode (runs `rspack build --watch` in packages/vscode).

```bash
npm run build
```

Build the VS Code extension for production (in packages/vscode, runs `rspack build`).

### Packaging & Publishing

```bash
npm run pack
```

Creates a `.vsix` package file for distribution (in packages/vscode).

```bash
npm run publish
```

Publishes the VS Code extension to the marketplace (in packages/vscode).

### Language Server Development

To run the language server standalone:

```bash
cd packages/language-server
npm start
```

For watch mode with auto-restart on changes:

```bash
cd packages/language-server
npm run watch
```

### Code Quality

This project uses:

- **Prettier** for code formatting (configured in `.prettierrc.js` with no semicolons, single quotes, no trailing commas)
- **Husky** for git hooks
- **lint-staged** to format files on commit
- **commitlint** with conventional commits format

Prettier runs automatically on staged files via lint-staged. Manual formatting:

```bash
npx prettier --write .
```

## Working with the Codebase

### Adding New Completions

1. Create a new file in `packages/language-server/completions/`
2. Export a function that takes `(document, position, typeMap)` and returns completion items array
3. Import and call it in `packages/language-server/index.js` within the `onCompletion` handler
4. Add completion items to the aggregated array

### Adding New Validators

1. Create a new file in `packages/language-server/validators/`
2. Export a function that takes `(document, typeMap)` and returns diagnostics array
3. Import and call it in `packages/language-server/validators/validate-document.js`
4. Add diagnostics to the aggregated array

### Adding Go-to-Definition Support

1. Create a new file in `packages/language-server/go-to-definitions/`
2. Export a function that takes `(document, position, typeMap)` and returns location or null
3. Import and call it in `packages/language-server/index.js` within the `onDefinition` handler
4. Add to the Promise.all array and filter for non-null results

### Extending SailsParser

The `SailsParser` class is responsible for discovering and parsing Sails.js project files. To add support for new Sails.js constructs:

1. Add parsing methods to `SailsParser.js` (private methods use `#` prefix)
2. Update `buildTypeMap()` method to include new data in the returned typeMap object
3. The typeMap is automatically rebuilt when files in `api/` or `config/` change

## Testing

Currently, there are no automated tests in this repository. When adding tests:

- Place test files adjacent to the code they test
- Use `.test.js` or `.spec.js` naming convention
- Add test script to the relevant package.json

## Important Notes

- The extension only activates in workspaces containing a `.sailsrc` file (standard Sails.js project marker)
- All language features rely on the typeMap built by SailsParser, which analyzes the project structure at initialization
- The language server expects a standard Sails.js project structure with `api/`, `config/`, and `views/` directories
- When debugging the extension, the language server runs in a separate process with optional debugging on port 6009
