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

  // Check if the cursor is on a new line
  const prevChar = text[offset - 1]

  if (prevChar === ',') return []
  // Check we're inside the inputs: { ... } section
  const insideInputs = /inputs\s*:\s*{[\s\S]*$/.test(before)
  if (!insideInputs) return []

  // Walk backward to see if we're inside an input property definition
  const lines = before.split('\n')
  const reversed = lines.slice().reverse()
  let insideInputBlock = false

  for (const line of reversed) {
    const trimmed = line.trim()
    if (/^[a-zA-Z0-9_]+\s*:\s*{\s*$/.test(trimmed)) {
      insideInputBlock = true
      break
    }
    if (/^\}/.test(trimmed)) {
      break // exited a block
    }
  }

  if (!insideInputBlock) return []

  // Extract current typing prefix
  const lastLine = lines[lines.length - 1]
  const prefixMatch = lastLine.match(/([a-zA-Z0-9_]*)$/)
  const prefix = prefixMatch ? prefixMatch[1] : ''

  return typeMap.inputProps
    .filter(({ label }) => label.startsWith(prefix))
    .map(({ label, detail }) => ({
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
