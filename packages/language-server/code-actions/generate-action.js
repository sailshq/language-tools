const lsp = require('vscode-languageserver/node')

// Only allow alphanumeric, hyphens, underscores, and forward slashes
const SAFE_ACTION_NAME = /^[a-zA-Z0-9/_-]+$/

module.exports = {
  diagnosticCode: 'action-not-found',
  command: 'sails.generateAction',

  createCodeAction(diagnostic) {
    const actionName = diagnostic.data?.actionName
    if (!actionName || !SAFE_ACTION_NAME.test(actionName)) return null

    return {
      title: `Generate action '${actionName}'`,
      kind: lsp.CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      isPreferred: true,
      command: {
        title: `Generate action '${actionName}'`,
        command: this.command,
        arguments: [actionName]
      }
    }
  },

  async executeCommand(args, { rootDir, execAsync, connection }) {
    const actionName = args[0]
    if (!actionName || !SAFE_ACTION_NAME.test(actionName)) return

    if (!rootDir) {
      connection.window.showErrorMessage(
        'Cannot generate action: workspace root not found.'
      )
      return
    }

    try {
      connection.window.showInformationMessage(
        `Generating action '${actionName}'...`
      )
      await execAsync(`npx sails generate action ${actionName}`, {
        cwd: rootDir
      })
      connection.window.showInformationMessage(
        `Action '${actionName}' generated successfully.`
      )
    } catch (error) {
      connection.window.showErrorMessage(
        `Failed to generate action: ${error.message}`
      )
    }
  }
}
