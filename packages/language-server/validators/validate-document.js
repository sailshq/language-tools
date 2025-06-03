const validateAutomigrationStrategy = require('./validate-auto-migration-strategy')
const validateActionExist = require('./validate-action-exist')
const validatePageExist = require('./validate-page-exist')
const validateDataTypes = require('./validate-data-type')
const validatePolicyExist = require('./validate-policy-exist')
const validateModelAttributeExist = require('./validate-model-attribute-exist')
const validateViewExist = require('./validate-view-exist')
const validateHelperInputExist = require('./validate-helper-input-exist')
const validateRequiredHelperInput = require('./validate-required-helper-input')
const validateRequiredModelAttribute = require('./validate-required-model-attribute')
const validateModelExist = require('./validate-model-exist')

module.exports = function validateDocument(connection, document, typeMap) {
  const diagnostics = []

  const modelDiagnostics = validateAutomigrationStrategy(document)
  const actionDiagnostics = validateActionExist(document, typeMap)
  const pageDiagnostics = validatePageExist(document, typeMap)
  const dataTypeDiagnostics = validateDataTypes(document, typeMap)
  const policyDiagnostics = validatePolicyExist(document, typeMap)
  const modelAttributeDiagnostics = validateModelAttributeExist(
    document,
    typeMap
  )
  const viewDiagnostics = validateViewExist(document, typeMap)
  const helperInputDiagnostics = validateHelperInputExist(document, typeMap)
  const requiredHelperInputDiagnostics = validateRequiredHelperInput(
    document,
    typeMap
  )
  const requiredModelAttributeDiagnostics = validateRequiredModelAttribute(
    document,
    typeMap
  )
  const modelExistDiagnostics = validateModelExist(document, typeMap)
  diagnostics.push(
    ...modelDiagnostics,
    ...actionDiagnostics,
    ...pageDiagnostics,
    ...dataTypeDiagnostics,
    ...policyDiagnostics,
    ...modelAttributeDiagnostics,
    ...viewDiagnostics,
    ...helperInputDiagnostics,
    ...requiredHelperInputDiagnostics,
    ...requiredModelAttributeDiagnostics,
    ...modelExistDiagnostics
  )

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}
