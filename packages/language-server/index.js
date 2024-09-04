const lsp = require('vscode-languageserver')
const TextDocument = require('vscode-languageserver-textdocument').TextDocument
const validateMigrationStrategy = require('./validators/validate-auto-migration-strategy')
const validateAutomigrationStrategy = require('./validators/validate-auto-migration-strategy')

const connection = lsp.createConnection(lsp.ProposedFeatures.all)
const documents = new lsp.TextDocuments(TextDocument)

// Initialize the server
connection.onInitialize((params) => {
  return {
    capabilities: {
      textDocumentSync: lsp.TextDocumentSyncKind.Incremental,
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

  const migrationFiles = ['config/models.js', 'api/models/', 'config/env/']

  if (migrationFiles.some((file) => document.uri.includes(file))) {
    const modelDiagnostics = validateAutomigrationStrategy(document)
    diagnostics.push(...modelDiagnostics)
  }

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

documents.listen(connection)

connection.listen()
