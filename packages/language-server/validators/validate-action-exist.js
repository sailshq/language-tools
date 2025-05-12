const lsp = require('vscode-languageserver/node')

module.exports = function validateActionExist(document, cachedTypeMap) {
  const diagnostics = []

  if (!document.uri.endsWith('routes.js')) return diagnostics
  const actions = extractActionInfo(document)

  for (const { action, range } of actions) {
    if (isUrlOrRedirect(action)) continue
    const routeExists = Object.values(cachedTypeMap.routes || {}).some(
      (route) => route.action?.name === action
    )

    if (!routeExists) {
      diagnostics.push({
        severity: 1,
        range,
        message: `Action '${action}' not found. Please check the name or create it.`,
        source: 'Sails Validator'
      })
    }
  }
  return diagnostics
}

function extractActionInfo(document) {
  const text = document.getText()
  const regex = /(['"])(.+?)\1\s*:\s*(?:{?\s*action\s*:\s*)?(['"])(.+?)\3/g
  const actions = []
  let match

  while ((match = regex.exec(text)) !== null) {
    const action = match[4]
    const actionStart = match.index + match[0].lastIndexOf(action)
    const actionEnd = actionStart + action.length

    actions.push({
      action,
      range: lsp.Range.create(
        document.positionAt(actionStart),
        document.positionAt(actionEnd)
      )
    })
  }

  return actions
}

function isUrlOrRedirect(action) {
  return (
    action.startsWith('http://') ||
    action.startsWith('https://') ||
    action.startsWith('/')
  )
}
