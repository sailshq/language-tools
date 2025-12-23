const lsp = require('vscode-languageserver/node')
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = async function goToAction(document, position, typeMap) {
  const fileName = path.basename(document.uri)
  if (fileName !== 'routes.js') return null

  const text = document.getText()
  const offset = document.offsetAt(position)

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    let result = null

    walk.simple(ast, {
      Property(node) {
        if (
          node.value &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const actionName = node.value.value
          if (
            !actionName.startsWith('/') &&
            !actionName.startsWith('http://') &&
            !actionName.startsWith('https://')
          ) {
            if (offset >= node.value.start && offset <= node.value.end) {
              const routeEntry = Object.values(typeMap.routes).find(
                (route) => route.action?.name === actionName
              )
              if (routeEntry?.action) {
                const { path: actionPath, fnLine } = routeEntry.action
                const uri = `file://${actionPath}`
                result = lsp.LocationLink.create(
                  uri,
                  lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
                  lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
                  lsp.Range.create(
                    document.positionAt(node.value.start),
                    document.positionAt(node.value.end)
                  )
                )
              }
            }
          }
        } else if (
          node.value &&
          node.value.type === 'ObjectExpression' &&
          node.value.properties
        ) {
          for (const prop of node.value.properties) {
            if (
              prop.type === 'Property' &&
              prop.key &&
              (prop.key.name === 'action' || prop.key.value === 'action') &&
              prop.value &&
              prop.value.type === 'Literal' &&
              typeof prop.value.value === 'string'
            ) {
              const actionName = prop.value.value
              if (offset >= prop.value.start && offset <= prop.value.end) {
                const routeEntry = Object.values(typeMap.routes).find(
                  (route) => route.action?.name === actionName
                )
                if (routeEntry?.action) {
                  const { path: actionPath, fnLine } = routeEntry.action
                  const uri = `file://${actionPath}`
                  result = lsp.LocationLink.create(
                    uri,
                    lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
                    lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
                    lsp.Range.create(
                      document.positionAt(prop.value.start),
                      document.positionAt(prop.value.end)
                    )
                  )
                }
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
