const { CompletionItemKind } = require('vscode-languageserver/node')

// Convert kebab-case to camelCase (e.g., 'send-email' -> 'sendEmail')
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

// Get the helper path context from the line, e.g. sails.helpers.email.
function getHelpersContext(line) {
  const match = line.match(/sails\.helpers((?:\.[a-zA-Z0-9_]+)*)\.$/)
  if (!match) return []
  // e.g. '.email.foo.' => ['email', 'foo']
  return match[1] ? match[1].split('.').filter(Boolean) : []
}

module.exports = function helpersCompletion(document, position, typeMap) {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: position
  })
  // Prevent helpers completion inside .with({ ... })
  if (/\.with\s*\(\s*\{[^}]*$/.test(line)) {
    return []
  }
  // Prevent helpers completion inside sails.helpers.foo({ ... })
  if (/sails\.helpers(?:\.[a-zA-Z0-9_]+)+\s*\(\s*\{[^}]*$/.test(line)) {
    return []
  }
  const helpers = typeMap.helpers || {}
  const context = getHelpersContext(line.trim())
  if (!line.trim().includes('sails.helpers.')) return []

  // Build a tree of helpers from the flat keys
  const tree = {}
  for (const key of Object.keys(helpers)) {
    const parts = key.split('/')
    let node = tree
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!node[part])
        node[part] =
          i === parts.length - 1 ? { __isHelper: true, __key: key } : {}
      node = node[part]
    }
  }

  // Traverse the tree according to the context
  let node = tree
  for (const part of context) {
    if (!node[part]) return []
    node = node[part]
  }

  // If at a namespace, suggest children (namespaces or helpers)
  return Object.entries(node)
    .filter(([k]) => !k.startsWith('__'))
    .map(([k, v]) => {
      if (v.__isHelper) {
        const helperInfo = helpers[v.__key] || {}
        // Updated: check if inputs is a non-empty object
        const hasInputs =
          helperInfo.inputs &&
          typeof helperInfo.inputs === 'object' &&
          Object.keys(helperInfo.inputs).length > 0
        return {
          label: kebabToCamel(k),
          kind: CompletionItemKind.Method,
          detail: helperInfo.description || 'Helper function',
          documentation: helperInfo.path || '',
          insertText: hasInputs
            ? `${kebabToCamel(k)}.with({$0})`
            : `${kebabToCamel(k)}()`,
          insertTextFormat: 2 // Snippet
        }
      } else {
        // Namespace/folder
        return {
          label: k,
          kind: CompletionItemKind.Module,
          detail: 'Helper namespace',
          insertText: k + '.'
        }
      }
    })
}
