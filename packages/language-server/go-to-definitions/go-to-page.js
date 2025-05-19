const lsp = require('vscode-languageserver/node')

module.exports = async function goToPage(document, position, typeMap) {
  const filePath = document.uri
  if (!filePath.includes('/api/controllers/')) return null

  const text = document.getText()
  const offset = document.offsetAt(position)

  const regex =
    /:\s*{[^}]*?\bpage\s*:\s*(?<quote>['"])(?<page>[^'"]+)\k<quote>[^}]*?}/g

  let match

  while ((match = regex.exec(text)) !== null) {
    const pageName = match.groups.page
    const quote = match.groups.quote
    const fullMatchStart =
      match.index + match[0].indexOf(quote + pageName + quote)
    const fullMatchEnd = fullMatchStart + pageName.length + 2

    if (offset >= fullMatchStart && offset <= fullMatchEnd) {
      const pagePath = typeMap.pages?.[pageName]
      if (pagePath) {
        const uri = `file://${pagePath.path}`
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
