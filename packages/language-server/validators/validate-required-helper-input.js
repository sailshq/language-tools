const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = function validateRequiredHelperInput(document, typeMap) {
  const diagnostics = []
  const documentUri = document.uri

  // Only validate files in backend directories where helpers are accessible
  if (!documentUri.includes('/api/') && !documentUri.includes('/scripts/')) {
    return diagnostics
  }

  const text = document.getText()

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    walk.simple(ast, {
      CallExpression(node) {
        // Match sails.helpers.foo.bar.with({ ... })
        if (
          node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'with' &&
          node.callee.object &&
          node.callee.object.type === 'MemberExpression'
        ) {
          // Extract helper path from sails.helpers.foo.bar
          const helperPath = extractHelperPath(node.callee.object)
          if (!helperPath) return

          const helperInfo = typeMap.helpers && typeMap.helpers[helperPath]
          if (!helperInfo || !helperInfo.inputs) return

          // Get the object argument to .with()
          const objArg = node.arguments[0]
          if (!objArg || objArg.type !== 'ObjectExpression') return

          // Collect provided keys (handles both regular and shorthand properties)
          const providedKeys = new Set()
          for (const prop of objArg.properties) {
            if (prop.type === 'Property') {
              if (prop.key.type === 'Identifier') {
                providedKeys.add(prop.key.name)
              } else if (prop.key.type === 'Literal') {
                providedKeys.add(prop.key.value)
              }
            }
          }

          // Check for missing required inputs
          for (const [inputKey, inputDef] of Object.entries(
            helperInfo.inputs
          )) {
            const requiredValue =
              inputDef?.value?.required?.value ?? inputDef?.required
            const isRequired =
              requiredValue === true || requiredValue === 'true'
            if (isRequired && !providedKeys.has(inputKey)) {
              diagnostics.push(
                lsp.Diagnostic.create(
                  lsp.Range.create(
                    document.positionAt(objArg.start),
                    document.positionAt(objArg.end)
                  ),
                  `Missing required input '${inputKey}' for helper '${helperPath}'.`,
                  lsp.DiagnosticSeverity.Error,
                  'sails-lsp'
                )
              )
            }
          }
        }
      }
    })
  } catch (error) {
    // Ignore parse errors
  }

  return diagnostics
}

function extractHelperPath(node) {
  // Walk up the member expression to extract the full helper path
  const segments = []
  let current = node

  // Collect all segments until we reach sails.helpers
  while (current && current.type === 'MemberExpression') {
    if (current.property && current.property.type === 'Identifier') {
      const propName = current.property.name
      // Stop when we reach 'helpers'
      if (propName === 'helpers') {
        // Check if the object is 'sails'
        if (
          current.object &&
          current.object.type === 'Identifier' &&
          current.object.name === 'sails'
        ) {
          // Valid sails.helpers path found
          const toKebab = (s) =>
            s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
          return segments.map(toKebab).join('/')
        }
        return null
      }
      segments.unshift(propName)
    }
    current = current.object
  }

  return null
}
