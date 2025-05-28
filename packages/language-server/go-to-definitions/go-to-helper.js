const lsp = require('vscode-languageserver/node')

function toKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

module.exports = async function goToHelper(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // 1) Capture the helper chain AND optionally .with, .with(), or .with({ ... })
  //    match[1] = ".foo.bar"  (your segments)
  //    match[0] = entire "sails.helpers.foo.bar", "sails.helpers.foo.bar.with", "sails.helpers.foo.bar.with()", or "sails.helpers.foo.bar.with({ ... })"
  const regex =
    /\bsails\.helpers((?:\.[A-Za-z0-9_]+)+)(?:\.with\s*\((?:[^)]*)\))?/g

  let match
  while ((match = regex.exec(text)) !== null) {
    const segments = match[1].slice(1).split('.') // drop the leading dot
    if (!segments.length) continue

    // Build your kebab path
    const fullHelperName = segments.map(toKebab).join('/')

    // Locate the *start* of the helper name itself in the string
    const lastSeg = segments[segments.length - 1]
    const helperStart = match.index + match[0].lastIndexOf(lastSeg)
    const helperEnd = helperStart + lastSeg.length

    // 2) Broaden the cursor check to anywhere inside match[0]:
    const matchEnd = match.index + match[0].length
    if (offset < match.index || offset > matchEnd) {
      continue
    }

    // Now look up in your typeMap
    const info = typeMap.helpers?.[fullHelperName]
    if (info?.path) {
      const uri = `file://${info.path}`
      return lsp.LocationLink.create(
        uri,
        // targetSelection  = where to go in the helper file
        lsp.Range.create(info.fnLine - 1, 0, info.fnLine - 1, 0),
        // originSelection  = same as above, but not critical here
        lsp.Range.create(info.fnLine - 1, 0, info.fnLine - 1, 0),
        // this is the range in *this* document that gets underlined as a link
        lsp.Range.create(
          document.positionAt(helperStart),
          document.positionAt(helperEnd)
        )
      )
    }
  }

  return null
}
