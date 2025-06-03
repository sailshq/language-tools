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
    /sort\s*:\s*\[\s*[^\{\]]*['"]([a-zA-Z0-9_]*)?$/
  )
  const sortArrayObjectMatch = before.match(
    /sort\s*:\s*\[\s*\{\s*([a-zA-Z0-9_]*)?$/
  )

  // Detect if we are inside a .select(['']), .omit(['']), .sort(['']), etc. chainable method call context
  // This matches e.g. .select(['foo', '']) or .omit(["bar", '']) or .select('foo')
  const chainableMethodCallRegex =
    /\.(select|omit|sort)\s*\(\s*([\[\{]?[^\)]*)$/
  const isInChainableMethodCall = chainableMethodCallRegex.test(before)

  // Detect if we are inside a .select([]), .omit([]), .sort([]), etc. as a method call (e.g. User.find().select([]))
  // This matches e.g. .select(['foo', '']) or .omit(["bar", '']) or .select('foo')
  const chainableDirectCallMatch = before.match(
    /\.(select|omit|sort|populate|where)\s*\(\s*\[?\s*['"]?([a-zA-Z0-9_]*)?$/
  )

  // Also allow completions in .where({ ... }) chainable method call context
  const whereMethodCallRegex = /\.where\s*\(\s*\{[^\)]*$/
  const isInWhereMethodCall = whereMethodCallRegex.test(before)

  // Add: detect .where({ ... }) context for modelName/prefix inference
  const whereMethodCallMatch = before.match(
    /([A-Za-z_$][\w$]*)\s*\.where\s*\(\s*\{[^}]*([a-zA-Z0-9_]*)?$/
  )

  // Only suppress completions after a colon (:) in object literals for static methods,
  // but always allow completions in .select(['']), .omit(['']), .sort(['']), .where({}), etc.
  const inChainableString =
    selectStringMatch ||
    selectArrayMatch ||
    sortStringMatch ||
    sortArrayStringMatch ||
    sortArrayObjectMatch ||
    populateStringMatch ||
    isInChainableMethodCall ||
    isInWhereMethodCall ||
    !!chainableDirectCallMatch

  // Suppress completions after a colon only if NOT in a chainable string/array context
  if (!inChainableString) {
    const lines = before.split('\n')
    const line = lines[lines.length - 1]
    const beforeCursor = line.slice(0, position.character)
    // If the last non-whitespace character before the cursor is a colon, suppress completion
    // (but allow after comma, or at start of line/object)
    const lastColon = beforeCursor.lastIndexOf(':')
    const lastComma = beforeCursor.lastIndexOf(',')
    if (lastColon > lastComma && lastColon > beforeCursor.lastIndexOf('{')) {
      // Check if we are inside a string (e.g. after a colon and inside quotes)
      // If so, suppress completion
      const quoteBefore = beforeCursor.lastIndexOf("'")
      const dquoteBefore = beforeCursor.lastIndexOf('"')
      if (
        (quoteBefore > lastColon && quoteBefore > lastComma) ||
        (dquoteBefore > lastColon && dquoteBefore > lastComma)
      ) {
        return []
      }
      // Otherwise, suppress completion after colon
      return []
    }
  }

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
  } else if (whereMethodCallMatch) {
    modelName = whereMethodCallMatch[1]
    prefix = whereMethodCallMatch[2] || ''
  } else if (chainableDirectCallMatch) {
    modelName = inferModelName(before)
    prefix = chainableDirectCallMatch[2] || ''
  } else {
    return []
  }

  if (!modelName) return []
  const foundKey = modelKeys.find(
    (k) => k.toLowerCase() === modelName.toLowerCase()
  )
  const model = foundKey ? models[foundKey] : null
  if (!model) return []

  // Find already-used property names in the current object literal (if inside one)
  let usedProps = new Set()
  // Use the text before the cursor to find the nearest opening brace
  const beforeCursorFull = text.slice(0, offset)
  const lastOpen = beforeCursorFull.lastIndexOf('{')
  const lastClose = beforeCursorFull.lastIndexOf('}')
  if (lastOpen !== -1 && (lastClose === -1 || lastOpen > lastClose)) {
    // Only consider properties before the cursor
    const objectText = beforeCursorFull.slice(lastOpen, offset)
    // Match both foo: ... and object shorthand foo,
    const propRegex = /([a-zA-Z0-9_]+)\s*:/g
    const shorthandRegex = /([a-zA-Z0-9_]+)\s*,/g
    let m
    while ((m = propRegex.exec(objectText)) !== null) {
      usedProps.add(m[1])
    }
    while ((m = shorthandRegex.exec(objectText)) !== null) {
      usedProps.add(m[1])
    }
  }

  if (isPopulate) {
    attributes = Object.entries(model.attributes || {})
      .filter(([, def]) => def && (def.model || def.collection))
      .map(([attr]) => attr)
  } else {
    attributes = Object.keys(model.attributes || {})
  }

  return attributes
    .filter((attr) => attr.startsWith(prefix))
    .filter((attr) => !usedProps.has(attr))
    .map((attr) => {
      const attrDef = model.attributes && model.attributes[attr]
      let type = attrDef && attrDef.type ? attrDef.type : ''
      let required = attrDef && attrDef.required ? 'required' : 'optional'
      let detail = type ? `${type} (${required})` : required
      return {
        label: attr,
        kind: lsp.CompletionItemKind.Field,
        detail,
        documentation: `${modelName}.${attr}`,
        sortText: attr,
        filterText: attr,
        insertText: attr
      }
    })
}
