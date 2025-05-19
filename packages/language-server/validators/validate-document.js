const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')
const validateActionExist = require('./validate-action-exist')

module.exports = function validateDocument(connection, document, typeMap) {
  const diagnostics = []

  const modelDiagnostics = validateAutomigrationStrategy(document)
  const actionDiagnostics = validateActionExist(document, typeMap)

  diagnostics.push(...modelDiagnostics, ...actionDiagnostics)

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
