const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = async function goToPage(document, position, typeMap) {
  const filePath = document.uri
  if (!filePath.includes('/api/controllers/')) return null
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
          node.key &&
          (node.key.name === 'page' || node.key.value === 'page') &&
          node.value &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const pageName = node.value.value
          if (offset >= node.value.start && offset <= node.value.end) {
            const pagePath = typeMap.pages?.[pageName]
            if (pagePath) {
              const uri = `file://${pagePath.path}`
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
