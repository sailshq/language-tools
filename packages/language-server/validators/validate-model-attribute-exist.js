const lsp = require('vscode-languageserver/node')

/**
 * Validate if a Waterline model attribute exists when used in criteria or chainable methods.
 * @param {TextDocument} document - The text document to validate.
 * @param {Object} typeMap - The type map containing models and their attributes.
 * @returns {Array} diagnostics - Array of LSP diagnostics.
 */
module.exports = function validateModelAttributeExist(document, typeMap) {
  const diagnostics = []
  const text = document.getText()

  // Criteria methods: Model.find({ attribute: ... }) etc.
  const criteriaRegex =
    /([A-Za-z0-9_]+)\s*\.\s*(find|findOne|update|destroy|where)\s*\(\s*\{\s*([A-Za-z0-9_]+)\s*:/g

  // Chainable: .select(['attr1', 'attr2']) or .omit(['attr1', ...])
  const arrayChainRegex = /\.(select|omit)\s*\(\s*\[([^\]]*)\]/g

  // Chainable: .populate('attr')
  const populateRegex = /\.populate\s*\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g

  let match

  // Criteria methods
  while ((match = criteriaRegex.exec(text)) !== null) {
    const modelName = match[1]
    const attribute = match[3]
    const attrStart = match.index + match[0].lastIndexOf(attribute)
    const attrEnd = attrStart + attribute.length

    const model = typeMap.models && typeMap.models[modelName]
    if (!model) continue

    if (
      !model.attributes ||
      !Object.prototype.hasOwnProperty.call(model.attributes, attribute)
    ) {
      diagnostics.push(
        lsp.Diagnostic.create(
          lsp.Range.create(
            document.positionAt(attrStart),
            document.positionAt(attrEnd)
          ),
          `'${attribute}' is not a valid attribute of model '${modelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }

  // .select(['attr1', ...]) and .omit(['attr1', ...])
  while ((match = arrayChainRegex.exec(text)) !== null) {
    const method = match[1]
    const attrsString = match[2]
    // Try to find the model name by searching backwards for ModelName.
    // This is a heuristic and may not be perfect.
    const before = text.slice(0, match.index)
    const modelMatch = /([A-Za-z0-9_]+)\s*\.\s*$/.exec(
      before.split('\n').pop() || ''
    )
    const modelName = modelMatch && modelMatch[1]
    if (!modelName) continue
    const model = typeMap.models && typeMap.models[modelName]
    if (!model) continue

    // Extract attribute names from the array string
    const attrRegex = /['"]([A-Za-z0-9_]+)['"]/g
    let attrMatch
    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
      const attribute = attrMatch[1]
      const attrStart = match.index + match[0].indexOf(attribute)
      const attrEnd = attrStart + attribute.length
      if (
        !model.attributes ||
        !Object.prototype.hasOwnProperty.call(model.attributes, attribute)
      ) {
        diagnostics.push(
          lsp.Diagnostic.create(
            lsp.Range.create(
              document.positionAt(attrStart),
              document.positionAt(attrEnd)
            ),
            `'${attribute}' is not a valid attribute of model '${modelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
            lsp.DiagnosticSeverity.Error,
            'sails-lsp'
          )
        )
      }
    }
  }

  // .populate('attr')
  while ((match = populateRegex.exec(text)) !== null) {
    const attribute = match[1]
    // Try to find the model name by searching backwards for ModelName.
    const before = text.slice(0, match.index)
    const modelMatch = /([A-Za-z0-9_]+)\s*\.\s*$/.exec(
      before.split('\n').pop() || ''
    )
    const modelName = modelMatch && modelMatch[1]
    if (!modelName) continue
    const model = typeMap.models && typeMap.models[modelName]
    if (!model) continue

    const attrStart = match.index + match[0].indexOf(attribute)
    const attrEnd = attrStart + attribute.length
    if (
      !model.attributes ||
      !Object.prototype.hasOwnProperty.call(model.attributes, attribute)
    ) {
      diagnostics.push(
        lsp.Diagnostic.create(
          lsp.Range.create(
            document.positionAt(attrStart),
            document.positionAt(attrEnd)
          ),
          `'${attribute}' is not a valid attribute of model '${modelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }

  return diagnostics
}
