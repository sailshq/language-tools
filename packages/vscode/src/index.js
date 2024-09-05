const vscode = require('vscode')
const lsp = require('vscode-languageclient/node')

let client

function activate(context) {
  const serverModule = vscode.Uri.joinPath(context.extensionUri, 'server.js')

  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  const serverOptions = {
    run: { module: serverModule.fsPath, transport: lsp.TransportKind.ipc },
    debug: {
      module: serverModule.fsPath,
      transport: lsp.TransportKind.ipc,
      options: debugOptions
    }
  }

  const clientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'javascript' },
      {
        scheme: 'file',
        language: 'javascript',
        pattern: '**/config/routes.js'
      },
      { scheme: 'file', language: 'ejs' }
    ]
  }

  client = new lsp.LanguageClient(
    'sails-language-server',
    'Sails Language Server',
    serverOptions,
    clientOptions
  )

  client.onDidChangeState((e) => {
    console.log(`Client state changed from ${e.oldState} to ${e.newState}`)
  })

  client.start().catch((error) => {
    vscode.window.showErrorMessage(
      `Failed to start language client: ${error.message}`
    )
    console.error('Language client start error:', error)
  })
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'javascript', pattern: '**/config/routes.js' },
      {
        provideDefinition(document, position, token) {
          return client
            .sendRequest('textDocument/definition', {
              textDocument: { uri: document.uri.toString() },
              position: { line: position.line, character: position.character }
            })
            .then((location) => {
              if (location) {
                return new vscode.Location(
                  vscode.Uri.parse(location.uri),
                  new vscode.Range(
                    location.range.start.line,
                    location.range.start.character,
                    location.range.end.line,
                    location.range.end.character
                  )
                )
              }
              return null
            })
        }
      }
    )
  )
  context.subscriptions.push(client)
}

function deactivate() {
  if (!client) {
    return undefined
  }
  return client.stop()
}

module.exports = {
  activate,
  deactivate
}
