const fs = require('fs').promises
const path = require('path')
const acorn = require('acorn')
const walk = require('acorn-walk')

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

    const STATIC_METHODS = [
      { name: 'find', description: 'Retrieve all records matching criteria.' },
      {
        name: 'findOne',
        description: 'Retrieve a single record matching criteria.'
      },
      { name: 'create', description: 'Create a new record.' },
      {
        name: 'createEach',
        description: 'Create multiple new records in a batch.'
      },
      { name: 'update', description: 'Update records matching criteria.' },
      { name: 'destroy', description: 'Delete records matching criteria.' },
      { name: 'count', description: 'Count records matching criteria.' },
      {
        name: 'replaceCollection',
        description: 'Replace all items in a collection association.'
      },
      {
        name: 'addToCollection',
        description: 'Add items to a collection association.'
      },
      {
        name: 'removeFromCollection',
        description: 'Remove items from a collection association.'
      },
      {
        name: 'findOrCreate',
        description: 'Find a record or create it if it does not exist.'
      },
      {
        name: 'findOrCreateEach',
        description: 'Find or create multiple records in a batch.'
      }
    ]

    const CHAINABLE_METHODS = [
      { name: 'where', description: 'Filter records by criteria.' },
      { name: 'limit', description: 'Limit the number of records returned.' },
      {
        name: 'skip',
        description: 'Skip a number of records (for pagination).'
      },
      { name: 'sort', description: 'Sort records by specified attributes.' },
      { name: 'populate', description: 'Populate associated records.' },
      {
        name: 'select',
        description: 'Select only specific attributes to return.'
      },
      {
        name: 'omit',
        description: 'Omit specific attributes from the result.'
      },
      { name: 'meta', description: 'Pass additional options to the query.' },
      {
        name: 'decrypt',
        description: 'Decrypt encrypted attributes in the result.'
      }
    ]
    const context = this
    if (!(await this.#directoryExists(dir))) return models

    const files = await fs.readdir(dir)

    // Retrieve attributes from config/models.js
    let defaultAttributes = {}
    const modelsConfigPath = path.join(this.rootDir, 'config', 'models.js')
    if (await this.#fileExists(modelsConfigPath)) {
      try {
        const configCode = await fs.readFile(modelsConfigPath, 'utf8')
        const configAST = acorn.parse(configCode, {
          ecmaVersion: 'latest',
          sourceType: 'module'
        })

        walk.simple(configAST, {
          AssignmentExpression(node) {
            // Support: module.exports = { attributes: ... } and { models: { attributes: ... } }
            if (
              node.left.type === 'MemberExpression' &&
              node.left.object.name === 'module' &&
              node.left.property.name === 'exports' &&
              node.right.type === 'ObjectExpression'
            ) {
              for (const prop of node.right.properties) {
                if (
                  prop.key?.name === 'attributes' &&
                  prop.value?.type === 'ObjectExpression'
                ) {
                  defaultAttributes = context.#extractObjectLiteral(prop.value)
                }
                if (
                  prop.key?.name === 'models' &&
                  prop.value?.type === 'ObjectExpression'
                ) {
                  for (const inner of prop.value.properties) {
                    if (
                      inner.key?.name === 'attributes' &&
                      inner.value?.type === 'ObjectExpression'
                    ) {
                      defaultAttributes = context.#extractObjectLiteral(
                        inner.value
                      )
                    }
                  }
                }
              }
            }
            // Support: module.exports.models = { attributes: ... }
            if (
              node.left.type === 'MemberExpression' &&
              node.left.object.type === 'MemberExpression' &&
              node.left.object.object.name === 'module' &&
              node.left.object.property.name === 'exports' &&
              node.left.property.name === 'models' &&
              node.right.type === 'ObjectExpression'
            ) {
              for (const prop of node.right.properties) {
                if (
                  prop.key?.name === 'attributes' &&
                  prop.value?.type === 'ObjectExpression'
                ) {
                  defaultAttributes = context.#extractObjectLiteral(prop.value)
                }
              }
            }
          }
        })
      } catch (err) {
        console.error('Error parsing config/models.js', err)
      }
    }

    for (const file of files) {
      if (!file.endsWith('.js')) continue

      const name = file.slice(0, -3)
      const modelPath = path.join(dir, file)
      let attributes = {}
      const context = this

      try {
        const code = await fs.readFile(modelPath, 'utf8')
        const ast = acorn.parse(code, {
          ecmaVersion: 'latest',
          sourceType: 'module'
        })

        walk.simple(ast, {
          AssignmentExpression(node) {
            // Handle: module.exports = { attributes: ... }
            if (
              node.left.type === 'MemberExpression' &&
              node.left.object.name === 'module' &&
              node.left.property.name === 'exports' &&
              node.right.type === 'ObjectExpression'
            ) {
              for (const prop of node.right.properties) {
                if (
                  prop.key?.name === 'attributes' &&
                  prop.value?.type === 'ObjectExpression'
                ) {
                  attributes = context.#extractObjectLiteral(prop.value)
                }
              }
            }
            // Legacy: module.exports.attributes = { ... }
            else if (
              node.left.type === 'MemberExpression' &&
              node.left.object.type === 'MemberExpression' &&
              node.left.object.object.name === 'module' &&
              node.left.object.property.name === 'exports' &&
              node.left.property.name === 'attributes' &&
              node.right.type === 'ObjectExpression'
            ) {
              attributes = context.#extractObjectLiteral(node.right)
            }
          },
          ExportDefaultDeclaration(node) {
            if (node.declaration.type === 'ObjectExpression') {
              for (const prop of node.declaration.properties) {
                if (
                  prop.key?.name === 'attributes' &&
                  prop.value?.type === 'ObjectExpression'
                ) {
                  attributes = context.#extractObjectLiteral(prop.value)
                }
              }
            }
          }
        })
      } catch (err) {
        console.error(`Error parsing model: ${file}`, err)
        continue
      }

      // Merge defaultAttributes first, then model attributes (model overrides default)
      const mergedAttributes = {}
      for (const key of Object.keys(defaultAttributes)) {
        mergedAttributes[key] = defaultAttributes[key]
      }
      for (const key of Object.keys(attributes)) {
        mergedAttributes[key] = attributes[key]
      }
      models[name] = {
        path: modelPath,
        methods: STATIC_METHODS,
        chainableMethods: CHAINABLE_METHODS,
        attributes: mergedAttributes
      }
    }

    return models
  }

  async #fileExists(filePath) {
    try {
      const stat = await fs.stat(filePath)
      return stat.isFile()
    } catch {
      return false
    }
  }
  async #parseViews() {
    const dir = path.join(this.rootDir, 'views')
    const views = {}

    if (await this.#directoryExists(dir)) {
      const collect = async (base, rel = '') => {
        const entries = await fs.readdir(base, { withFileTypes: true })
        for (const entry of entries) {
          const relPath = path.join(rel, entry.name)
          const fullPath = path.join(base, entry.name)
          if (entry.isDirectory()) {
            await collect(fullPath, relPath)
          } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
            const viewKey = relPath.replace(/\.ejs$/, '').replace(/\\/g, '/')
            views[viewKey] = {
              path: fullPath
            }
          }
        }
      }
      await collect(dir)
    }

    return views
  }

  async #parsePages() {
    const dir = path.join(this.rootDir, 'assets', 'js', 'pages')
    const pages = {}

    if (await this.#directoryExists(dir)) {
      const collect = async (base, rel = '') => {
        const entries = await fs.readdir(base, { withFileTypes: true })
        for (const entry of entries) {
          const relPath = path.join(rel, entry.name)
          const fullPath = path.join(base, entry.name)
          if (entry.isDirectory()) {
            await collect(fullPath, relPath)
          } else if (
            entry.isFile() &&
            /\.(vue|js|ts|jsx|tsx|svelte|html)$/.test(entry.name)
          ) {
            const pageKey = relPath
              .replace(/\.(vue|js|ts|jsx|tsx|svelte|html)$/, '')
              .replace(/\\/g, '/')
            pages[pageKey] = { path: fullPath }
          }
        }
      }
      await collect(dir)
    }

    return pages
  }
  async #parsePolicies() {
    const dir = path.join(this.rootDir, 'api', 'policies')
    const policies = {}

    if (await this.#directoryExists(dir)) {
      const files = await fs.readdir(dir)
      for (const file of files) {
        if (file.endsWith('.js')) {
          const name = file.replace(/\.js$/, '')
          const fullPath = path.join(dir, file)
          policies[name] = { path: fullPath }
        }
      }
    }

    return policies
  }

  async #parseHelpers() {
    const dir = path.join(this.rootDir, 'api', 'helpers')
    const helpers = {}
    if (await this.#directoryExists(dir)) {
      const collect = async (base, rel = '') => {
        const entries = await fs.readdir(base, { withFileTypes: true })
        for (const entry of entries) {
          const relPath = path.join(rel, entry.name)
          const fullPath = path.join(base, entry.name)
          if (entry.isDirectory()) {
            await collect(fullPath, relPath)
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const name = relPath.replace(/\.js$/, '').replace(/\\/g, '/')
            const content = await this.#readFile(fullPath)
            // Find the line number of the `fn` function
            let fnLine = 0
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (/fn\s*:\s*(async\s*)?function/.test(lines[i])) {
                fnLine = i + 1
                break
              }
            }
            // Extract inputs using acorn
            let inputs = {}
            try {
              const ast = acorn.parse(content, {
                ecmaVersion: 'latest',
                sourceType: 'module'
              })
              walk.simple(ast, {
                Property(node) {
                  if (
                    node.key &&
                    node.key.name === 'inputs' &&
                    node.value.type === 'ObjectExpression'
                  ) {
                    inputs = context.#extractObjectLiteral(node.value)
                  }
                }
              })
            } catch (e) {}
            helpers[name] = { path: fullPath, fnLine, inputs }
          }
        }
      }
      await collect(dir)
    }
    return helpers
  }

  #extractObjectLiteral(node) {
    if (node.type !== 'ObjectExpression') return undefined
    const obj = {}
    for (const prop of node.properties) {
      if (prop.type === 'Property') {
        const key =
          prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
        let value
        if (prop.value.type === 'ObjectExpression') {
          value = this.#extractObjectLiteral(prop.value)
        } else if (prop.value.type === 'ArrayExpression') {
          value = prop.value.elements.map((el) =>
            el.type === 'ObjectExpression'
              ? this.#extractObjectLiteral(el)
              : el.type === 'Literal'
                ? el.value
                : el.type === 'Identifier'
                  ? el.name
                  : undefined
          )
        } else if (prop.value.type === 'Literal') {
          value = prop.value.value
        } else if (prop.value.type === 'Identifier') {
          value = prop.value.name
        } else {
          value = undefined
        }
        obj[key] = value
      }
    }
    return obj
  }
  #getDataTypes() {
    return [
      {
        type: 'string',
        description: 'Any string.'
      },
      { type: 'number', description: 'Any number.' },
      { type: 'boolean', description: 'True or false.' },
      {
        type: 'json',
        description:
          'Any JSON-serializable value, including numbers, booleans, strings, arrays, dictionaries (plain JavaScript objects), and null.'
      },
      { type: 'ref', description: 'Any JavaScript value except undefined' }
    ]
  }
  #getSharedAttributeProperties() {
    return [
      { label: 'type', detail: 'Data type of the attribute/input' },
      { label: 'required', detail: 'If true, this field is mandatory' },
      { label: 'defaultsTo', detail: 'Default value if not provided' },
      { label: 'allowNull', detail: 'Allow null values' },
      { label: 'description', detail: 'Description for documentation' },
      {
        label: 'extendedDescription',
        detail: 'Longer, more detailed description for documentation'
      },
      { label: 'example', detail: 'Example value' },
      { label: 'isIn', detail: 'Enum of allowed values' }
    ]
  }
  #getModelProperties() {
    return [
      { label: 'columnName', detail: 'Custom database column name' },
      { label: 'unique', detail: 'Must be unique across records' },
      { label: 'autoIncrement', detail: 'Auto-increment this field' },
      { label: 'primaryKey', detail: 'Marks as primary key' },
      { label: 'model', detail: 'Reference to another model' },
      { label: 'collection', detail: 'Association with other records' },
      { label: 'via', detail: 'Used for collection associations' },
      { label: 'dominant', detail: 'Used in many-to-many relationships' }
    ]
  }
  #getModelAttributeProperties() {
    return [
      ...this.#getSharedAttributeProperties(),
      ...this.#getModelProperties()
    ]
  }

  #getInputProperties() {
    return this.#getSharedAttributeProperties()
  }
  async buildTypeMap() {
    const [routes, models, views, pages, policies, helpers] = await Promise.all(
      [
        this.#parseRoutesWithActions(),
        this.#parseModels(),
        this.#parseViews(),
        this.#parsePages(),
        this.#parsePolicies(),
        this.#parseHelpers()
      ]
    )

    return {
      routes,
      models,
      views,
      pages,
      policies,
      helpers,
      dataTypes: this.#getDataTypes(),
      modelAttributeProps: this.#getModelAttributeProperties(),
      inputProps: this.#getInputProperties()
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
