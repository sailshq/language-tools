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
