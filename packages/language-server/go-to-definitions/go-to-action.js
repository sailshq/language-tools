const lsp = require('vscode-languageserver/node')
const path = require('path')

module.exports = async function goToAction(document, position, typeMap) {
  const fileName = path.basename(document.uri)
  if (fileName !== 'routes.js') return null

  const text = document.getText()
  const offset = document.offsetAt(position)

  const regex =
    /:\s*(?:{[^}]*?\baction\s*:\s*(?<quote>['"])(?<action>[^'"]+)\k<quote>[^}]*?}|(?<quoteAlt>['"])(?<actionAlt>[^'"]+)\k<quoteAlt>)/g

  let match

  while ((match = regex.exec(text)) !== null) {
    const actionName = match.groups.action || match.groups.actionAlt
    const quote = match.groups.quote || match.groups.quoteAlt
    const fullMatchStart =
      match.index + match[0].indexOf(quote + actionName + quote)
    const fullMatchEnd = fullMatchStart + actionName.length + 2 // +2 for quotes

    if (offset >= fullMatchStart && offset <= fullMatchEnd) {
      const routeEntry = Object.values(typeMap.routes).find(
        (route) => route.action?.name === actionName
      )
      if (routeEntry?.action) {
        const { path: actionPath, fnLine } = routeEntry.action
        const uri = `file://${actionPath}`
        return lsp.LocationLink.create(
          uri,
          lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
          lsp.Range.create(fnLine - 1, 0, fnLine - 1, 0),
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
