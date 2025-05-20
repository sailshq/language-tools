const lsp = require('vscode-languageserver/node')

module.exports = function validateDataType(document, typeMap) {
  const diagnostics = []

  const text = document.getText()

  // Regex to match lines like: type: 'string' or type: "number"
  const regex = /type\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/g

  let match
  while ((match = regex.exec(text)) !== null) {
    const dataType = match[1]
    const typeStart = match.index + match[0].indexOf(dataType)
    const typeEnd = typeStart + dataType.length

    const isValid = typeMap.dataTypes.some((dt) => dt.type === dataType)

    if (!isValid) {
      diagnostics.push(
        lsp.Diagnostic.create(
          lsp.Range.create(
            document.positionAt(typeStart),
            document.positionAt(typeEnd)
          ),
          `'${dataType}' is not a recognized data type. Valid data types are: ${typeMap.dataTypes.map((dataType) => dataType.type).join(', ')}.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }
  return diagnostics
}
