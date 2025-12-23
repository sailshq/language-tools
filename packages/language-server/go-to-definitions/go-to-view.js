const lsp = require('vscode-languageserver/node')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = async function goToView(document, position, typeMap) {
  const fileName = path.basename(document.uri)
  const filePath = document.uri
  const text = document.getText()
  const offset = document.offsetAt(position)

  const isRoutes = fileName === 'routes.js'
  const isController = filePath.includes('/api/controllers/')

  if (!isRoutes && !isController) return null

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    let result = null

    walk.simple(ast, {
      Property(node) {
        if (
          node.key &&
          (node.key.name === 'viewTemplatePath' ||
            node.key.value === 'viewTemplatePath' ||
            node.key.name === 'view' ||
            node.key.value === 'view') &&
          node.value &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const viewName = node.value.value
          if (offset >= node.value.start && offset <= node.value.end) {
            const viewPath = typeMap.views?.[viewName]
            if (viewPath) {
              const uri = `file://${viewPath.path}`
              result = lsp.LocationLink.create(
                uri,
                lsp.Range.create(0, 0, 0, 0),
                lsp.Range.create(0, 0, 0, 0),
                lsp.Range.create(
                  document.positionAt(node.value.start),
                  document.positionAt(node.value.end)
                )
              )
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
