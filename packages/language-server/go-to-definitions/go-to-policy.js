const lsp = require('vscode-languageserver/node')
const path = require('path')

module.exports = async function goToPolicy(document, position, typeMap) {
  const fileName = path.basename(document.uri)
  if (fileName !== 'policies.js') return null

  const text = document.getText()
  const offset = document.offsetAt(position)

  const regex =
    /:\s*(\[\s*)?(?<quote>['"])(?<policy>[^'"]+)\k<quote>(\s*,\s*['"][^'"]+['"])*(\s*\])?/g

  let match

  while ((match = regex.exec(text)) !== null) {
    const policyName = match.groups.policy
    const quote = match.groups.quote
    const fullMatchStart =
      match.index + match[0].indexOf(quote + policyName + quote)
    const fullMatchEnd = fullMatchStart + policyName.length + 2

    if (offset >= fullMatchStart && offset <= fullMatchEnd) {
      const policyPath = typeMap.policies?.[policyName]
      if (policyPath) {
        const uri = `file://${policyPath.path}`
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
