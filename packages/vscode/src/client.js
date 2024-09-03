const { workspace, window } = require('vscode')
const { LanguageClient, TransportKind } = require('vscode-languageclient/node')
const path = require('path')

let client

function activate(context) {
  const serverModule = path.join(
    __dirname,
    '..',
    '..',
    'language-server',
    'server.js'
  )
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  }

  const clientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'ejs' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    }
  }

  client = new LanguageClient(
    'sailsLanguageServer',
    'Sails Language Server',
    serverOptions,
    clientOptions
  )

  client.onDidChangeState((e) => {
    console.log(`Client state changed from ${e.oldState} to ${e.newState}`)
  })

  // Start the client. This will also launch the server
  client.start().catch((error) => {
    window.showErrorMessage(`Failed to start language client: ${error.message}`)
    console.error('Language client start error:', error)
  })
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
