const lsp = require('vscode-languageserver/node')

module.exports = function validateRequiredHelperInput(document, typeMap) {
  const diagnostics = []
  const text = document.getText()

  // Regex to match sails.helpers.foo.bar.with({ ... })
  // Captures: 1) helper path, 2) object literal content
  const regex = /sails\.helpers((?:\.[a-zA-Z0-9_]+)+)\.with\s*\(\s*\{([^}]*)\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    // Build helper name: e.g. .foo.bar => foo/bar
    const segments = match[1].split('.').filter(Boolean)
    const toKebab = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    const fullHelperName = segments.map(toKebab).join('/')
    const helperInfo = typeMap.helpers && typeMap.helpers[fullHelperName]
    if (!helperInfo || !helperInfo.inputs) continue

    // Find all property names in the object literal
    const propsRegex = /([a-zA-Z0-9_]+)\s*:/g
    let propMatch
    const providedKeys = new Set()
    while ((propMatch = propsRegex.exec(match[2])) !== null) {
      providedKeys.add(propMatch[1])
    }
    // Check for missing required inputs (support boolean or string 'required')
    for (const [inputKey, inputDef] of Object.entries(helperInfo.inputs)) {
      const isRequired =
        inputDef && (inputDef.required === true || inputDef.required === 'true')
      if (isRequired && !providedKeys.has(inputKey)) {
        // Find the start/end of the object literal for the diagnostic range
        const objStart = match.index + match[0].indexOf('{')
        const objEnd = objStart + match[2].length + 1 // +1 for closing }
        diagnostics.push(
          lsp.Diagnostic.create(
            lsp.Range.create(
              document.positionAt(objStart),
              document.positionAt(objEnd)
            ),
            `Missing required input '${inputKey}' for helper '${fullHelperName}'.`,
            lsp.DiagnosticSeverity.Error,
            'sails-lsp'
          )
        )
      }
    }
  }
  return diagnostics
}
