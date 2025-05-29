const lsp = require('vscode-languageserver/node')

module.exports = function validateHelperInputExist(document, typeMap) {
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
    while ((propMatch = propsRegex.exec(match[2])) !== null) {
      const key = propMatch[1]
      if (!Object.prototype.hasOwnProperty.call(helperInfo.inputs, key)) {
        const start = match.index + match[0].indexOf(key)
        const end = start + key.length
        diagnostics.push(
          lsp.Diagnostic.create(
            lsp.Range.create(
              document.positionAt(start),
              document.positionAt(end)
            ),
            `Unknown input property '${key}' for helper '${fullHelperName}'.`,
            lsp.DiagnosticSeverity.Error,
            'sails-lsp'
          )
        )
      }
    }
  }
  return diagnostics
}
