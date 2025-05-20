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

// Completions
const actionsCompletion = require('./completions/actions-completion')
const dataTypesCompletion = require('./completions/data-types-completion')
const modelAttributePropsCompletion = require('./completions/model-attribute-props-completion')
const inputPropsCompletion = require('./completions/input-props-completion')
const inertiaPagesCompletion = require('./completions/inertia-pages-completion')
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
    helperDefinition
  ] = await Promise.all([
    goToAction(document, params.position, typeMap),
    goToView(document, params.position, typeMap),
    goToPage(document, params.position, typeMap),
    goToPolicy(document, params.position, typeMap),
    goToHelper(document, params.position, typeMap)
  ])

  const definitions = [
    actionDefinition,
    viewDefinition,
    pageDefinition,
    policyDefinition,
    helperDefinition
  ].filter(Boolean)
  return definitions.length > 0 ? definitions : null
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
    inertiaPageCompletion
  ] = await Promise.all([
    actionsCompletion(document, params.position, typeMap),
    dataTypesCompletion(document, params.position, typeMap),
    modelAttributePropsCompletion(document, params.position, typeMap),
    inputPropsCompletion(document, params.position, typeMap),
    inertiaPagesCompletion(document, params.position, typeMap)
  ])

  const completions = [
    ...actionCompletion,
    ...dataTypeCompletion,
    ...modelAttributePropCompletion,
    ...inputPropCompletion,
    ...inertiaPageCompletion
  ].filter(Boolean)

  if (completions) {
    return {
      isIncomplete: true,
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
