const lsp = require('vscode-languageserver')

module.exports = function validateMigrationStrategy(document) {
  const text = document.getText()
  const diagnostics = []

  const migrateRegex = /migrate\s*:\s*['"]?(.*?)['"]?\s*,?/
  const match = text.match(migrateRegex)
  const validMigrations = ['safe', 'alter', 'drop']

  if (match) {
    const migrateValue = match[1]
    if (!validMigrations.includes(migrateValue)) {
      const diagnostic = {
        severity: lsp.DiagnosticSeverity.Error,
        range: {
          start: {
            line: text.substr(0, match.index).split('\n').length - 1,
            character: match.index
          },
          end: {
            line: text.substr(0, match.index).split('\n').length - 1,
            character: match.index + match[0].length
          }
        },
        message: `Invalid migration value: '${migrateValue}'. Allowed values are: ${validMigrations.join(', ')}.`,
        source: 'Sails Validator'
      }
      diagnostics.push(diagnostic)
    }
  }

  return diagnostics
}
