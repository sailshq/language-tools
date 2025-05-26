const lsp = require('vscode-languageserver/node')

module.exports = function modelAttributePropsCompletion(
  document,
  position,
  typeMap
) {
  const filePath = document.uri

  const isTargetFile = filePath.includes('/api/models/')
  if (!isTargetFile) return []
  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Confirm we're inside the attributes section
  const insideAttributes = /attributes\s*:\s*{[\s\S]*$/.test(before)
  if (!insideAttributes) return []

  // Try to match "someProperty: {" above the current line
  const lines = before.split('\n')
  const reversed = lines.slice().reverse()
  let insidePropertyBlock = false

  for (const line of reversed) {
    const trimmed = line.trim()
    if (/^[a-zA-Z0-9_]+\s*:\s*{\s*$/.test(trimmed)) {
      insidePropertyBlock = true
      break
    }
    if (/^\}/.test(trimmed)) {
      break // exited a block without entering a new one
    }
  }

  if (!insidePropertyBlock) return []

  // Optional: match current prefix
  const lastLine = lines[lines.length - 1]
  const prefixMatch = lastLine.match(/([a-zA-Z0-9_]*)$/)
  const prefix = prefixMatch ? prefixMatch[1] : ''

  return typeMap.modelAttributeProps
    .filter(({ label }) => label.startsWith(prefix))
    .map(({ label, detail }) => ({
      label,
      kind: lsp.CompletionItemKind.Field,
      detail,
      documentation: detail,
      insertText: `${label}: `,
      insertTextFormat: lsp.InsertTextFormat.PlainText
    }))
}
