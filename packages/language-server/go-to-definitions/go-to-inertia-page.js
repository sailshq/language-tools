const lsp = require('vscode-languageserver/node')
const path = require('path')
const fs = require('fs').promises
const findProjectRoot = require('../helpers/find-project-root')

module.exports = async function goToInertiaPage(document, position) {
  const pageInfo = extractPageInfo(document, position)

  if (!pageInfo) {
    return null
  }

  const projectRoot = await findProjectRoot(document.uri)
  const possibleExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'] // Add or remove extensions as needed

  for (const ext of possibleExtensions) {
    const fullPagePath = path.join(
      projectRoot,
      'assets',
      'js',
      'pages',
      `${pageInfo.page}${ext}`
    )
    try {
      await fs.access(fullPagePath)
      return lsp.Location.create(fullPagePath, lsp.Range.create(0, 0, 0, 0))
    } catch (error) {
      // File doesn't exist with this extension, try the next one
    }
  }

  return null
}

function extractPageInfo(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // Regular expression to match { page: 'example' } or { page: "example" }
  const regex = /{\s*page\s*:\s*['"]([^'"]+)['"]\s*}/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length

    if (start <= offset && offset <= end) {
      return { page: match[1] }
    }
  }

  return null
}
