const lsp = require('vscode-languageserver/node')

module.exports = function modelAttributePropsCompletion(
  document,
  position,
  typeMap
) {
  const filePath = document.uri
  if (!filePath.includes('/api/models/')) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)
  const lines = before.split('\n')
  const lastLine = lines[lines.length - 1]

  // Only trigger on an empty or whitespace-only line
  if (!/^\s*$/.test(lastLine)) return []

  // Confirm we're inside the attributes section
  const insideAttributes = /attributes\s*:\s*{([\s\S]*)$/.exec(before)
  if (!insideAttributes) return []

  // Count nesting depth from attributes: { to current position
  // We want depth > 1 (inside a property) not depth === 1 (top level of attributes)
  let depth = 0
  let foundAttributesBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/attributes\s*:\s*{/.test(line)) {
      foundAttributesBlock = true
      depth = 1
      continue
    }

    if (foundAttributesBlock) {
      for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') depth++
        if (line[j] === '}') depth--
      }
    }
  }

  // Only provide completions if we're nested inside a property (depth > 1)
  // depth === 1 means we're at the top level of attributes: {}
  if (depth <= 1) return []

  return typeMap.modelAttributeProps.map(({ label, detail }) => ({
    label,
    kind: lsp.CompletionItemKind.Field,
    detail,
    documentation: detail,
    insertText: `${label}: `,
    insertTextFormat: lsp.InsertTextFormat.PlainText
  }))
}
