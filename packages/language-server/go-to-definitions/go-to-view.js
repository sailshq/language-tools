const lsp = require('vscode-languageserver/node')
const path = require('path')

module.exports = async function goToView(document, position, typeMap) {
  const fileName = path.basename(document.uri)
  const filePath = document.uri
  const text = document.getText()
  const offset = document.offsetAt(position)

  const isRoutes = fileName === 'routes.js'
  const isController = filePath.includes('/api/controllers/')

  if (!isRoutes && !isController) return null

  const regex =
    /\b(viewTemplatePath|view)\s*:\s*(?<quote>['"])(?<view>[^'"]+)\k<quote>/g

  let match
  while ((match = regex.exec(text)) !== null) {
    const viewName = match.groups.view
    const quote = match.groups.quote
    const fullMatchStart =
      match.index + match[0].indexOf(quote + viewName + quote)
    const fullMatchEnd = fullMatchStart + viewName.length + 2

    if (offset >= fullMatchStart && offset <= fullMatchEnd) {
      const viewPath = typeMap.views?.[viewName]
      if (viewPath) {
        const uri = `file://${viewPath.path}`
        return lsp.LocationLink.create(
          uri,
          lsp.Range.create(0, 0, 0, 0),
          lsp.Range.create(0, 0, 0, 0),
          lsp.Range.create(
            document.positionAt(fullMatchStart),
            document.positionAt(fullMatchEnd)
          )
        )
      }
    }
  }
  return null
}
