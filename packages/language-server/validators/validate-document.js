const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')
const validateActionExist = require('./validate-action-exist')
const validatePageExist = require('./validate-page-exist')

module.exports = function validateDocument(connection, document, typeMap) {
  const diagnostics = []

  const modelDiagnostics = validateAutomigrationStrategy(document)
  const actionDiagnostics = validateActionExist(document, typeMap)
  const pageDiagnostics = validatePageExist(document, typeMap)

  diagnostics.push(
    ...modelDiagnostics,
    ...actionDiagnostics,
    ...pageDiagnostics
  )

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
