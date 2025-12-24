const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

const WATERLINE_MODIFIERS = ['or', 'and', 'not']
const WATERLINE_OPERATORS = [
  '<',
  '<=',
  '>',
  '>=',
  '!=',
  'nin',
  'in',
  'contains',
  'startsWith',
  'endsWith',
  'like',
  '!'
]

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

  // Don't provide completions after a chainable method call dot (e.g., User.find().catch|)
  // This context should show chainable methods, not attributes
  const afterChainableDot = /\.[a-zA-Z_]+\([^)]*\)\.\s*[a-zA-Z]*$/
  if (afterChainableDot.test(before)) {
    return []
  }

  // Don't provide completions inside operator value arrays like { in: ['val1', ''] }
  // Check if we're inside an array that follows an operator
  const insideOperatorArray = before.match(
    /(in|nin|contains|startsWith|endsWith|like)\s*:\s*\[[^\]]*$/
  )
  if (insideOperatorArray) {
    return []
  }

  // Don't provide completions inside operator objects like { contains: '...', | }
  // Check if we're after a comma inside an object that has operator keys
  const insideOperatorObject = before.match(
    /\{[^}]*(contains|startsWith|endsWith|like|in|nin|<|<=|>|>=|!=|!)\s*:[^}]*,\s*[a-zA-Z0-9_]*$/
  )
  if (insideOperatorObject) {
    return []
  }

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
  // FIX: Do not run this suppression logic at all if we are in a select/omit/sort array (object property form)
  if (!criteriaOptionsArrayMatch) {
    if (
      !inChainableString ||
      ((isInWhereMethodCall || chainedWhereMatch) && !criteriaOptionsArrayMatch)
    ) {
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
  }

  let modelName,
    prefix,
    attributes,
    isPopulate = false

  const models = typeMap.models || {}
  const modelKeys = Object.keys(models)

  // Helper to check if an identifier is a known Sails model
  function isLikelyModel(name) {
    if (!name) return false
    const knownGlobals = [
      '_',
      'sails',
      'require',
      'module',
      'exports',
      'console',
      'process'
    ]
    if (knownGlobals.includes(name)) return false
    const upper = name.charAt(0).toUpperCase() + name.slice(1)
    return !!(typeMap.models && typeMap.models[upper])
  }

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

  // AST-based detection: Check if cursor is inside a Waterline query object
  // This handles nested contexts like or/and/not modifiers and operator objects
  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })

    let astModelName = null
    let astPrefix = ''
    let foundContext = false

    walk.ancestor(ast, {
      CallExpression(node, ancestors) {
        if (!node.callee || node.callee.type !== 'MemberExpression') return

        // Only trigger for query methods, not chainable methods
        const method = node.callee.property?.name
        const queryMethods = [
          'find',
          'findOne',
          'create',
          'createEach',
          'update',
          'destroy',
          'count',
          'sum',
          'findOrCreate',
          'where'
        ]
        if (!queryMethods.includes(method)) return

        // Extract model name from call chain
        let obj = node.callee.object
        while (obj) {
          if (obj.type === 'Identifier') {
            if (isLikelyModel(obj.name)) {
              astModelName = obj.name
            }
            break
          } else if (
            obj.type === 'CallExpression' &&
            obj.callee &&
            obj.callee.type === 'MemberExpression'
          ) {
            obj = obj.callee.object
          } else {
            break
          }
        }

        if (!astModelName) return

        // Helper to get model by name
        function getModelByName(name) {
          if (!name) return undefined
          const upper = name.charAt(0).toUpperCase() + name.slice(1)
          return typeMap.models[upper]
        }

        // Check if cursor is inside an argument object
        const arg = node.arguments[0]
        if (!arg || arg.type !== 'ObjectExpression') return
        if (offset < arg.start || offset > arg.end) return

        // Query option keys that should NOT be treated as model attributes
        const queryOptionKeys = [
          'where',
          'select',
          'omit',
          'sort',
          'limit',
          'skip',
          'page',
          'populate',
          'groupBy',
          'having',
          'sum',
          'average',
          'min',
          'max',
          'distinct',
          'meta'
        ]

        // Recursively check if cursor is in a valid attribute position
        function checkObjectForCursor(objNode, isInsideWhere = false) {
          if (!objNode || objNode.type !== 'ObjectExpression') return false
          if (offset < objNode.start || offset > objNode.end) return false

          // Determine if this object contains any model attributes (vs only query options)
          let hasAttributes = false
          let hasQueryOptions = false
          let hasOperators = false
          let hasModifiers = false
          for (const prop of objNode.properties) {
            if (!prop.key) continue
            const keyName = prop.key.name || prop.key.value
            if (queryOptionKeys.includes(keyName)) {
              hasQueryOptions = true
            } else if (WATERLINE_OPERATORS.includes(keyName)) {
              hasOperators = true
            } else if (WATERLINE_MODIFIERS.includes(keyName)) {
              hasModifiers = true
            } else {
              // Check if it's a valid attribute
              const model = getModelByName(astModelName)
              if (
                model &&
                model.attributes &&
                Object.prototype.hasOwnProperty.call(model.attributes, keyName)
              ) {
                hasAttributes = true
              }
            }
          }

          // If this object contains operators, it's an operator object - don't show completions
          if (hasOperators) {
            return false
          }

          // Determine context:
          // - If we have query options (like where, select, limit), this is a query options object
          // - If we're explicitly inside a where clause (isInsideWhere), show attributes
          // - If we have attributes but no query options, it's a criteria object
          // - Modifiers at top level don't make this a criteria object (only inside them)
          const isCriteriaMode =
            isInsideWhere || (hasAttributes && !hasQueryOptions)

          // If we have query options or modifiers and we're not inside where, this is NOT a criteria context
          // Don't show attribute completions at the query options level
          if ((hasQueryOptions || hasModifiers) && !isInsideWhere) {
            // But we still need to check if we're typing a new key after existing query options
            // Check if cursor is in a position to type a new key
            const isTypingNewKey =
              objNode.properties.length > 0 &&
              offset > objNode.properties[objNode.properties.length - 1].end &&
              offset < objNode.end

            if (isTypingNewKey) {
              // Don't show attributes, this should show query option keys instead
              return false
            }
          }

          for (const prop of objNode.properties) {
            if (!prop.key) continue

            // Check if cursor is at the key position (typing attribute name)
            if (offset >= prop.key.start && offset <= prop.key.end) {
              const keyName = prop.key.name || prop.key.value
              // Skip if it's a modifier or operator
              if (
                WATERLINE_MODIFIERS.includes(keyName) ||
                WATERLINE_OPERATORS.includes(keyName)
              ) {
                return false
              }
              // Skip query option keys if we're in criteria mode
              if (isCriteriaMode && queryOptionKeys.includes(keyName)) {
                return false
              }
              astPrefix = text.substring(prop.key.start, offset)
              return true
            }

            const keyName = prop.key.name || prop.key.value

            // If it's 'where', check inside its object value
            if (keyName === 'where') {
              if (prop.value && prop.value.type === 'ObjectExpression') {
                if (checkObjectForCursor(prop.value, true)) return true
              }
            }

            // If it's a modifier (or/and/not), check inside the array at any level
            if (WATERLINE_MODIFIERS.includes(keyName)) {
              if (
                prop.value &&
                prop.value.type === 'ArrayExpression' &&
                prop.value.elements
              ) {
                for (const el of prop.value.elements) {
                  if (el && el.type === 'ObjectExpression') {
                    if (checkObjectForCursor(el, true)) return true
                  }
                }
              }
            }

            // If the value is an object with operators, don't recurse into it
            if (
              prop.value &&
              prop.value.type === 'ObjectExpression' &&
              prop.value.properties &&
              prop.value.properties.length > 0
            ) {
              const firstKey =
                prop.value.properties[0].key?.name ||
                prop.value.properties[0].key?.value
              if (WATERLINE_OPERATORS.includes(firstKey)) {
                // This is an operator object like { '>': 100 } or { in: [...] }
                // Don't provide completions inside operator values
                continue
              }
            }

            // If the value is an array and we're inside it, check if this is an operator value
            // For example: { in: ['val1', 'val2'] } - don't complete inside the array
            if (
              prop.value &&
              prop.value.type === 'ArrayExpression' &&
              offset >= prop.value.start &&
              offset <= prop.value.end
            ) {
              // Check if this property key is an operator
              if (WATERLINE_OPERATORS.includes(keyName)) {
                // We're inside an operator's array value - don't provide attribute completions
                return false
              }
            }
          }

          // Check if cursor is after last property (typing new attribute)
          if (objNode.properties.length > 0) {
            const lastProp = objNode.properties[objNode.properties.length - 1]
            if (offset > lastProp.end && offset < objNode.end) {
              // Cursor is after last property, typing new attribute
              const afterLast = text.substring(lastProp.end, offset)
              const newKeyMatch = afterLast.match(/[,\s]*([a-zA-Z0-9_]*)$/)
              if (newKeyMatch) {
                astPrefix = newKeyMatch[1]
                // Return true to indicate we found a valid context
                // The isCriteriaMode flag will be used when building completions
                return true
              }
            }
          } else {
            // Empty object, check if cursor is inside
            const insideText = text.substring(objNode.start + 1, offset)
            const newKeyMatch = insideText.match(/^\s*([a-zA-Z0-9_]*)$/)
            if (newKeyMatch) {
              astPrefix = newKeyMatch[1]
              return true
            }
          }

          return false
        }

        if (checkObjectForCursor(arg)) {
          foundContext = true
        }
      }
    })

    if (foundContext && astModelName) {
      modelName = astModelName
      prefix = astPrefix
      const foundKey = modelKeys.find(
        (k) => k.toLowerCase() === modelName.toLowerCase()
      )
      const model = foundKey ? models[foundKey] : null
      if (model) {
        attributes = Object.keys(model.attributes || {})
        return Array.from(
          new Set(
            attributes.filter((attr) =>
              attr.toLowerCase().startsWith(prefix.toLowerCase())
            )
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
    }
  } catch (err) {
    // Fall through to regex-based detection
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

  // Improved: Only trigger completions in object form select/omit/sort arrays when inside a string (between quotes)
  if (criteriaOptionsArrayMatch) {
    // Find the last '[' before the cursor
    const arrayStart = before.lastIndexOf('[')
    if (arrayStart !== -1) {
      const arrayContent = before.slice(arrayStart, offset)
      // Use the same logic as chainable: check for a quote before the cursor (inside a string)
      const quoteMatch = arrayContent.match(/['"`]([^'"`]*)$/)
      if (!quoteMatch) {
        // Not inside a string, suppress completions
        return []
      }
      // Also: filter out already-used attributes in this array
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
      // Fix: allow completions for any string in the array, not just the first
      // Find the last quote and ensure the cursor is after it (inside a string)
      const quoteMatch = arrayContent.match(/['"`][^'"`]*$/)
      if (!quoteMatch) {
        // Not inside a string, suppress completions
        return []
      }
      // Also: filter out already-used attributes in this array
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
