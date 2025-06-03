const lsp = require('vscode-languageserver/node')

module.exports = function validateViewExist(document, typeMap) {
  const diagnostics = []

  // Only check routes.js and actions (api/controllers)
  const isRoutes = document.uri.endsWith('routes.js')
  const isAction = document.uri.includes('/api/controllers/')
  if (!isRoutes && !isAction) return diagnostics

  // Extract { view: '...' } in routes.js
  if (isRoutes) {
    const views = extractViewReferences(document)
    for (const { view, range } of views) {
      if (!typeMap.views?.[view]) {
        diagnostics.push(
          lsp.Diagnostic.create(
            range,
            `View '${view}' not found. Make sure it exists in your /views directory.`,
            lsp.DiagnosticSeverity.Error,
            'sails-lsp'
          )
        )
      }
    }
  }

  // Extract viewTemplatePath: '...' in actions
  if (isAction) {
    const exits = extractViewTemplatePathReferences(document)
    for (const { view, range } of exits) {
      if (!typeMap.views?.[view]) {
        diagnostics.push(
          lsp.Diagnostic.create(
            range,
            `View '${view}' not found. Make sure it exists in your /views directory.`,
            lsp.DiagnosticSeverity.Error,
            'sails-lsp'
          )
        )
      }
    }
  }

  return diagnostics
}

function extractViewReferences(document) {
  const text = document.getText()
  const regex = /view\s*:\s*['"]([^'"]+)['"]/g
  const views = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const view = match[1]
    const viewStart = match.index + match[0].indexOf(view)
    const viewEnd = viewStart + view.length
    views.push({
      view,
      range: lsp.Range.create(
        document.positionAt(viewStart),
        document.positionAt(viewEnd)
      )
    })
  }
  return views
}

function extractViewTemplatePathReferences(document) {
  const text = document.getText()
  const regex = /viewTemplatePath\s*:\s*['"]([^'"]+)['"]/g
  const views = []
  let match
  while ((match = regex.exec(text)) !== null) {
    const view = match[1]
    const viewStart = match.index + match[0].indexOf(view)
    const viewEnd = viewStart + view.length
    views.push({
      view,
      range: lsp.Range.create(
        document.positionAt(viewStart),
        document.positionAt(viewEnd)
      )
    })
  }
  return views
}
