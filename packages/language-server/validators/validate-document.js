const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')
const validateActionExist = require('./validate-action-exist')

module.exports = function validateDocument(connection, document) {
  const diagnostics = []

  const modelDiagnostics = validateAutomigrationStrategy(document)
  const actionDiagnostics = validateActionExist(document)

  diagnostics.push(...modelDiagnostics, ...actionDiagnostics)

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
