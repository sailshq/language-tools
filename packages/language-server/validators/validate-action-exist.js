const lsp = require('vscode-languageserver/node')

module.exports = function validateActionExist(document, typeMap) {
  const diagnostics = []

  if (!document.uri.endsWith('routes.js')) return diagnostics
  const actions = extractActionInfo(document)

  for (const { action, range } of actions) {
    if (isUrlOrRedirect(action)) continue
    const routeExists = Object.values(typeMap.routes || {}).some(
      (route) => route.action?.name === action
    )

    if (!routeExists) {
      diagnostics.push(
        lsp.Diagnostic.create(
          range,
          `'${action}' action does not exist. Please check the name or create it.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
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
