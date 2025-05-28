const lsp = require('vscode-languageserver/node')

module.exports = function modelAttributesCompletion(
  document,
  position,
  typeMap
) {
  const JS_FILE_TYPES = ['helpers', 'controllers', 'scripts', 'models']
  const isRelevantFile = JS_FILE_TYPES.some((type) =>
    document.uri.includes(`${type}/`)
  )
  if (!isRelevantFile) return []

  const text = document.getText()
  const offset = document.offsetAt(position)
  const before = text.substring(0, offset)

  const criteriaMatch = before.match(
    /(?:sails\.models\.([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))\s*\.\w+\s*\(\s*\{[^}]*([a-zA-Z0-9_]*)?$/
  )
  const selectStringMatch = before.match(
    /(?:select|omit|sort)\s*:\s*['"]([a-zA-Z0-9_]*)?$/
  )
  const selectArrayMatch = before.match(
    /(?:select|omit|sort)\s*:\s*\[\s*['"]([a-zA-Z0-9_]*)?$/
  )
  const populateStringMatch = before.match(
    /populate\s*:\s*['"]([a-zA-Z0-9_]*)?$/
  )
  const sortStringMatch = before.match(/sort\s*:\s*['"]([a-zA-Z0-9_]*)?$/)
  const sortArrayStringMatch = before.match(
    /sort\s*:\s*\[\s*[^{\]]*['"]([a-zA-Z0-9_]*)?$/
  )
  const sortArrayObjectMatch = before.match(
    /sort\s*:\s*\[\s*\{\s*([a-zA-Z0-9_]*)?$/
  )

  let modelName,
    prefix,
    attributes,
    isPopulate = false

  const models = typeMap.models || {}
  const modelKeys = Object.keys(models)

  // Better model name inference using last static model call
  function inferModelName(before) {
    const allMatches = [
      ...before.matchAll(
        /(?:sails\.models\.([A-Za-z_$][\w$]*)|([A-Z][A-Za-z0-9_]*))\s*\./g
      )
    ]
    if (allMatches.length === 0) return null
    const last = allMatches[allMatches.length - 1]
    return last[1] || last[2] || null
  }

  if (criteriaMatch) {
    modelName = criteriaMatch[1] || criteriaMatch[2]
    prefix = criteriaMatch[3] || ''
  } else if (selectStringMatch || selectArrayMatch) {
    modelName = inferModelName(before)
    prefix = (selectStringMatch || selectArrayMatch)[1] || ''
  } else if (populateStringMatch) {
    isPopulate = true
    modelName = inferModelName(before)
    prefix = populateStringMatch[1] || ''
  } else if (sortStringMatch || sortArrayStringMatch || sortArrayObjectMatch) {
    modelName = inferModelName(before)
    prefix =
      (sortStringMatch || sortArrayStringMatch || sortArrayObjectMatch)[1] || ''
  } else {
    return []
  }

  if (!modelName) return []
  const foundKey = modelKeys.find(
    (k) => k.toLowerCase() === modelName.toLowerCase()
  )
  const model = foundKey ? models[foundKey] : null
  if (!model) return []

  if (isPopulate) {
    attributes = Object.entries(model.attributes || {})
      .filter(([, def]) => def && (def.model || def.collection))
      .map(([attr]) => attr)
  } else {
    attributes = Object.keys(model.attributes || {})
  }

  return attributes
    .filter((attr) => attr.startsWith(prefix))
    .map((attr) => ({
      label: attr,
      kind: lsp.CompletionItemKind.Field,
      detail: `Attribute of ${modelName}`,
      documentation: `${modelName}.${attr}`,
      sortText: attr,
      filterText: attr,
      insertText: attr
    }))
}
