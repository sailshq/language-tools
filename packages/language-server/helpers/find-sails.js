const path = require('path')
const fs = require('fs')
const findProjectRoot = require('./find-project-root')

module.exports = async function findSails(workspaceUri) {
  const projectRoot = await findProjectRoot(workspaceUri)
  const sailsPath = path.join(projectRoot, 'node_modules', 'sails')
  if (fs.existsSync(sailsPath)) {
    return { sailsPath, projectRoot }
  }
  throw new Error('Sails not found in node_modules')
}
