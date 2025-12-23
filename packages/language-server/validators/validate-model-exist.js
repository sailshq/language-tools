const lsp = require('vscode-languageserver/node')
/**
 * Validate if a referenced model exists in Sails.js queries using regex.
 * @param {TextDocument} document - The text document to validate.
 * @param {Object} typeMap - The type map containing models.
 * @returns {Array} diagnostics - Array of LSP diagnostics.
 */
module.exports = function validateModelExist(document, typeMap) {
  const diagnostics = []
  const text = document.getText()
  // Build a lowercased model map for robust case-insensitive lookup
  const modelMap = {}
  if (typeMap.models) {
    for (const key of Object.keys(typeMap.models)) {
      modelMap[key.toLowerCase()] = typeMap.models[key]
    }
  }
  function modelExists(name) {
    if (!name) return false
    return !!modelMap[name.toLowerCase()]
  }

  const knownGlobals = [
    '_',
    'sails',
    'require',
    'module',
    'exports',
    'console',
    'process'
  ]

  // User.find() or User.create() etc
  const modelCallRegex =
    /\b([A-Za-z0-9_]+)\s*\.(?:find|findOne|create|createEach|update|destroy|count|sum|where|findOrCreate)\s*\(/g
  let match
  while ((match = modelCallRegex.exec(text)) !== null) {
    const modelName = match[1]
    if (knownGlobals.includes(modelName)) {
      continue
    }
    if (!modelExists(modelName)) {
      diagnostics.push(
        lsp.Diagnostic.create(
          lsp.Range.create(
            document.positionAt(match.index),
            document.positionAt(match.index + modelName.length)
          ),
          `Model '${modelName}' not found. Make sure it exists under your api/models directory.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }
  // sails.models.user.find() or sails.models.User.find()
  const sailsModelCallRegex =
    /sails\.models\.([A-Za-z0-9_]+)\s*\.(?:find|findOne|create|createEach|update|destroy|count|sum|where|findOrCreate)\s*\(/g
  while ((match = sailsModelCallRegex.exec(text)) !== null) {
    const modelName = match[1]
    if (!modelExists(modelName)) {
      diagnostics.push(
        lsp.Diagnostic.create(
          lsp.Range.create(
            document.positionAt(match.index + 'sails.models.'.length),
            document.positionAt(
              match.index + 'sails.models.'.length + modelName.length
            )
          ),
          `Model '${modelName}' does not exist in this Sails project.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }
  return diagnostics
}
