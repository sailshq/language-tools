const lsp = require('vscode-languageserver/node')

function toKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

module.exports = async function goToHelper(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // Match sails.helpers.foo or sails.helpers.bar.baz
  const regex =
    /\bsails\.helpers(?:\.(?<group>[a-zA-Z0-9_]+))?\.(?<helper>[a-zA-Z0-9_]+)(?![\w.])/g

  let match

  while ((match = regex.exec(text)) !== null) {
    const { group, helper } = match.groups

    const kebabGroup = group ? toKebab(group) : null
    const kebabHelper = toKebab(helper)
    const fullHelperName = kebabGroup
      ? `${kebabGroup}/${kebabHelper}`
      : kebabHelper

    // Compute accurate range for just the helper name
    const helperStart = match.index + match[0].lastIndexOf(helper)
    const helperEnd = helperStart + helper.length

    if (offset >= helperStart && offset <= helperEnd) {
      const helperInfo = typeMap.helpers?.[fullHelperName]
      if (helperInfo && helperInfo.path) {
        const uri = `file://${helperInfo.path}`
        return lsp.LocationLink.create(
          uri,
          lsp.Range.create(helperInfo.fnLine - 1, 0, helperInfo.fnLine - 1, 0),
          lsp.Range.create(helperInfo.fnLine - 1, 0, helperInfo.fnLine - 1, 0),
          lsp.Range.create(
            document.positionAt(helperStart),
            document.positionAt(helperEnd)
          )
        )
      }
    }
  }
  return null
}
