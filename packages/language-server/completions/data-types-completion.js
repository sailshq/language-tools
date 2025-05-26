const lsp = require('vscode-languageserver/node')

module.exports = function dataTypesCompletion(document, position, typeMap) {
  const filePath = document.uri

  const isTargetFile =
    filePath.includes('/api/models/') ||
    filePath.includes('/api/helpers/') ||
    filePath.includes('/api/controllers/') ||
    filePath.includes('/scripts/')

  if (!isTargetFile) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  const match = before.match(/type\s*:\s*['"]([a-z]*)$/i)
  if (!match) return []

  const prefix = match[1]

  const contextText = before.toLowerCase()
  const inAttributes = /attributes\s*:\s*{[^}]*$/.test(contextText)
  const inInputs = /inputs\s*:\s*{[^}]*$/.test(contextText)

  if (!(inAttributes || inInputs)) return []

  return typeMap.dataTypes
    .filter(({ type }) => type.startsWith(prefix))
    .map(({ type, description }) => ({
      label: type,
      kind: lsp.CompletionItemKind.TypeParameter,
      detail: 'Validation type',
      documentation: description,
      insertText: type
    }))
}
