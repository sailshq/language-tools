const lsp = require('vscode-languageserver/node')
const TextDocument = require('vscode-languageserver-textdocument').TextDocument
const validateDocument = require('./validators/validate-document')
const goToAction = require('./go-to-definitions/go-to-action')
const goToPolicy = require('./go-to-definitions/go-to-policy')

const connection = lsp.createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      definitionProvider: true
      // completionProvider: {
      //   resolveProvider: true,
      //   triggerCharacters: ['"', "'", '.']
      // }
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

  const definitions = [actionDefinition, policyDefinition].filter(Boolean)

  return definitions.length > 0 ? definitions : null
})

documents.listen(connection)
connection.listen()
