const lsp = require('vscode-languageserver/node')

module.exports = function modelsCompletion(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // sails.models.<model>
  const dotMatch = before.match(/sails\.models\.([a-zA-Z0-9_]*)$/)
  if (dotMatch) {
    const prefix = dotMatch[1] || ''

    return Object.entries(typeMap.models || {})
      .map(([modelName, model]) => {
        const key = modelName.toLowerCase()
        if (!key.startsWith(prefix.toLowerCase())) return null

        return {
          label: key,
          kind: lsp.CompletionItemKind.Class,
          detail: 'Sails Model (sails.models)',
          documentation: model.src?.replace(/^.*\/api\/models\//, ''),
          insertText: key
        }
      })
      .filter(Boolean)
  }

  // await User.<method>
  // Only match if there's an uppercase prefix and it follows "await"
  const awaitMatch = before.match(/(?:await\s+)([A-Z][a-zA-Z0-9_]*)$/)
  if (awaitMatch) {
    const prefix = awaitMatch[1]
    if (!prefix) return [] // Don't show anything if prefix is empty

    return Object.entries(typeMap.models || {})
      .map(([modelName, model]) => {
        if (!modelName.startsWith(prefix)) return null

        return {
          label: modelName,
          kind: lsp.CompletionItemKind.Class,
          detail: 'Sails Model',
          documentation: model.path?.replace(/^.*\/api\/models\//, ''),
          insertText: modelName
        }
      })
      .filter(Boolean)
  }

  return []
}
