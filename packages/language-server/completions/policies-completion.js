const lsp = require('vscode-languageserver/node')

module.exports = function policiesCompletion(
  document,
  position,
  cachedTypeMap
) {
  if (!document.uri.endsWith('policies.js')) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Match inside string value or array of strings:
  // 'isLog|' or ['isLog|'] or '*': 'isLog|'
  const match = before.match(/:\s*(?:\[)?\s*['"]([^'"]*)$/)
  if (!match) return []

  const prefix = match[1]

  return Object.entries(cachedTypeMap.policies || {})
    .map(([policyName, policy]) => {
      if (!policyName.startsWith(prefix)) return null

      return {
        label: policyName,
        kind: lsp.CompletionItemKind.Function,
        detail: 'Policy',
        documentation: policy.path,
        sortText: policyName,
        filterText: policyName,
        insertText: policyName
      }
    })
    .filter(Boolean)
}
