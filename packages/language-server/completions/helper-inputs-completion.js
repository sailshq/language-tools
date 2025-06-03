const lsp = require('vscode-languageserver/node')

// Find the helper path context from the line, e.g. sails.helpers.email.sendEmail.with({
function getHelperPath(line) {
  const match = line.match(
    /sails\.helpers((?:\.[a-zA-Z0-9_]+)+)\.with\s*\(\s*\{[^}]*$/
  )
  if (!match) return null
  // e.g. '.email.sendEmail' => ['email', 'sendEmail']
  return match[1].split('.').filter(Boolean)
}

function getInputCompletionItems(inputsObj) {
  if (!inputsObj || typeof inputsObj !== 'object') return []
  return Object.entries(inputsObj).map(([inputName, inputDef]) => {
    let type = inputDef?.type
    let required = inputDef?.required ? 'required' : 'optional'
    let description = inputDef?.description || ''
    let detail = type ? `${type} (${required})` : required
    return {
      label: inputName,
      kind: lsp.CompletionItemKind.Field,
      detail: detail,
      documentation: description,
      insertText: `${inputName}: `
    }
  })
}

module.exports = function helperInputsCompletion(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)
  const lines = before.split('\n')
  const line = lines[lines.length - 1]

  // Only trigger if not after a colon (:) on this line
  // e.g. don't trigger if "foo: '" or "foo: \"" or "foo: 1"
  // But DO trigger after a comma (,) or at the start of a new property
  // Find the text before the cursor on this line
  const beforeCursor = line.slice(0, position.character)
  // If the last non-whitespace character before the cursor is a colon, do not complete
  // (but allow after comma, or at start of line/object)
  const lastColon = beforeCursor.lastIndexOf(':')
  const lastComma = beforeCursor.lastIndexOf(',')
  // If the last colon is after the last comma, and after any opening brace, suppress completion
  if (lastColon > lastComma && lastColon > beforeCursor.lastIndexOf('{'))
    return []

  const pathParts = getHelperPath(line)
  if (!pathParts) return []

  // Find already-used property names in the current object literal
  // We'll look for all foo: ... pairs before the cursor in the current .with({ ... })
  const objectStart = before.lastIndexOf('{')
  const objectEnd = before.lastIndexOf('}')
  let usedProps = new Set()
  if (objectStart !== -1 && (objectEnd === -1 || objectStart > objectEnd)) {
    // Get the text inside the current object literal up to the cursor
    const objectText = before.slice(objectStart, offset)
    // Match all property names before the cursor
    const propRegex = /([a-zA-Z0-9_]+)\s*:/g
    let m
    while ((m = propRegex.exec(objectText)) !== null) {
      usedProps.add(m[1])
    }
  }

  // Convert camelCase to kebab-case for the last part
  function camelToKebab(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  }
  // Try to find the helper in typeMap.helpers
  let helperKey = pathParts.join('/')
  let helper = typeMap.helpers[helperKey]
  if (!helper) {
    // Try kebab-case for last part
    const last = pathParts[pathParts.length - 1]
    pathParts[pathParts.length - 1] = camelToKebab(last)
    helperKey = pathParts.join('/')
    helper = typeMap.helpers[helperKey]
  }
  if (!helper || !helper.inputs || typeof helper.inputs !== 'object') return []

  // Filter out already-used properties
  const availableInputs = Object.fromEntries(
    Object.entries(helper.inputs).filter(([key]) => !usedProps.has(key))
  )

  return getInputCompletionItems(availableInputs)
}
