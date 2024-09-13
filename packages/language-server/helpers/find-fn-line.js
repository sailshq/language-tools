const fs = require('fs').promises
const url = require('url')

module.exports = async function findFnLine(filePath) {
  try {
    const resolvedPath = filePath.startsWith('file:')
      ? url.fileURLToPath(filePath)
      : filePath

    const content = await fs.readFile(resolvedPath, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('fn:')) {
        return i // Return the line number (0-based index)
      }
    }
    return 0 // If 'fn:' is not found, return the first line
  } catch (error) {
    return 0 // Return the first line if there's an error
  }
}
