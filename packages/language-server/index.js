const lsp = require('vscode-languageserver')
const TextDocument = require('vscode-languageserver-textdocument').TextDocument
const {
  validateMigrationStrategy
} = require('./validators/migration-strategy-validator')

const connection = lsp.createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

// Initialize the server
connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
      diagnosticProvider: {},
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.']
      }
    }
  }
})

documents.onDidOpen((open) => {
  validateDocument(open.document)
})

documents.onDidChangeContent((change) => {
  validateDocument(change.document)
})

function validateDocument(document) {
  const diagnostics = []

  if (document.uri.endsWith('config/models.js')) {
    const modelDiagnostics = validateMigrationStrategy(document)
    diagnostics.push(...modelDiagnostics)
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

documents.listen(connection)

connection.listen()
