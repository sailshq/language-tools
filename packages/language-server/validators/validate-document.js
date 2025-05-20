const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')
const validateActionExist = require('./validate-action-exist')
const validatePageExist = require('./validate-page-exist')
const validateDataTypes = require('./validate-data-type')

module.exports = function validateDocument(connection, document, typeMap) {
  const diagnostics = []

  const modelDiagnostics = validateAutomigrationStrategy(document)
  const actionDiagnostics = validateActionExist(document, typeMap)
  const pageDiagnostics = validatePageExist(document, typeMap)
  const dataTypeDiagnostics = validateDataTypes(document, typeMap)

  diagnostics.push(
    ...modelDiagnostics,
    ...actionDiagnostics,
    ...pageDiagnostics,
    ...dataTypeDiagnostics
  )

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
