const lsp = require('vscode-languageserver/node')

const COMMAND_TIMEOUT = 30000

module.exports = function createGenerator({
  type,
  diagnosticCode,
  dataKey,
  validationRegex
}) {
  function isValid(name) {
    return name && validationRegex.test(name)
  }

  return {
    diagnosticCode,
    command: `sails.generate${type.charAt(0).toUpperCase() + type.slice(1)}`,

    createCodeAction(diagnostic) {
      const name = diagnostic.data?.[dataKey]
      if (!isValid(name)) return null

      return {
        title: `Generate ${type} '${name}'`,
        kind: lsp.CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        isPreferred: true,
        command: {
          title: `Generate ${type} '${name}'`,
          command: this.command,
          arguments: [name]
        }
      }
    },

    async executeCommand(args, { rootDir, execAsync, connection }) {
      const name = args[0]
      if (!isValid(name)) return

      if (!rootDir) {
        connection.window.showErrorMessage(
          `Cannot generate ${type}: workspace root not found.`
        )
        return
      }

      try {
        connection.window.showInformationMessage(
          `Generating ${type} '${name}'...`
        )
        await execAsync(`npx sails generate ${type} ${name}`, {
          cwd: rootDir,
          timeout: COMMAND_TIMEOUT
        })
        connection.window.showInformationMessage(
          `${type.charAt(0).toUpperCase() + type.slice(1)} '${name}' generated successfully.`
        )
      } catch (error) {
        connection.window.showErrorMessage(
          `Failed to generate ${type}: ${error.message}`
        )
      }
    }
  }
}
