const lsp = require('vscode-languageserver/node')

module.exports = function actionsCompletion(document, position, typeMap) {
  if (!document.uri.endsWith('routes.js')) return [] // Return an empty array instead of null

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Match both "action: 'user/login'" and "'GET /foo': 'user/login'"
  const match = before.match(
    /(?:action\s*:\s*|['"][^'"]+['"]\s*:\s*)['"]([^'"]*)$/
  )
  if (!match) return [] // Return an empty array instead of null

  const prefix = match[1]

  const completions = Object.values(typeMap.routes || {})
    .map((route) => {
      const actionName = route.action?.name
      if (!actionName || !actionName.startsWith(prefix)) return null

      return {
        label: actionName,
        kind: lsp.CompletionItemKind.Function,
        detail: 'Controller Action',
        documentation: `Defined in ${route.src?.replace(/^.*\/api\/controllers\//, '') || 'unknown file'}`,
        sortText: actionName,
        filterText: actionName,
        insertText: actionName
      }
    })
    .filter(Boolean)

  return completions
}
