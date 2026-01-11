const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = function validateActionExist(document, typeMap) {
  const diagnostics = []

  if (!document.uri.endsWith('config/routes.js')) return diagnostics

  const actions = extractActionInfo(document)

  for (const { action, range } of actions) {
    if (isUrlOrRedirect(action)) continue

    // Find any route entry that references this action and check if it exists
    const routeEntry = Object.values(typeMap.routes || {}).find(
      (route) => route.action?.name === action
    )

    // Action exists if we found a route entry with exists: true
    // If no route entry found, the action was just added and typeMap is stale,
    // so we need to check exists flag which was set when typeMap was built
    if (routeEntry && routeEntry.action?.exists === false) {
      const diagnostic = lsp.Diagnostic.create(
        range,
        `'${action}' action does not exist. Please check the name or create it.`,
        lsp.DiagnosticSeverity.Error,
        'action-not-found'
      )
      diagnostic.data = { actionName: action }
      diagnostics.push(diagnostic)
    }
  }
  return diagnostics
}

function extractActionInfo(document) {
  const text = document.getText()
  const actions = []

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    walk.simple(ast, {
      Property(node) {
        const propertyKey = node.key?.value || node.key?.name

        if (
          propertyKey === 'action' &&
          node.value?.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const actionName = node.value.value
          actions.push({
            action: actionName,
            range: lsp.Range.create(
              document.positionAt(node.value.start),
              document.positionAt(node.value.end)
            )
          })
        } else if (
          typeof propertyKey === 'string' &&
          (propertyKey.includes('GET') ||
            propertyKey.includes('POST') ||
            propertyKey.includes('PUT') ||
            propertyKey.includes('PATCH') ||
            propertyKey.includes('DELETE') ||
            propertyKey.includes('/')) &&
          node.value?.type === 'Literal' &&
          typeof node.value.value === 'string'
        ) {
          const actionName = node.value.value
          if (
            !actionName.startsWith('/') &&
            !actionName.startsWith('http://') &&
            !actionName.startsWith('https://')
          ) {
            actions.push({
              action: actionName,
              range: lsp.Range.create(
                document.positionAt(node.value.start),
                document.positionAt(node.value.end)
              )
            })
          }
        }
      }
    })
  } catch (error) {}

  return actions
}

function isUrlOrRedirect(action) {
  return (
    action.startsWith('http://') ||
    action.startsWith('https://') ||
    action.startsWith('/')
  )
}
