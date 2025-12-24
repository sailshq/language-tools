const lsp = require('vscode-languageserver/node')
const TextDocument = require('vscode-languageserver-textdocument').TextDocument
const SailsParser = require('./SailsParser')

// Validators
const validateDocument = require('./validators/validate-document')

// Go-to definitions
const goToAction = require('./go-to-definitions/go-to-action')
const goToView = require('./go-to-definitions/go-to-view')
const goToPage = require('./go-to-definitions/go-to-page')
const goToPolicy = require('./go-to-definitions/go-to-policy')
const goToHelper = require('./go-to-definitions/go-to-helper')
const goToModel = require('./go-to-definitions/go-to-model')
const goToModelAttribute = require('./go-to-definitions/go-to-model-attribute')

// Completions
const actionsCompletion = require('./completions/actions-completion')
const dataTypesCompletion = require('./completions/data-types-completion')
const modelAttributePropsCompletion = require('./completions/model-attribute-props-completion')
const inputPropsCompletion = require('./completions/input-props-completion')
const inertiaPagesCompletion = require('./completions/inertia-pages-completion')
const modelsCompletion = require('./completions/models-completion')
const policiesCompletion = require('./completions/policies-completion')
const viewsCompletion = require('./completions/views-completion')
const modelMethodsCompletion = require('./completions/model-methods-completion')
const modelAttributesCompletion = require('./completions/model-attributes-completion')
const helperInputsCompletion = require('./completions/helper-inputs-completion')
const helpersCompletion = require('./completions/helpers-completion')

const connection = lsp.createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

// Create a new SailsParser instance
const sailsParser = new SailsParser()
let typeMap

connection.onInitialize(async (params) => {
  const rootPath = params.workspaceFolders?.[0]?.uri
    ? new URL(params.workspaceFolders[0].uri).pathname
    : undefined

  sailsParser.setRootDir(rootPath)
  typeMap = await sailsParser.buildTypeMap()

  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      completionProvider: {
        triggerCharacters: ['"', "'", '.', '{', ',', ' ', '\n']
      }
    }
  }
})

documents.onDidOpen((open) => {
  if (typeMap) {
    validateDocument(connection, open.document, typeMap)
  }
})

documents.onDidChangeContent(async (change) => {
  const documentUri = change.document.uri
  if (documentUri.includes('api/') || documentUri.includes('config')) {
    typeMap = await sailsParser.buildTypeMap()
    connection.console.log('Type map updated due to file change.')
  }

  if (typeMap) {
    validateDocument(connection, change.document, typeMap)
  }
})

connection.onDefinition(async (params) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const [
    actionDefinition,
    viewDefinition,
    pageDefinition,
    policyDefinition,
    helperDefinition,
    modelDefinition,
    modelAttributeDefinition
  ] = await Promise.all([
    goToAction(document, params.position, typeMap),
    goToView(document, params.position, typeMap),
    goToPage(document, params.position, typeMap),
    goToPolicy(document, params.position, typeMap),
    goToHelper(document, params.position, typeMap),
    goToModel(document, params.position, typeMap),
    goToModelAttribute(document, params.position, typeMap)
  ])

  const definitions = [
    actionDefinition,
    viewDefinition,
    pageDefinition,
    policyDefinition,
    helperDefinition,
    modelDefinition,
    modelAttributeDefinition
  ].filter((def) => def && (Array.isArray(def) ? def.length > 0 : true))
  return definitions
})

connection.onCompletion(async (params) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }
  const [
    actionCompletion,
    dataTypeCompletion,
    modelAttributePropCompletion,
    inputPropCompletion,
    inertiaPageCompletion,
    modelCompletion,
    policyCompletion,
    viewCompletion,
    modelMethodCompletion,
    modelAttributeCompletion,
    helperCompletion,
    helperInputCompletion
  ] = await Promise.all([
    actionsCompletion(document, params.position, typeMap),
    dataTypesCompletion(document, params.position, typeMap),
    modelAttributePropsCompletion(document, params.position, typeMap),
    inputPropsCompletion(document, params.position, typeMap),
    inertiaPagesCompletion(document, params.position, typeMap),
    modelsCompletion(document, params.position, typeMap),
    policiesCompletion(document, params.position, typeMap),
    viewsCompletion(document, params.position, typeMap),
    modelMethodsCompletion(document, params.position, typeMap),
    modelAttributesCompletion(document, params.position, typeMap),
    helpersCompletion(document, params.position, typeMap),
    helperInputsCompletion(document, params.position, typeMap)
  ])

  const completions = [
    ...actionCompletion,
    ...dataTypeCompletion,
    ...modelAttributePropCompletion,
    ...inputPropCompletion,
    ...inertiaPageCompletion,
    ...modelCompletion,
    ...policyCompletion,
    ...viewCompletion,
    ...modelMethodCompletion,
    ...modelAttributeCompletion,
    ...helperCompletion,
    ...helperInputCompletion
  ].filter(Boolean)

  if (completions) {
    return {
      isIncomplete: false,
      items: completions
    }
  }

  return null
})

documents.listen(connection)
connection.listen()

connection.console.log = (message) => {
  console.log(message)
}
