const fs = require('fs').promises
const path = require('path')

class SailsParser {
  constructor(rootDir) {
    this.rootDir = rootDir
  }

  setRootDir(rootDir) {
    this.rootDir = rootDir
  }

  async #readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      console.error(`Error reading file: ${filePath}`, error)
      return ''
    }
  }

  async #parseAction(filePath) {
    const content = await this.#readFile(filePath)
    const info = { inputs: {}, exits: {}, fnLine: 0 }

    // Extract inputs
    const inputsMatch = content.match(/inputs\s*:\s*\{([\s\S]*?)\}/)
    if (inputsMatch) {
      for (const inputMatch of inputsMatch[1].matchAll(
        /(\w+)\s*:\s*\{[^}]*type\s*:\s*['"](\w+)['"]/g
      )) {
        info.inputs[inputMatch[1]] = inputMatch[2]
      }
    }

    // Extract exits
    const exitsMatch = content.match(/exits\s*:\s*\{([\s\S]*?)\}/)
    if (exitsMatch) {
      for (const exitMatch of exitsMatch[1].matchAll(/(\w+)\s*:/g)) {
        info.exits[exitMatch[1]] = true
      }
    }

    // Find the line number of the `fn` function
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (/fn\s*:\s*(async\s*)?function/.test(lines[i])) {
        info.fnLine = i + 1
        break
      }
    }

    return info
  }

  async #parseRoutesWithActions() {
    const routesPath = path.join(this.rootDir, 'config', 'routes.js')
    const actionsRoot = path.join(this.rootDir, 'api', 'controllers')
    const content = await this.#readFile(routesPath)
    const routes = {}

    const regex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g
    let match
    while ((match = regex.exec(content))) {
      const route = match[1]
      const actionName = match[2]
      const filePath = path.join(actionsRoot, ...actionName.split('/')) + '.js'

      const actionInfo = await this.#parseAction(filePath)

      routes[route] = {
        action: {
          name: actionName,
          path: filePath,
          ...actionInfo
        }
      }
    }

    return routes
  }

  async #parseModels() {
    const dir = path.join(this.rootDir, 'api', 'models')
    const models = {}

    if (await this.#directoryExists(dir)) {
      try {
        const files = await fs.readdir(dir)
        for (const file of files) {
          if (!file.endsWith('.js')) continue
          const name = file.slice(0, -3)
          const info = { attributes: {} }
          const content = await this.#readFile(path.join(dir, file))
          const attrMatch = content.match(/attributes\s*:\s*\{([\s\S]*?)\}/)
          if (attrMatch) {
            for (const attr of attrMatch[1].matchAll(
              /(\w+)\s*:\s*\{[^}]*type\s*:\s*['"](\w+)['"]/g
            )) {
              info.attributes[attr[1]] = attr[2]
            }
          }
          models[name] = info
        }
      } catch (error) {
        console.error(`Error parsing models in directory: ${dir}`, error)
      }
    }
    return models
  }

  async buildTypeMap() {
    return {
      routes: await this.#parseRoutesWithActions(),
      models: await this.#parseModels()
    }
  }

  async #directoryExists(dirPath) {
    try {
      const stat = await fs.stat(dirPath)
      return stat.isDirectory()
    } catch {
      return false
    }
  }
}

module.exports = SailsParser
