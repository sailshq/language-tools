const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

/**
 * Validate if a Waterline model attribute exists when used in criteria or chainable methods.
 * @param {TextDocument} document - The text document to validate.
 * @param {Object} typeMap - The type map containing models and their attributes.
 * @returns {Array} diagnostics - Array of LSP diagnostics.
 */
module.exports = function validateModelAttributeExist(document, typeMap) {
  const diagnostics = []
  const text = document.getText()

  // Build a lowercased model map for robust case-insensitive lookup
  const modelMap = {}
  if (typeMap.models) {
    for (const key of Object.keys(typeMap.models)) {
      modelMap[key.toLowerCase()] = typeMap.models[key]
    }
  }
  // Helper function to get model by name, case-insensitive
  function getModelByName(name) {
    if (!name) return undefined
    const upper = name.charAt(0).toUpperCase() + name.slice(1)
    return typeMap.models[upper]
  }

  // AST-based: Validate Model.create({ ... }) and similar
  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })
    walk.simple(ast, {
      CallExpression(node) {
        if (
          node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.arguments &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'ObjectExpression'
        ) {
          const method = node.callee.property.name
          const modelName = node.callee.object.name
          // Only check for Waterline methods
          if (
            [
              'create',
              'createEach',
              'count',
              'find',
              'findOne',
              'update',
              'destroy',
              'where',
              'findOrCreate',
              'sum'
            ].includes(method)
          ) {
            const model = getModelByName(modelName)
            if (!model) return
            for (const prop of node.arguments[0].properties) {
              // Support both shorthand and normal properties
              const attribute = prop.key && (prop.key.name || prop.key.value)
              if (
                !model.attributes ||
                !Object.prototype.hasOwnProperty.call(
                  model.attributes,
                  attribute
                )
              ) {
                diagnostics.push(
                  lsp.Diagnostic.create(
                    lsp.Range.create(
                      document.positionAt(prop.key.start),
                      document.positionAt(prop.key.end)
                    ),
                    `'${attribute}' is not a valid attribute of model '${modelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                    lsp.DiagnosticSeverity.Error,
                    'sails-lsp'
                  )
                )
              }
            }
          }
        }
      }
    })
  } catch (err) {
    // Fallback to regex if AST parse fails
  }

  // Criteria methods (regex fallback, only for legacy or parse errors)
  const criteriaRegex =
    /([A-Za-z0-9_]+)\s*\.\s*(create|createEach|count|find|findOne|update|destroy|where|findOrCreate|sum)\s*\(\s*\{\s*([A-Za-z0-9_]+)\s*:/g

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

    const model = getModelByName(modelName)
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
    const model = getModelByName(modelName)
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
    const model = getModelByName(modelName)
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
