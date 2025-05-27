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

  // Use a stack to track braces and find if we're inside a property block
  let braceStack = []
  let insideProperty = false
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') braceStack.push('}')
      if (line[j] === '{') {
        if (braceStack.length > 0) {
          braceStack.pop()
        } else {
          const propMatch = lines[i]
            .slice(0, j + 1)
            .match(/([a-zA-Z0-9_]+)\s*:\s*{$/)
          if (propMatch) insideProperty = true
          break
        }
      }
    }
    if (insideProperty) break
    if (/^\s*attributes\s*:\s*{/.test(line)) break
  }

  if (!insideProperty) return []

  return typeMap.modelAttributeProps.map(({ label, detail }) => ({
    label,
    kind: lsp.CompletionItemKind.Field,
    detail,
    documentation: detail,
    insertText: `${label}: `,
    insertTextFormat: lsp.InsertTextFormat.PlainText
  }))
}
