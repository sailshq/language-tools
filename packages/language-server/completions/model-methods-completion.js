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
  // Match all chainable calls and get the last one for completion
  const chainableCallMatches = [
    ...before.matchAll(/([A-Za-z_$][\w$]*)\.[a-zA-Z_]+\([^)]*\)/g)
  ]

  let modelName, prefix, methods

  // Make model lookup case-insensitive
  const models = typeMap.models || {}
  const modelKeys = Object.keys(models)

  if (chainableCallMatches.length > 0) {
    // Use the last chainable call in the chain
    const lastMatch = chainableCallMatches[chainableCallMatches.length - 1]
    modelName = lastMatch[1]
    // Get the prefix after the last dot (if user is typing e.g. .select)
    const afterLastChain = before.slice(lastMatch.index + lastMatch[0].length)
    const prefixMatch = afterLastChain.match(/\.\s*([a-zA-Z]*)?$/)
    prefix = (prefixMatch && prefixMatch[1]) || ''
    const foundKey = Object.keys(models).find(
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
    .map((method) => {
      let insertText = method.name + '($0)'
      // For chainable .select or .omit, insert ([''])
      if (
        chainableCallMatches.length > 0 &&
        (method.name === 'select' || method.name === 'omit')
      ) {
        insertText = method.name + '([$0])'
      }
      return {
        label: method.name,
        kind: lsp.CompletionItemKind.Method,
        detail: method.description,
        documentation: `${modelName}.${method.name}()`,
        sortText: method.name,
        filterText: method.name,
        insertText,
        insertTextFormat: lsp.InsertTextFormat.Snippet
      }
    })
}
