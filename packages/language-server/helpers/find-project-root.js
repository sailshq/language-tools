const path = require('path')
const url = require('url')
const fs = require('fs').promises

module.exports = async function findProjectRoot(uri) {
  let currentPath = path.dirname(url.fileURLToPath(uri))
  const root = path.parse(currentPath).root

  while (currentPath !== root) {
    try {
      await fs.access(path.join(currentPath, 'package.json'))
      return currentPath
    } catch (error) {
      currentPath = path.dirname(currentPath)
    }
  }
  throw new Error('Could not find project root')
}
