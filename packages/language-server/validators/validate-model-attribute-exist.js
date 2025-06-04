const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

/**
 * Validate if a Waterline model attribute exists when used in criteria or chainable methods.
 * @param {TextDocument} document - The text document to validate.
 * @param {Object} typeMap - The type map containing models and their attributes.
 * @returns {Array} diagnostics - Array of LSP diagnostics.
 */
module.exports = function validateModelAttributeExist(document, typeMap) {
  const diagnostics = []
  const text = document.getText()

  // Build a lowercased model map for robust case-insensitive lookup
  const modelMap = {}
  if (typeMap.models) {
    for (const key of Object.keys(typeMap.models)) {
      modelMap[key.toLowerCase()] = typeMap.models[key]
    }
  }
  // Helper function to get model by name, case-insensitive
  function getModelByName(name) {
    if (!name) return undefined
    const upper = name.charAt(0).toUpperCase() + name.slice(1)
    return typeMap.models[upper]
  }

  // AST-based: Validate Model.create({ ... }) and similar
  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })
    walk.simple(ast, {
      CallExpression(node) {
        if (node.callee && node.callee.type === 'MemberExpression') {
          const method = node.callee.property.name
          // --- Robust model name extraction for ALL method calls (including chainable) ---
          let effectiveModelName = undefined
          let obj = node.callee.object
          while (obj) {
            if (obj.type === 'Identifier') {
              effectiveModelName = obj.name
              break
            } else if (
              obj.type === 'CallExpression' &&
              obj.callee &&
              obj.callee.type === 'MemberExpression'
            ) {
              obj = obj.callee.object
            } else {
              break
            }
          }
          const model = getModelByName(effectiveModelName)
          if (!model) return

          // Only validate chainable methods that are select, omit, sort, or populate
          const allowedChainable = ['select', 'omit', 'sort', 'populate']

          // --- Ignore validation for arguments to non-model chainable methods like .intercept ---
          // If the current method is NOT a model method or allowedChainable, skip validation for its arguments
          const modelMethods = [
            'create',
            'createEach',
            'count',
            'find',
            'findOne',
            'update',
            'destroy',
            'where',
            'findOrCreate',
            'sum',
            ...allowedChainable
          ]
          if (!modelMethods.includes(method)) {
            // This is a non-model method (e.g., intercept, using, etc.), skip validation for its arguments
            return
          }

          // handle createEach array of objects
          if (
            method === 'createEach' &&
            node.arguments[0] &&
            node.arguments[0].type === 'ArrayExpression'
          ) {
            for (const el of node.arguments[0].elements) {
              if (!el || el.type !== 'ObjectExpression') continue
              for (const prop of el.properties) {
                const attribute = prop.key && (prop.key.name || prop.key.value)
                if (
                  !model.attributes ||
                  !Object.prototype.hasOwnProperty.call(
                    model.attributes,
                    attribute
                  )
                ) {
                  diagnostics.push(
                    lsp.Diagnostic.create(
                      lsp.Range.create(
                        document.positionAt(prop.key.start),
                        document.positionAt(prop.key.end)
                      ),
                      `'${attribute}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                      lsp.DiagnosticSeverity.Error,
                      'sails-lsp'
                    )
                  )
                }
              }
            }
            return
          }

          // Validate attributes in chained .where({ ... }) calls
          if (
            method === 'where' &&
            node.arguments[0] &&
            node.arguments[0].type === 'ObjectExpression'
          ) {
            for (const prop of node.arguments[0].properties) {
              if (!prop.key) continue
              const whereAttr = prop.key.name || prop.key.value
              if (
                !model.attributes ||
                !Object.prototype.hasOwnProperty.call(
                  model.attributes,
                  whereAttr
                )
              ) {
                diagnostics.push(
                  lsp.Diagnostic.create(
                    lsp.Range.create(
                      document.positionAt(prop.key.start),
                      document.positionAt(prop.key.end)
                    ),
                    `'${whereAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                    lsp.DiagnosticSeverity.Error,
                    'sails-lsp'
                  )
                )
              }
            }
            return
          }

          // --- Unified validation for .select([]), .omit([]), .sort([]), .populate([]) chainable calls only ---
          if (
            allowedChainable.includes(method) &&
            node.arguments[0] &&
            node.arguments[0].type === 'ArrayExpression'
          ) {
            for (const el of node.arguments[0].elements) {
              if (!el) continue
              let arrAttr = undefined
              if (el.type === 'Literal' || el.type === 'StringLiteral') {
                arrAttr = el.value
              } else if (
                el.type === 'TemplateLiteral' &&
                el.expressions.length === 0
              ) {
                arrAttr = el.quasis[0].value.cooked
              } else if (el.type === 'ObjectExpression' && method === 'sort') {
                // For sort([{ foo: 1 }])
                for (const sortProp of el.properties) {
                  if (!sortProp.key) continue
                  const sortAttr = sortProp.key.name || sortProp.key.value
                  if (
                    !model.attributes ||
                    !Object.prototype.hasOwnProperty.call(
                      model.attributes,
                      sortAttr
                    )
                  ) {
                    diagnostics.push(
                      lsp.Diagnostic.create(
                        lsp.Range.create(
                          document.positionAt(sortProp.key.start),
                          document.positionAt(sortProp.key.end)
                        ),
                        `'${sortAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                        lsp.DiagnosticSeverity.Error,
                        'sails-lsp'
                      )
                    )
                  }
                }
                continue
              }
              if (arrAttr !== undefined) {
                // For sort, allow 'foo ASC' or 'foo DESC'
                let checkAttr = arrAttr
                if (method === 'sort' && typeof arrAttr === 'string') {
                  checkAttr = arrAttr.split(' ')[0]
                }
                if (
                  !checkAttr ||
                  typeof checkAttr !== 'string' ||
                  checkAttr.trim() === ''
                ) {
                  diagnostics.push(
                    lsp.Diagnostic.create(
                      lsp.Range.create(
                        document.positionAt(el.start),
                        document.positionAt(el.end)
                      ),
                      `Empty or invalid attribute in .${method}() for model '${effectiveModelName}'.`,
                      lsp.DiagnosticSeverity.Error,
                      'sails-lsp'
                    )
                  )
                  continue
                }
                if (
                  !model.attributes ||
                  !Object.prototype.hasOwnProperty.call(
                    model.attributes,
                    checkAttr
                  )
                ) {
                  diagnostics.push(
                    lsp.Diagnostic.create(
                      lsp.Range.create(
                        document.positionAt(el.start),
                        document.positionAt(el.end)
                      ),
                      `'${checkAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                      lsp.DiagnosticSeverity.Error,
                      'sails-lsp'
                    )
                  )
                }
              }
            }
            // Do NOT return here; allow walker to continue to chained calls
          }

          // Validate attributes in .find({ ... }) and similar methods
          if (
            node.arguments[0] &&
            node.arguments[0].type === 'ObjectExpression'
          ) {
            // Only validate if this is a top-level model method call, not an argument to another method (e.g., intercept)
            // Check that the callee is a direct property of an Identifier (the model), not a nested CallExpression
            let isTopLevelModelCall = false
            let calleeObj = node.callee.object
            if (calleeObj && calleeObj.type === 'Identifier') {
              isTopLevelModelCall = true
            } else if (calleeObj && calleeObj.type === 'CallExpression') {
              // If the parent is a CallExpression, but the root is an Identifier, still allow
              let root = calleeObj
              while (
                root &&
                root.type === 'CallExpression' &&
                root.callee &&
                root.callee.type === 'MemberExpression'
              ) {
                root = root.callee.object
              }
              if (root && root.type === 'Identifier') {
                isTopLevelModelCall = true
              }
            }
            // If this is an argument to a non-model method (e.g., intercept), skip validation
            if (!isTopLevelModelCall) return
            for (const prop of node.arguments[0].properties) {
              const attribute = prop.key && (prop.key.name || prop.key.value)
              const queryOptionKeys = [
                'where',
                'select',
                'omit',
                'sort',
                'limit',
                'skip',
                'page',
                'populate',
                'groupBy',
                'having',
                'sum',
                'average',
                'min',
                'max',
                'distinct',
                'meta'
              ]
              // For non-create methods, validate all top-level keys except query option keys
              if (
                method !== 'create' &&
                method !== 'createEach' &&
                !queryOptionKeys.includes(attribute)
              ) {
                if (
                  !model.attributes ||
                  !Object.prototype.hasOwnProperty.call(
                    model.attributes,
                    attribute
                  )
                ) {
                  diagnostics.push(
                    lsp.Diagnostic.create(
                      lsp.Range.create(
                        document.positionAt(prop.key.start),
                        document.positionAt(prop.key.end)
                      ),
                      `'${attribute}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                      lsp.DiagnosticSeverity.Error,
                      'sails-lsp'
                    )
                  )
                }
                continue
              }
              if (
                method !== 'create' &&
                method !== 'createEach' &&
                queryOptionKeys.includes(attribute)
              ) {
                if (
                  attribute === 'where' &&
                  prop.value &&
                  prop.value.type === 'ObjectExpression'
                ) {
                  for (const whereProp of prop.value.properties) {
                    if (!whereProp.key) continue
                    const whereAttr = whereProp.key.name || whereProp.key.value
                    if (
                      !model.attributes ||
                      !Object.prototype.hasOwnProperty.call(
                        model.attributes,
                        whereAttr
                      )
                    ) {
                      diagnostics.push(
                        lsp.Diagnostic.create(
                          lsp.Range.create(
                            document.positionAt(whereProp.key.start),
                            document.positionAt(whereProp.key.end)
                          ),
                          `'${whereAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                          lsp.DiagnosticSeverity.Error,
                          'sails-lsp'
                        )
                      )
                    }
                  }
                  continue
                }
                if (
                  (attribute === 'select' || attribute === 'omit') &&
                  prop.value &&
                  prop.value.type === 'ArrayExpression'
                ) {
                  for (const el of prop.value.elements) {
                    if (!el) continue
                    if (el.type === 'Literal' || el.type === 'StringLiteral') {
                      const arrAttr = el.value
                      if (
                        !model.attributes ||
                        !Object.prototype.hasOwnProperty.call(
                          model.attributes,
                          arrAttr
                        )
                      ) {
                        diagnostics.push(
                          lsp.Diagnostic.create(
                            lsp.Range.create(
                              document.positionAt(el.start),
                              document.positionAt(el.end)
                            ),
                            `'${arrAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                            lsp.DiagnosticSeverity.Error,
                            'sails-lsp'
                          )
                        )
                      }
                    }
                  }
                  continue
                }
                if (attribute === 'sort' && prop.value) {
                  if (
                    prop.value.type === 'Literal' ||
                    prop.value.type === 'StringLiteral'
                  ) {
                    const sortStr = prop.value.value
                    const sortAttr = sortStr && sortStr.split(' ')[0]
                    if (
                      sortAttr &&
                      (!model.attributes ||
                        !Object.prototype.hasOwnProperty.call(
                          model.attributes,
                          sortAttr
                        ))
                    ) {
                      diagnostics.push(
                        lsp.Diagnostic.create(
                          lsp.Range.create(
                            document.positionAt(prop.value.start),
                            document.positionAt(prop.value.end)
                          ),
                          `'${sortAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                          lsp.DiagnosticSeverity.Error,
                          'sails-lsp'
                        )
                      )
                    }
                    continue
                  } else if (prop.value.type === 'ArrayExpression') {
                    for (const el of prop.value.elements) {
                      if (!el) continue
                      if (el.type === 'ObjectExpression') {
                        for (const sortProp of el.properties) {
                          if (!sortProp.key) continue
                          const sortAttr =
                            sortProp.key.name || sortProp.key.value
                          if (
                            !model.attributes ||
                            !Object.prototype.hasOwnProperty.call(
                              model.attributes,
                              sortAttr
                            )
                          ) {
                            diagnostics.push(
                              lsp.Diagnostic.create(
                                lsp.Range.create(
                                  document.positionAt(sortProp.key.start),
                                  document.positionAt(sortProp.key.end)
                                ),
                                `'${sortAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                                lsp.DiagnosticSeverity.Error,
                                'sails-lsp'
                              )
                            )
                          }
                        }
                      } else if (
                        el.type === 'Literal' ||
                        el.type === 'StringLiteral'
                      ) {
                        const sortStr = el.value
                        const sortAttr = sortStr && sortStr.split(' ')[0]
                        if (
                          sortAttr &&
                          (!model.attributes ||
                            !Object.prototype.hasOwnProperty.call(
                              model.attributes,
                              sortAttr
                            ))
                        ) {
                          diagnostics.push(
                            lsp.Diagnostic.create(
                              lsp.Range.create(
                                document.positionAt(el.start),
                                document.positionAt(el.end)
                              ),
                              `'${sortAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                              lsp.DiagnosticSeverity.Error,
                              'sails-lsp'
                            )
                          )
                        }
                      }
                    }
                    continue
                  } else if (prop.value.type === 'ObjectExpression') {
                    for (const sortProp of prop.value.properties) {
                      if (!sortProp.key) continue
                      const sortAttr = sortProp.key.name || sortProp.key.value
                      if (
                        !model.attributes ||
                        !Object.prototype.hasOwnProperty.call(
                          model.attributes,
                          sortAttr
                        )
                      ) {
                        diagnostics.push(
                          lsp.Diagnostic.create(
                            lsp.Range.create(
                              document.positionAt(sortProp.key.start),
                              document.positionAt(sortProp.key.end)
                            ),
                            `'${sortAttr}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                            lsp.DiagnosticSeverity.Error,
                            'sails-lsp'
                          )
                        )
                      }
                    }
                    continue
                  }
                }
                // For all other query option keys, skip validation
                continue
              }
              // Only validate top-level for create/createEach
              if (
                (method === 'create' || method === 'createEach') &&
                (!model.attributes ||
                  !Object.prototype.hasOwnProperty.call(
                    model.attributes,
                    attribute
                  ))
              ) {
                diagnostics.push(
                  lsp.Diagnostic.create(
                    lsp.Range.create(
                      document.positionAt(prop.key.start),
                      document.positionAt(prop.key.end)
                    ),
                    `'${attribute}' is not a valid attribute of model '${effectiveModelName}'. Valid attributes: ${Object.keys(model.attributes || {}).join(', ')}`,
                    lsp.DiagnosticSeverity.Error,
                    'sails-lsp'
                  )
                )
              }
            }
          }
        }
      }
    })
  } catch (err) {
    // No regex fallback: rely solely on AST-based validation for accuracy
  }
  return diagnostics
}
