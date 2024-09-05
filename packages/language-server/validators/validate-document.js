const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')

module.exports = function validateDocument(connection, document) {
  const diagnostics = []

  const migrationFiles = ['config/models.js', 'api/models/', 'config/env/']

  if (migrationFiles.some((file) => document.uri.includes(file))) {
    const modelDiagnostics = validateAutomigrationStrategy(document)
    diagnostics.push(...modelDiagnostics)
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
