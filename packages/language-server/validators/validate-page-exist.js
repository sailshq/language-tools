const lsp = require('vscode-languageserver/node')

module.exports = function validatePageExist(document, typeMap) {
  const diagnostics = []

  const pages = extractPageReferences(document)
  for (const { page, range } of pages) {
    if (!typeMap.pages?.[page]) {
      diagnostics.push(
        lsp.Diagnostic.create(
          range,
          `Inertia page '${page}' not found. Make sure it exists under your /assets/js/pages directory.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }
  return diagnostics
}

function extractPageReferences(document) {
  const text = document.getText()
  const regex = /\bpage\s*:\s*['"]([^'"]+)['"]/g
  const pages = []

  let match
  while ((match = regex.exec(text)) !== null) {
    const page = match[1]
    const pageStart = match.index + match[0].indexOf(page)
    const pageEnd = pageStart + page.length

    pages.push({
      page,
      range: lsp.Range.create(
        document.positionAt(pageStart),
        document.positionAt(pageEnd)
      )
    })
  }
  return pages
}
