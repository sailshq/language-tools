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

  // Check if the cursor is on a new line
  const prevChar = text[offset - 1]
  if (prevChar === ',') return []

  // Confirm we're inside the attributes section
  const insideAttributes = /attributes\s*:\s*{([\s\S]*)$/.exec(before)
  if (!insideAttributes) return []

  // Use a stack to track braces and find if we're inside a property block
  const lines = before.split('\n')
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
          // Check if this is a property block (not the attributes root)
          const propMatch = lines[i]
            .slice(0, j + 1)
            .match(/([a-zA-Z0-9_]+)\s*:\s*{$/)
          if (propMatch) {
            insideProperty = true
          }
          break
        }
      }
    }
    if (insideProperty) break
    // Stop if we hit the attributes root
    if (/^\s*attributes\s*:\s*{/.test(line)) break
  }
  if (!insideProperty) return []

  // Only block completions if the cursor is after 'type:' (not just anywhere on the line)
  const lastLine = lines[lines.length - 1]
  const typeMatch = /type\s*:\s*['"]?([a-zA-Z0-9_-]*)$/.exec(lastLine)
  if (typeMatch && lastLine.indexOf('type:') < lastLine.length - 1) return []

  // Optional: match current prefix
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
