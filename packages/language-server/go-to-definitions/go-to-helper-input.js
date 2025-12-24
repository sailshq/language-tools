const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = async function goToHelperInput(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    let result = null

    walk.simple(ast, {
      CallExpression(node) {
        if (
          node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'with' &&
          node.callee.object &&
          node.callee.object.type === 'MemberExpression'
        ) {
          const helperPath = extractHelperPath(node.callee.object)
          if (!helperPath) return

          const helperInfo = typeMap.helpers && typeMap.helpers[helperPath]
          if (!helperInfo || !helperInfo.inputs) return

          const objArg = node.arguments[0]
          if (!objArg || objArg.type !== 'ObjectExpression') return

          for (const prop of objArg.properties) {
            if (prop.type !== 'Property' || !prop.key) continue

            const inputName =
              prop.key.type === 'Identifier'
                ? prop.key.name
                : prop.key.type === 'Literal'
                  ? prop.key.value
                  : null

            if (!inputName) continue

            const keyStart = prop.key.start
            const keyEnd = prop.key.end

            if (offset >= keyStart && offset <= keyEnd) {
              const inputInfo = helperInfo.inputs[inputName]
              if (inputInfo?.line) {
                const uri = `file://${helperInfo.path}`
                result = lsp.LocationLink.create(
                  uri,
                  lsp.Range.create(
                    inputInfo.line - 1,
                    0,
                    inputInfo.line - 1,
                    0
                  ),
                  lsp.Range.create(
                    inputInfo.line - 1,
                    0,
                    inputInfo.line - 1,
                    0
                  ),
                  lsp.Range.create(
                    document.positionAt(keyStart),
                    document.positionAt(keyEnd)
                  )
                )
                return
              }
            }
          }
        }
      }
    })

    return result
  } catch (error) {
    return null
  }
}

function extractHelperPath(node) {
  const segments = []
  let current = node

  while (current && current.type === 'MemberExpression') {
    if (current.property && current.property.type === 'Identifier') {
      const propName = current.property.name
      if (propName === 'helpers') {
        if (
          current.object &&
          current.object.type === 'Identifier' &&
          current.object.name === 'sails'
        ) {
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
