const lsp = require('vscode-languageserver/node')
const TextDocument = require('vscode-languageserver-textdocument').TextDocument

// Validators
const validateDocument = require('./validators/validate-document')

// Go-to definitions
const goToAction = require('./go-to-definitions/go-to-action')
const goToPolicy = require('./go-to-definitions/go-to-policy')
const goToView = require('./go-to-definitions/go-to-view')
const goToInertiaPage = require('./go-to-definitions/go-to-inertia-page')
const goToHelper = require('./go-to-definitions/go-to-helper')

// Completions
const sailsCompletions = require('./completions/sails-completions')

const connection = lsp.createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      definitionProvider: true,
      completionProvider: {
        triggerCharacters: ['"', "'", '.']
      }
    }
  }
})

documents.onDidOpen((open) => {
  validateDocument(connection, open.document)
})

documents.onDidChangeContent((change) => {
  validateDocument(connection, change.document)
})

connection.onDefinition(async (params) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const actionDefinition = await goToAction(document, params.position)
  const policyDefinition = await goToPolicy(document, params.position)
  const viewDefinition = await goToView(document, params.position)
  const inertiaPageDefinition = await goToInertiaPage(document, params.position)
  const helperDefinition = await goToHelper(document, params.position)

  const definitions = [
    actionDefinition,
    policyDefinition,
    viewDefinition,
    inertiaPageDefinition,
    helperDefinition
  ].filter(Boolean)

  return definitions.length > 0 ? definitions : null
})

connection.onCompletion(async (params) => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const completions = await sailsCompletions(document, params.position)

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
