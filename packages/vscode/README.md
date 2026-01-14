# Sails.js Support for Visual Studio Code

> ⛵ Not sure what Sails.js is? Check out the official website at [sailsjs.com](https://sailsjs.com)!

This extension brings advanced Sails.js development features to Visual Studio Code, powered by a custom language server tailored for the Sails.js framework. It provides deep project awareness, smart completions, navigation, diagnostics, and more for a productive Sails.js experience.

## Features

### 🚀 Command Palette Generators

Run Sails generators directly from VS Code's Command Palette (`Cmd/Ctrl + Shift + P`):

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `Sails: Generate Action`   | Create a new action at `api/controllers/`    |
| `Sails: Generate Model`    | Create a new model at `api/models/`          |
| `Sails: Generate Helper`   | Create a new helper at `api/helpers/`        |
| `Sails: Generate Hook`     | Create a new Sails hook                      |
| `Sails: Generate Response` | Create a custom response at `api/responses/` |
| `Sails: Generate Adapter`  | Create a custom adapter at `api/adapters/`   |

### ⚡ Quick Fixes

When you reference an action or model that doesn't exist, the extension offers a quick fix to generate it automatically. Just click the lightbulb or press `Cmd/Ctrl + .` to generate the missing file instantly.

### 🔄 Auto-Refresh Validation

The extension automatically refreshes validation when files are created, deleted, or renamed in `api/` and `config/` directories. No more stale errors!

### 💡 Completions (IntelliSense)

- Controller action completions in `routes.js` and controller files
- Model attribute completions in criteria, `.select`, `.omit`, `.sort`, and `.populate` (with association awareness)
- Model method and chainable method completions (e.g., `User.find().select`)
- Data type completions for model and input definitions
- Model attribute property completions (e.g., `type`, `required`, `defaultsTo`, etc.)
- Input property completions for helpers and controllers
- View, policy, and Inertia page completions
- Sails model completions (e.g., `sails.models.user`)
- Helper completions (e.g., `sails.helpers.mail.send`)

### 🔗 Go to Definition

- Jump to controller actions from `routes.js`
- Jump to views, policies, models, helpers, and Inertia pages from references
- Jump to model attributes from query criteria
- Jump to helper inputs from `.with()` calls

### 🔍 Diagnostics & Validation

- Detects missing or invalid controller actions in `routes.js`
- Detects missing models and validates model existence
- Validates model attribute existence in criteria, `.select`, `.omit`, `.sort`, and `.populate`
- Validates helper input properties in `.with()` calls
- Validates required model attributes and helper inputs
- Validates model attribute types and flags unrecognized types
- Validates auto-migration strategies in `config/models.js`
- Validates policies and Inertia pages
- Reports problems directly in the Problems panel

### 🛠️ Quick Fixes

- Generate missing actions directly from error diagnostics
- Generate missing models directly from error diagnostics

### 📝 EJS Template Support

- Syntax highlighting for `.ejs` files
- Language configuration for EJS templates

## Requirements

- A Sails.js project with a `.sailsrc` file in the root directory
- Node.js and npm installed
- Sails CLI for generator commands (`npm install -g sails` or use `npx`)

## Extension Activation

This extension activates when it detects a `.sailsrc` file in your workspace, indicating a Sails.js project.

## Sails.js Project Structure

This extension provides enhanced support for the standard Sails.js project structure:

```
your-sails-app/
├── api/
│   ├── controllers/
│   ├── models/
│   ├── policies/
│   ├── helpers/
│   ├── responses/
│   └── adapters/
├── config/
│   ├── routes.js
│   └── models.js
├── views/
└── .sailsrc
```

For more information on the Sails.js project structure, visit the [Sails.js documentation](https://sailsjs.com/documentation/anatomy).

## Troubleshooting

### Go to Definition doesn't work for custom actions

Make sure your actions follow the Sails.js naming conventions and are placed in the correct directories. For example, `api/controllers/user/create.js` for a `user/create` action.

### Completions are not showing up

Ensure you are editing files within a recognized Sails.js project structure and that your models, controllers, and configuration files follow Sails.js conventions.

### Generator commands show "No workspace folder found"

Make sure you have a folder open in VS Code that contains your Sails.js project.

### Validation errors persist after creating a file

The extension automatically refreshes when files are created or deleted. If issues persist, try saving the file you're editing to trigger a refresh.

## Additional Resources

- [Sails.js Documentation](https://sailsjs.com/documentation)
- [Sails.js Guides](https://sailsjs.com/documentation/concepts)
- [Sails.js GitHub Repository](https://github.com/balderdashy/sails)
- [Sails Discord Community](https://sailsjs.com/chat)
- [The Boring JavaScript Stack](https://docs.sailsasts.com/boring-stack)

## Contributing

Found a bug or have a feature request? Please open an issue on [GitHub](https://github.com/sailshq/language-tools/issues).

## License

MIT
