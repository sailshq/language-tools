const lsp = require('vscode-languageserver/node')

module.exports = function modelMethodsCompletion(document, position, typeMap) {
  const JS_FILE_TYPES = ['helpers', 'controllers', 'scripts', 'models']
  const isRelevantFile = JS_FILE_TYPES.some((type) =>
    document.uri.includes(`${type}/`)
  )
  if (!isRelevantFile) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  // Match static calls like User.method or sails.models.user.method
  const staticCallMatch = before.match(
    /(?:sails\.models\.([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))\.\s*([a-zA-Z]*)?$/
  )
  const chainableCallMatch = before.match(
    /([A-Za-z_$][\w$]*)\.\w+\(\)\.\s*([a-zA-Z]*)?$/
  )

  let modelName, prefix, methods

  // Make model lookup case-insensitive
  const models = typeMap.models || {}
  const modelKeys = Object.keys(models)

  if (chainableCallMatch) {
    modelName = chainableCallMatch[1]
    prefix = chainableCallMatch[2] || ''
    if (!modelName) return []
    const foundKey = modelKeys.find(
      (k) => k.toLowerCase() === modelName.toLowerCase()
    )
    methods = foundKey ? models[foundKey].chainableMethods || [] : []
  } else if (staticCallMatch) {
    modelName = staticCallMatch[1] || staticCallMatch[2]
    prefix = staticCallMatch[3] || ''
    if (!modelName) return []
    const foundKey = modelKeys.find(
      (k) => k.toLowerCase() === modelName.toLowerCase()
    )
    methods = foundKey ? models[foundKey].methods || [] : []
  } else {
    return []
  }

  return methods
    .filter((method) => method.name.startsWith(prefix))
    .map((method) => ({
      label: method.name,
      kind: lsp.CompletionItemKind.Method,
      detail: method.description,
      documentation: `${modelName}.${method.name}()`,
      sortText: method.name,
      filterText: method.name,
      insertText: method.name + '($0)',
      insertTextFormat: lsp.InsertTextFormat.Snippet
    }))
}
