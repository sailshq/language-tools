const lsp = require('vscode-languageserver/node')
const path = require('path')
const fs = require('fs').promises
const findProjectRoot = require('../helpers/find-project-root')
const findFnLine = require('../helpers/find-fn-line')

function camelToKebabCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function normalizeHelperPath(helperPath) {
  const parts = helperPath.split('/')
  const fileName = parts.pop() // Get the last part (file name)
  const normalizedFileName = camelToKebabCase(fileName)
  return [...parts, normalizedFileName].join('/')
}

module.exports = async function goToHelper(document, position) {
  const helperInfo = extractHelperInfo(document, position)

  if (!helperInfo) {
    return null
  }

  const projectRoot = await findProjectRoot(document.uri)
  const normalizedHelperPath = normalizeHelperPath(
    helperInfo.helperPath.join('/')
  )
  const fullHelperPath =
    path.join(projectRoot, 'api', 'helpers', normalizedHelperPath) + '.js'
  if (fullHelperPath) {
    const fnLineNumber = await findFnLine(fullHelperPath)
    return lsp.Location.create(
      fullHelperPath,
      lsp.Range.create(fnLineNumber, 0, fnLineNumber, 0)
    )
  }
}

function extractHelperInfo(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // Regular expression to match sails.helpers.exampleHelper() or sails.helpers.exampleHelper.with()
  // Also matches nested helpers like sails.helpers.mail.send() or sails.helpers.mail.send.with()
  const regex = /sails\.helpers\.([a-zA-Z0-9.]+)(?:\.with)?\s*\(/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length

    if (start <= offset && offset <= end) {
      const helperPath = match[1].split('.').filter((part) => part !== 'with')
      return { helperPath }
    }
  }

  return null
}
