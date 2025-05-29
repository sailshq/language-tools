const lsp = require('vscode-languageserver/node')

module.exports = function validateRequiredModelAttribute(document, typeMap) {
  const diagnostics = []
  const text = document.getText()
  const models = typeMap.models || {}

  // For each model, check for .create({ ... }) and .createEach({ ... }) calls
  for (const [modelName, modelInfo] of Object.entries(models)) {
    if (!modelInfo || !modelInfo.attributes) continue
    // Only validate required attributes for create and createEach
    const methodRegex = new RegExp(
      `${modelName}\\s*\\.\\s*(create|createEach)\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
      'g'
    )
    let match
    while ((match = methodRegex.exec(text)) !== null) {
      // match[2] is the object literal content
      // Find all property names in the object literal, including shorthand
      const propsRegex = /([a-zA-Z0-9_]+)\s*:/g
      const shorthandRegex = /([a-zA-Z0-9_]+)\s*(,|(?=\n|\}))/g
      let propMatch
      const providedKeys = new Set()
      while ((propMatch = propsRegex.exec(match[2])) !== null) {
        providedKeys.add(propMatch[1])
      }
      while ((propMatch = shorthandRegex.exec(match[2])) !== null) {
        if (!providedKeys.has(propMatch[1])) {
          providedKeys.add(propMatch[1])
        }
      }
      // Check for missing required attributes
      for (const [attr, def] of Object.entries(modelInfo.attributes)) {
        const isRequired =
          def && (def.required === true || def.required === 'true')
        if (isRequired && !providedKeys.has(attr)) {
          // Find the start/end of the object literal for the diagnostic range
          const objStart = match.index + match[0].indexOf('{')
          const objEnd = objStart + match[2].length + 1 // +1 for closing }
          diagnostics.push(
            lsp.Diagnostic.create(
              lsp.Range.create(
                document.positionAt(objStart),
                document.positionAt(objEnd)
              ),
              `Missing required attribute '${attr}' in ${modelName}.${match[1]}().`,
              lsp.DiagnosticSeverity.Error,
              'sails-lsp'
            )
          )
        }
      }
    }
  }
  return diagnostics
}
