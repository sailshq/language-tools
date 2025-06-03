const lsp = require('vscode-languageserver/node')

module.exports = function inputPropsCompletion(document, position, typeMap) {
  const filePath = document.uri

  const isTargetFile =
    filePath.includes('/api/helpers/') ||
    filePath.includes('/api/controllers/') ||
    filePath.includes('/scripts/')
  if (!isTargetFile) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  const lines = before.split('\n')
  const lastLine = lines[lines.length - 1]

  // Only trigger if we're on a new line with optional whitespace (no code)
  if (!/^\s*$/.test(lastLine)) return []

  // Check we're inside the inputs: { ... } section
  const insideInputs = /inputs\s*:\s*{[\s\S]*$/.test(before)
  if (!insideInputs) return []

  // Walk backward to see if we're inside an input block
  const reversed = lines.slice().reverse()
  let insideInputBlock = false

  for (const line of reversed) {
    const trimmed = line.trim()
    if (/^[a-zA-Z0-9_]+\s*:\s*{\s*$/.test(trimmed)) {
      insideInputBlock = true
      break
    }
    if (/^\}/.test(trimmed)) break
  }

  if (!insideInputBlock) return []

  return typeMap.inputProps.map(({ label, detail }) => ({
    label,
    kind:
      label === 'custom'
        ? lsp.CompletionItemKind.Method
        : lsp.CompletionItemKind.Field,
    detail,
    documentation: detail,
    insertText: `${label}: `,
    insertTextFormat: lsp.InsertTextFormat.PlainText
  }))
}
