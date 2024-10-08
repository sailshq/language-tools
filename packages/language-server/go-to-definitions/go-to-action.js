const lsp = require('vscode-languageserver/node')
const path = require('path')
const findFnLine = require('../helpers/find-fn-line')

module.exports = async function goToAction(document, position) {
  const fileName = path.basename(document.uri)

  if (fileName !== 'routes.js') {
    return null
  }
  const actionInfo = extractActionInfo(document, position)

  if (!actionInfo) {
    return null
  }

  const projectRoot = path.dirname(path.dirname(document.uri))

  const fullActionPath = resolveActionPath(projectRoot, actionInfo.action)

  if (fullActionPath) {
    const fnLineNumber = await findFnLine(fullActionPath)
    return lsp.Location.create(
      fullActionPath,
      lsp.Range.create(fnLineNumber, 0, fnLineNumber, 0)
    )
  }

  return null
}

function extractActionInfo(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // This regex matches both object and string notations
  const regex = /(['"])(.+?)\1:\s*(?:{?\s*action\s*:\s*)?(['"])(.+?)\3/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, , route, , action] = match
    const start = match.index
    const end = start + fullMatch.length

    // Check if the cursor is anywhere within the entire match
    if (start <= offset && offset <= end) {
      // Find the start and end positions of the action part
      const actionStart = text.indexOf(action, start)
      const actionEnd = actionStart + action.length

      return {
        action,
        range: lsp.Range.create(
          document.positionAt(actionStart),
          document.positionAt(actionEnd)
        )
      }
    }
  }

  return null
}

function resolveActionPath(projectRoot, actionPath) {
  return path.join(projectRoot, 'api', 'controllers', `${actionPath}.js`)
}
