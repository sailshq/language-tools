const lsp = require('vscode-languageserver/node')
const loadSails = require('../helpers/load-sails')

module.exports = async function sailsCompletions(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)
  const line = text.substring(0, offset).split('\n').pop()

  const match = line.match(/sails((?:\.[a-zA-Z_$][0-9a-zA-Z_$]*)*)\.$/)
  if (match) {
    try {
      return await loadSails(document.uri, (sailsApp) => {
        const path = match[1].split('.').filter(Boolean)
        return getNestedCompletions(sailsApp, path)
      })
    } catch (error) {
      return []
    }
  }

  return null
}

function getNestedCompletions(obj, path) {
  let current = obj
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return []
    }
  }

  if (typeof current !== 'object' || current === null) {
    return []
  }

  const completions = Object.keys(current).map((key) => {
    const value = current[key]
    let kind = lsp.CompletionItemKind.Property
    let detail = 'Property'

    if (typeof value === 'function') {
      kind = lsp.CompletionItemKind.Method
      detail = 'Method'
    } else if (typeof value === 'object' && value !== null) {
      detail = 'Object'
    }

    return {
      label: key,
      kind: kind,
      detail: detail,
      documentation: `Access to sails${path.length ? '.' + path.join('.') : ''}.${key}`,
      sortText: key.startsWith('_') ? `z${key}` : key // Add this line
    }
  })

  // Sort the completions
  completions.sort((a, b) => a.sortText.localeCompare(b.sortText))

  return completions
}
