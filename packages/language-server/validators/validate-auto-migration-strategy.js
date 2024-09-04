const lsp = require('vscode-languageserver')

module.exports = function validateAutomigrationStrategy(document) {
  const text = document.getText()
  const diagnostics = []

  const migrateRegex = /^\s*migrate:\s*['"](\w+)['"]\s*,?\s*$/m

  const match = text.match(migrateRegex)
  const validAutomigrationStrategies = ['safe', 'alter', 'drop']

  if (match) {
    const automigrationStrategy = match[1]
    if (!validAutomigrationStrategies.includes(automigrationStrategy)) {
      const startIndex = match.index + match[0].indexOf(automigrationStrategy)
      const endIndex = startIndex + automigrationStrategy.length

      const startPosition = document.positionAt(startIndex)
      const endPosition = document.positionAt(endIndex)
      const diagnostic = {
        severity: lsp.DiagnosticSeverity.Error,
        range: {
          start: startPosition,
          end: endPosition
        },
        message: `Invalid auto-migration strategy: '${automigrationStrategy}'. Supported strategies are: ${validAutomigrationStrategies.join(', ')}.`,
        source: 'Sails Validator'
      }
      diagnostics.push(diagnostic)
    }
  }

  return diagnostics
}
