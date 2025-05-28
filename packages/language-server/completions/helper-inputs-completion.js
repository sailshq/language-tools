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
    let type = inputDef?.type || ''
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
  const pathParts = getHelperPath(line)
  if (!pathParts) return []

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

  return getInputCompletionItems(helper.inputs)
}
