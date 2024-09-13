const lsp = require('vscode-languageserver/node')
const path = require('path')
const fs = require('fs')
const url = require('url')
module.exports = function validateActionExist(document) {
  const diagnostics = []

  if (!document.uri.endsWith('routes.js')) {
    return diagnostics // Return empty diagnostics if not routes.js
  }
  const actionInfo = extractActionInfo(document)

  if (!actionInfo) {
    return diagnostics
  }

  const projectRoot = path.dirname(path.dirname(document.uri))
  const actions = extractActionInfo(document) // Get all actions

  for (const { action, range } of actions) {
    if (isUrlOrRedirect(action)) {
      continue
    }

    const fullActionPath = resolveActionPath(projectRoot, action)
    if (!fs.existsSync(url.fileURLToPath(fullActionPath))) {
      const diagnostic = {
        severity: lsp.DiagnosticSeverity.Error,
        range,
        message: `Action '${action}' does not exist. Please check the controller file.`,
        source: 'Sails Validator'
      }
      diagnostics.push(diagnostic)
    }
  }

  return diagnostics
}

function extractActionInfo(document) {
  const text = document.getText()

  // This regex matches both object and string notations
  const regex = /(['"])(.+?)\1:\s*(?:{?\s*action\s*:\s*)?(['"])(.+?)\3/g
  let match
  const actions = []

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, , route, , action] = match

    // Store the action and its range
    const actionStart = match.index + fullMatch.indexOf(action)
    const actionEnd = actionStart + action.length

    actions.push({
      action,
      range: lsp.Range.create(
        document.positionAt(actionStart),
        document.positionAt(actionEnd)
      )
    })
  }

  return actions // Return an array of actions
}

function resolveActionPath(projectRoot, actionPath) {
  return path.join(projectRoot, 'api', 'controllers', `${actionPath}.js`)
}

function isUrlOrRedirect(action) {
  if (action.startsWith('http://') || action.startsWith('https://')) {
    return true
  }

  if (action.startsWith('/')) {
    return true
  }

  return false
}
