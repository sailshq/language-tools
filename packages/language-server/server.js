const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  CompletionItem,
  CompletionItemKind
} = require('vscode-languageserver/node')

const { TextDocument } = require('vscode-languageserver-textdocument')

const connection = createConnection(ProposedFeatures.all)

const documents = new TextDocuments(TextDocument)

let sailsHelpers = {}

connection.onInitialize((params) => {
  loadSailsHelpers(params.rootPath)
  return {
    capabilities: {
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.']
      }
    }
  }
})

connection.onCompletion((textDocumentPosition) => {
  const document = documents.get(textDocumentPosition.textDocument.uri)
  const text = document.getText()
  const position = textDocumentPosition.position
  const line = text.split('\n')[position.line]
  const linePrefix = line.slice(0, position.character)

  if (linePrefix.endsWith('sails.helpers.')) {
    return Object.keys(sailsHelpers).map((helper) => ({
      label: helper,
      kind: CompletionItemKind.Function,
      data: { type: 'helper', name: helper }
    }))
  }

  // Check if we're completing arguments for a specific helper
  const helperMatch = linePrefix.match(/sails\.helpers\.(\w+)(?:\.with)?$/)
  if (helperMatch) {
    const helperName = helperMatch[1]
    const helper = sailsHelpers[helperName]
    if (helper && helper.inputs) {
      return Object.keys(helper.inputs).map((input) => ({
        label: input,
        kind: CompletionItemKind.Property,
        data: { type: 'input', helper: helperName, name: input }
      }))
    }
  }

  return []
})

connection.onCompletionResolve((item) => {
  if (item.data.type === 'helper') {
    const helper = sailsHelpers[item.data.name]
    item.detail = `Sails Helper: ${item.data.name}`
    item.documentation = helper.description || 'No description available'
  } else if (item.data.type === 'input') {
    const helper = sailsHelpers[item.data.helper]
    const input = helper.inputs[item.data.name]
    item.detail = `Input for ${item.data.helper}: ${item.data.name}`
    item.documentation = input.description || 'No description available'
  }
  return item
})

function loadSailsHelpers(rootPath) {
  // This function should load helper definitions from the Sails project
  // For now, we'll use a mock example
  sailsHelpers = {
    sendWelcomeEmail: {
      description: 'Sends a welcome email to a new user',
      inputs: {
        emailAddress: {
          type: 'string',
          description: 'The recipient email address'
        },
        name: { type: 'string', description: 'The name of the recipient' }
      }
    }
  }
}

documents.listen(connection)

connection.listen()
