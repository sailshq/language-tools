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
  const sortStringMatch = before.match(/sort\s*:\s*['"]([a-zA-Z0-9_]*)?$/)
  const criteriaOptionsArrayMatch = before.match(
    /(?:select|omit|sort)\s*:\s*\[\s*['"]([a-zA-Z0-9_]*)?$/
  )
  const popuplateMethodMatch = before.match(
    /\.populate\s*\(\s*['"]([a-zA-Z0-9_]*)?$/
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
    /\.(select|omit|sort|populate|where)\s*\(\s*\[.*(?:,|\[)?\s*['"`]([a-zA-Z0-9_]*)?$/
  )

  // Also allow completions in .where({ ... }) chainable method call context
  const whereMethodCallRegex = /\.where\s*\(\s*\{[^\)]*$/
  const isInWhereMethodCall = whereMethodCallRegex.test(before)

  // Add: detect .where({ ... }) context for modelName/prefix inference
  const whereMethodCallMatch = before.match(
    /([A-Za-z_$][\w$]*)\s*\.where\s*\(\s*\{[^}]*([a-zA-Z0-9_]*)?$/
  )

  // Support chained .where({ ... }) completions ---
  // Try to infer model name from chained calls like User.find().where({ ... })
  const chainedWhereMatch = before.match(
    /([A-Za-z_$][\w$]*)\s*\.[\w$]+\s*\(.*?\)\s*\.where\s*\(\s*\{[^}]*([a-zA-Z0-9_]*)?$/
  )

  // Only suppress completions after a colon (:) in object literals for static methods,
  // but always allow completions in .select(['']), .omit(['']), .sort(['']), .where({}), etc.
  const inChainableString =
    criteriaOptionsArrayMatch ||
    sortStringMatch ||
    sortArrayObjectMatch ||
    popuplateMethodMatch ||
    isInChainableMethodCall ||
    isInWhereMethodCall ||
    !!chainableDirectCallMatch

  // Suppress completions after a colon only if NOT in a chainable string/array context
  // Also suppress completions after colon in .where({ ... }) context, unless after a comma or at start
  if (!inChainableString || isInWhereMethodCall || chainedWhereMatch) {
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

  // Determine the current Sails.js model context and attribute prefix for completions
  // by matching the code before the cursor against various Sails.js query patterns.
  // This enables context-aware attribute completions for all supported query forms.
  if (criteriaMatch) {
    modelName = criteriaMatch[1] || criteriaMatch[2]
    prefix = criteriaMatch[3] || ''
  } else if (criteriaOptionsArrayMatch) {
    modelName = inferModelName(before)
    prefix = criteriaOptionsArrayMatch[1] || ''
  } else if (popuplateMethodMatch) {
    isPopulate = true
    modelName = inferModelName(before)
    prefix = popuplateMethodMatch[1] || ''
  } else if (
    sortStringMatch ||
    criteriaOptionsArrayMatch ||
    sortArrayObjectMatch
  ) {
    modelName = inferModelName(before)
    prefix =
      (sortStringMatch ||
        criteriaOptionsArrayMatch ||
        sortArrayObjectMatch)[1] || ''
  } else if (whereMethodCallMatch) {
    modelName = whereMethodCallMatch[1]
    prefix = whereMethodCallMatch[2] || ''
  } else if (chainedWhereMatch) {
    modelName = chainedWhereMatch[1]
    prefix = chainedWhereMatch[2] || ''
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

  // Remove already-used attributes for both object and array/chainable forms
  // Collect all used attributes from any select/omit/sort array in object or chainable form up to the cursor
  const allArrayRegex =
    /(select|omit|sort)\s*:\s*\[([^\]]*)\]|\.(select|omit|sort)\s*\(\s*\[([^\]]*)/g
  let match
  while ((match = allArrayRegex.exec(before)) !== null) {
    const arrayContent = match[2] || match[4] || ''
    const usedInArray = Array.from(
      arrayContent.matchAll(/['"`]\s*([a-zA-Z0-9_]+)\s*['"`]/g)
    ).map((m) => m[1])
    usedInArray.forEach((attr) => usedProps.add(attr))
  }

  // Improved: Only trigger completions in object form select/omit/sort arrays when inside a string (after opening quote)
  if (criteriaOptionsArrayMatch) {
    // Find the last '[' before the cursor
    const arrayStart = before.lastIndexOf('[')
    if (arrayStart !== -1) {
      const arrayContent = before.slice(arrayStart, offset)
      // Only trigger if the last non-whitespace character is a quote (i.e., user is typing a string)
      const lastQuote = arrayContent.match(/['"`]([^'"`]*)$/)
      if (!lastQuote) {
        // Not inside a string, suppress completions
        return []
      }
    }
  }

  if (criteriaOptionsArrayMatch) {
    // For object form: find the select/omit/sort array in the object literal up to the cursor
    // Try to extract the array content for select: ['foo', 'bar', ...]
    // Find the last occurrence of select: [ or omit: [ or sort: [ before the cursor
    const arrayStart = before.lastIndexOf('[')
    if (arrayStart !== -1) {
      const arrayContent = before.slice(arrayStart, offset)
      // Match all quoted strings in the array up to the cursor
      const usedInArray = Array.from(
        arrayContent.matchAll(/['"`]\s*([a-zA-Z0-9_]+)\s*['"`]/g)
      ).map((m) => m[1])
      usedInArray.forEach((attr) => usedProps.add(attr))
    }
  }
  if (chainableDirectCallMatch) {
    // For array/chainable forms, parse the array up to the cursor and collect used attributes
    const arrayMatch = before.match(/\[([^\]]*)$/)
    if (arrayMatch) {
      const arrayContent = arrayMatch[1]
      const usedInArray = Array.from(
        arrayContent.matchAll(/['"`]\s*([a-zA-Z0-9_]+)\s*['"`]/g)
      ).map((m) => m[1])
      usedInArray.forEach((attr) => usedProps.add(attr))
    }
  }

  if (isPopulate) {
    attributes = Object.entries(model.attributes || {})
      .filter(([, def]) => def && (def.model || def.collection))
      .map(([attr]) => attr)
  } else {
    attributes = Object.keys(model.attributes || {})
  }

  return Array.from(
    new Set(
      attributes
        .filter((attr) => attr.toLowerCase().startsWith(prefix.toLowerCase()))
        .filter((attr) => !usedProps.has(attr))
    )
  ).map((attr) => {
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
