const lsp = require('vscode-languageserver/node')

module.exports = function inertiaPagesCompletion(document, position, typeMap) {
  if (!document.uri.includes('/api/controllers/')) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Match { page: '<cursor here>' } (either single or double quotes)
  const match = before.match(/page\s*:\s*['"]([^'"]*)$/)
  if (!match) return []

  const prefix = match[1]

  const completions = Object.entries(typeMap.pages || {})
    .map(([pageKey, pageData]) => {
      if (!pageKey.startsWith(prefix)) return null

      return {
        label: pageKey,
        kind: lsp.CompletionItemKind.Module,
        detail: 'Inertia Page',
        documentation: pageData.path,
        sortText: pageKey,
        filterText: pageKey,
        insertText: pageKey
      }
    })
    .filter(Boolean)

  return completions
}
