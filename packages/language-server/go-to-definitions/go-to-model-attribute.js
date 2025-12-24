const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = async function goToModelAttribute(
  document,
  position,
  typeMap
) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    let result = null

    const checkPropertyForAttribute = (prop, model, document) => {
      if (prop.type !== 'Property' || !prop.key) return null

      const attrName =
        prop.key.type === 'Identifier'
          ? prop.key.name
          : prop.key.type === 'Literal'
            ? prop.key.value
            : null

      if (!attrName) return null

      const keyStart = prop.key.start
      const keyEnd = prop.key.end

      if (offset >= keyStart && offset <= keyEnd) {
        const attrInfo = model.attributes?.[attrName]
        if (attrInfo?.line && attrInfo?.path) {
          const uri = `file://${attrInfo.path}`
          return lsp.LocationLink.create(
            uri,
            lsp.Range.create(attrInfo.line - 1, 0, attrInfo.line - 1, 0),
            lsp.Range.create(attrInfo.line - 1, 0, attrInfo.line - 1, 0),
            lsp.Range.create(
              document.positionAt(keyStart),
              document.positionAt(keyEnd)
            )
          )
        }
      }
      return null
    }

    const checkStringLiteralForAttribute = (literal, model, document) => {
      if (literal.type !== 'Literal' || typeof literal.value !== 'string')
        return null

      const attrName = literal.value
      const literalStart = literal.start
      const literalEnd = literal.end

      if (offset >= literalStart && offset <= literalEnd) {
        const attrInfo = model.attributes?.[attrName]
        if (attrInfo?.line && attrInfo?.path) {
          const uri = `file://${attrInfo.path}`
          return lsp.LocationLink.create(
            uri,
            lsp.Range.create(attrInfo.line - 1, 0, attrInfo.line - 1, 0),
            lsp.Range.create(attrInfo.line - 1, 0, attrInfo.line - 1, 0),
            lsp.Range.create(
              document.positionAt(literalStart),
              document.positionAt(literalEnd)
            )
          )
        }
      }
      return null
    }

    const checkArrayForAttributes = (arrayNode, model, document) => {
      if (!arrayNode || arrayNode.type !== 'ArrayExpression') return null

      for (const element of arrayNode.elements) {
        if (element?.type === 'Literal' && typeof element.value === 'string') {
          const res = checkStringLiteralForAttribute(element, model, document)
          if (res) return res
        } else if (element?.type === 'ObjectExpression') {
          const res = traverseObjectExpression(element, model, document)
          if (res) return res
        }
      }
      return null
    }

    const traverseObjectExpression = (objNode, model, document) => {
      if (!objNode || objNode.type !== 'ObjectExpression') return null

      for (const prop of objNode.properties) {
        if (prop.type !== 'Property') continue

        const propName =
          prop.key.type === 'Identifier'
            ? prop.key.name
            : prop.key.type === 'Literal'
              ? prop.key.value
              : null

        if (
          propName === 'where' ||
          propName === 'or' ||
          propName === 'and' ||
          propName === 'not'
        ) {
          if (prop.value.type === 'ObjectExpression') {
            const res = traverseObjectExpression(prop.value, model, document)
            if (res) return res
          } else if (prop.value.type === 'ArrayExpression') {
            for (const element of prop.value.elements) {
              const res = traverseObjectExpression(element, model, document)
              if (res) return res
            }
          }
        } else if (propName === 'select' || propName === 'omit') {
          if (prop.value.type === 'ArrayExpression') {
            const res = checkArrayForAttributes(prop.value, model, document)
            if (res) return res
          }
        } else if (propName === 'sort') {
          if (prop.value.type === 'ArrayExpression') {
            const res = checkArrayForAttributes(prop.value, model, document)
            if (res) return res
          } else if (
            prop.value.type === 'Literal' &&
            typeof prop.value.value === 'string'
          ) {
            const sortString = prop.value.value
            const attrMatch = sortString.match(/^(\w+)/)
            if (attrMatch) {
              const attrName = attrMatch[1]
              const attrInfo = model.attributes?.[attrName]
              if (attrInfo?.line && attrInfo?.path) {
                const sortStart = prop.value.start
                const sortEnd = prop.value.end
                if (offset >= sortStart && offset <= sortEnd) {
                  const uri = `file://${attrInfo.path}`
                  return lsp.LocationLink.create(
                    uri,
                    lsp.Range.create(
                      attrInfo.line - 1,
                      0,
                      attrInfo.line - 1,
                      0
                    ),
                    lsp.Range.create(
                      attrInfo.line - 1,
                      0,
                      attrInfo.line - 1,
                      0
                    ),
                    lsp.Range.create(
                      document.positionAt(sortStart),
                      document.positionAt(sortEnd)
                    )
                  )
                }
              }
            }
          }
        } else {
          const res = checkPropertyForAttribute(prop, model, document)
          if (res) return res

          if (prop.value.type === 'ObjectExpression') {
            const nestedRes = traverseObjectExpression(
              prop.value,
              model,
              document
            )
            if (nestedRes) return nestedRes
          }
        }
      }
      return null
    }

    const findModelInChain = (node) => {
      let current = node
      while (current) {
        if (
          current.type === 'CallExpression' &&
          current.callee?.type === 'MemberExpression'
        ) {
          if (current.callee.object?.type === 'Identifier') {
            const modelName = current.callee.object.name
            return typeMap.models?.[modelName]
          }
          current = current.callee.object
        } else if (current.type === 'MemberExpression') {
          current = current.object
        } else {
          break
        }
      }
      return null
    }

    walk.simple(ast, {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const methodName =
            node.callee.property?.type === 'Identifier'
              ? node.callee.property.name
              : null

          if (methodName === 'select' || methodName === 'omit') {
            const model = findModelInChain(node.callee.object)
            if (model) {
              const firstArg = node.arguments?.[0]
              if (firstArg?.type === 'ArrayExpression') {
                for (const element of firstArg.elements) {
                  const res = checkStringLiteralForAttribute(
                    element,
                    model,
                    document
                  )
                  if (res) {
                    result = res
                    return
                  }
                }
              }
            }
          } else if (methodName === 'sort') {
            const model = findModelInChain(node.callee.object)
            if (model) {
              const firstArg = node.arguments?.[0]
              if (firstArg?.type === 'ArrayExpression') {
                const res = checkArrayForAttributes(firstArg, model, document)
                if (res) {
                  result = res
                  return
                }
              } else if (
                firstArg?.type === 'Literal' &&
                typeof firstArg.value === 'string'
              ) {
                const sortString = firstArg.value
                const attrMatch = sortString.match(/^(\w+)/)
                if (attrMatch) {
                  const attrName = attrMatch[1]
                  const attrInfo = model.attributes?.[attrName]
                  if (attrInfo?.line && attrInfo?.path) {
                    const sortStart = firstArg.start
                    const sortEnd = firstArg.end
                    if (offset >= sortStart && offset <= sortEnd) {
                      const uri = `file://${attrInfo.path}`
                      result = lsp.LocationLink.create(
                        uri,
                        lsp.Range.create(
                          attrInfo.line - 1,
                          0,
                          attrInfo.line - 1,
                          0
                        ),
                        lsp.Range.create(
                          attrInfo.line - 1,
                          0,
                          attrInfo.line - 1,
                          0
                        ),
                        lsp.Range.create(
                          document.positionAt(sortStart),
                          document.positionAt(sortEnd)
                        )
                      )
                      return
                    }
                  }
                }
              }
            }
          } else if (node.callee.object.type === 'Identifier') {
            const modelName = node.callee.object.name
            const model = typeMap.models?.[modelName]

            if (!model) return

            const firstArg = node.arguments?.[0]
            if (firstArg?.type === 'ObjectExpression') {
              const res = traverseObjectExpression(firstArg, model, document)
              if (res) result = res
            }
          }
        }
      }
    })

    return result
  } catch (error) {
    return null
  }
}
