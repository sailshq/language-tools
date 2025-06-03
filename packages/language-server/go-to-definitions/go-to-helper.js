const lsp = require('vscode-languageserver/node')

function toKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

module.exports = async function goToHelper(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // Regex to match sails.helpers.foo.bar (even if chained, e.g. .with, .with(), .with({}), etc.)
  // This is similar to go-to-model: match the helper path, then allow any chain after
  const regex = /\bsails\.helpers((?:\.[A-Za-z0-9_]+)+)/g

  let match
  while ((match = regex.exec(text)) !== null) {
    const segments = match[1].slice(1).split('.') // drop the leading dot
    if (!segments.length) continue

    // Only use the last segment before .with as the helper name
    let cleanSegments = segments
    if (segments[segments.length - 1] === 'with') {
      cleanSegments = segments.slice(0, -1)
    }
    const fullHelperName = cleanSegments.map(toKebab).join('/')
    const lastSeg = cleanSegments[cleanSegments.length - 1]
    const helperStart = match.index + match[0].lastIndexOf(lastSeg)
    const helperEnd = helperStart + lastSeg.length

    // Allow go-to if the cursor is anywhere inside the helper name
    if (offset < helperStart || offset > helperEnd) {
      continue
    }

    // Now look up in your typeMap
    const info = typeMap.helpers?.[fullHelperName]
    if (info?.path) {
      const uri = `file://${info.path}`
      return lsp.LocationLink.create(
        uri,
        lsp.Range.create(info.fnLine - 1, 0, info.fnLine - 1, 0),
        lsp.Range.create(info.fnLine - 1, 0, info.fnLine - 1, 0),
        lsp.Range.create(
          document.positionAt(helperStart),
          document.positionAt(helperEnd)
        )
      )
    }
  }

  return null
}
