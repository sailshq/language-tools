const lsp = require('vscode-languageserver/node')

module.exports = function viewsCompletion(document, position, typeMap) {
  const uri = document.uri
  if (!uri.endsWith('routes.js') && !uri.includes('/api/controllers/'))
    return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Match { view: '...' } or viewTemplatePath: '...'
  const match = before.match(/\b(view|viewTemplatePath)\s*:\s*['"]([^'"]*)$/)
  if (!match) return []

  const prefix = match[2]

  const completions = Object.entries(typeMap.views || {})
    .map(([viewKey, viewData]) => {
      if (!viewKey.startsWith(prefix)) return null

      return {
        label: viewKey,
        kind: lsp.CompletionItemKind.File,
        detail: 'View',
        documentation: viewData.path,
        sortText: viewKey,
        filterText: viewKey,
        insertText: viewKey
      }
    })
    .filter(Boolean)

  return completions
}
