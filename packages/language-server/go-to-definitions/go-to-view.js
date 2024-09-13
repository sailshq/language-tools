const lsp = require('vscode-languageserver/node')
const path = require('path')
const fs = require('fs').promises

const findProjectRoot = require('../helpers/find-project-root')

module.exports = async function goToView(document, position) {
  const viewInfo = extractViewInfo(document, position)

  if (!viewInfo) {
    return null
  }

  const projectRoot = await findProjectRoot(document.uri)

  const fullViewPath = resolveViewPath(projectRoot, viewInfo.view)

  try {
    await fs.access(fullViewPath)
    return lsp.Location.create(fullViewPath, lsp.Range.create(0, 0, 0, 0))
  } catch (error) {
    return null
  }
}

function resolveViewPath(projectRoot, viewPath) {
  return path.join(projectRoot, 'views', `${viewPath}.ejs`)
}

function extractViewInfo(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // This regex matches both object notation for views and viewTemplatePath
  const regex =
    /(?:(['"])(.+?)\1\s*:\s*{\s*view\s*:\s*(['"])(.+?)\3\s*}|viewTemplatePath\s*:\s*(['"])(.+?)\5)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, , , , viewInObject, , viewInController] = match
    const view = viewInObject || viewInController
    const start = match.index
    const end = start + fullMatch.length

    // Check if the cursor is anywhere within the entire match
    if (start <= offset && offset <= end) {
      // Find the start and end positions of the view part, including quotes
      const viewStartWithQuote = text.lastIndexOf(
        "'",
        text.indexOf(view, start)
      ) // Find the opening quote
      const viewEndWithQuote =
        text.indexOf("'", text.indexOf(view, start) + view.length) + 1 // Find the closing quote and include it

      return {
        view,
        range: lsp.Range.create(
          document.positionAt(viewStartWithQuote),
          document.positionAt(viewEndWithQuote)
        )
      }
    }
  }

  return null
}

function resolveViewPath(projectRoot, viewPath) {
  return path.join(projectRoot, 'views', `${viewPath}.ejs`)
}
