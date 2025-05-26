const lsp = require('vscode-languageserver/node')

module.exports = async function goToModel(document, position, typeMap) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  const regex =
    /\b(?:(?<classModel>[A-Z][a-zA-Z0-9_]*)|sails\.models\.(?<dotModel>[a-z][a-zA-Z0-9_]*))\s*\.\s*\w*/g

  let match
  while ((match = regex.exec(text)) !== null) {
    const modelNameRaw = match.groups.classModel || match.groups.dotModel
    const modelName =
      match.groups.classModel ||
      (match.groups.dotModel &&
        match.groups.dotModel.charAt(0).toUpperCase() +
          match.groups.dotModel.slice(1))

    if (!modelName) continue

    const start = match.index + match[0].indexOf(modelNameRaw)
    const end = start + modelNameRaw.length

    if (offset >= start && offset <= end) {
      const model = typeMap.models?.[modelName]
      if (!model?.path) return null

      const uri = `file://${model.path}`
      return lsp.LocationLink.create(
        uri,
        lsp.Range.create(0, 0, 0, 0), // target range (usually top of file)
        lsp.Range.create(0, 0, 0, 0), // target selection range
        lsp.Range.create(document.positionAt(start), document.positionAt(end)) // origin range
      )
    }
  }

  return null
}
