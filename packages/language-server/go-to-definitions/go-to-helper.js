const lsp = require('vscode-languageserver/node')

function toKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

module.exports = async function goToHelper(document, position, typeMap) {
  console.log(JSON.stringify(typeMap.helpers, null, 2))
  const text = document.getText()
  const offset = document.offsetAt(position)

  // Match sails.helpers.foo, sails.helpers.foo(), sails.helpers.foo.with(), sails.helpers.foo.with({}), sails.helpers.bar.baz.with({}), etc.
  const regex =
    /\bsails\.helpers((?:\.[a-zA-Z0-9_]+)+)(?:\s*\(|(?:\.with)?\s*\()?/g

  let match

  while ((match = regex.exec(text)) !== null) {
    // match[1] is like '.email.sendEmail' or '.foo.bar.baz'
    const segments = match[1].split('.').filter(Boolean)
    if (segments.length === 0) continue
    // Convert all segments to kebab-case
    const kebabSegments = segments.map(toKebab)
    const fullHelperName = kebabSegments.join('/')
    // Compute accurate range for just the helper name (last segment)
    const helper = segments[segments.length - 1]
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
