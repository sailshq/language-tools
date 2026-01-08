const lsp = require('vscode-languageserver/node')
const acorn = require('acorn')
const walk = require('acorn-walk')

module.exports = function validateDataType(document, typeMap) {
  const diagnostics = []
  const documentUri = document.uri

  // Only validate files in backend directories where data types are relevant
  if (!documentUri.includes('/api/') && !documentUri.includes('/scripts/')) {
    return diagnostics
  }

  const text = document.getText()

  try {
    const ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    })

    walk.simple(ast, {
      ObjectExpression(node) {
        // Check if this object has both 'type' and other properties that suggest it's a definition
        // (like 'required', 'description', 'allowNull', 'defaultsTo', 'example', etc.)
        let hasTypeProperty = false
        let typePropertyNode = null
        let typeValue = null
        let hasDefinitionProperties = false

        for (const prop of node.properties) {
          if (prop.type !== 'Property') continue

          const keyName = prop.key.name || prop.key.value

          // Check if this is a 'type' property
          if (keyName === 'type' && prop.value.type === 'Literal') {
            hasTypeProperty = true
            typePropertyNode = prop.value
            typeValue = prop.value.value
          }

          // Check for properties that indicate this is a model/action/helper definition
          if (
            [
              'required',
              'description',
              'allowNull',
              'defaultsTo',
              'columnName',
              'columnType',
              'autoMigrations',
              'autoCreatedAt',
              'autoUpdatedAt',
              'model',
              'collection',
              'via',
              'through',
              'unique',
              'isEmail',
              'isURL',
              'isIn',
              'min',
              'max',
              'minLength',
              'maxLength',
              'example',
              'validations',
              'regex',
              'extendedDescription',
              'moreInfoUrl',
              'whereToGet'
            ].includes(keyName)
          ) {
            hasDefinitionProperties = true
          }
        }

        // Only validate if this looks like an attribute/input definition
        if (hasTypeProperty && hasDefinitionProperties && typeValue) {
          const isValid = typeMap.dataTypes.some((dt) => dt.type === typeValue)

          if (!isValid) {
            diagnostics.push(
              lsp.Diagnostic.create(
                lsp.Range.create(
                  document.positionAt(typePropertyNode.start),
                  document.positionAt(typePropertyNode.end)
                ),
                `'${typeValue}' is not a recognized data type. Valid data types are: ${typeMap.dataTypes.map((dataType) => dataType.type).join(', ')}.`,
                lsp.DiagnosticSeverity.Error,
                'sails-lsp'
              )
            )
          }
        }
      }
    })
  } catch (error) {
    // Ignore parse errors
  }

  return diagnostics
}
