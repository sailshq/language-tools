const vscode = require('vscode')
const lsp = require('vscode-languageclient/node')

let client

const generators = [
  {
    command: 'sails.generateHelper',
    type: 'helper',
    prompt: 'Enter helper name (e.g., mail/send or formatCurrency)',
    placeholder: 'mail/send'
  },
  {
    command: 'sails.generateAction',
    type: 'action',
    prompt: 'Enter action name (e.g., user/login or dashboard/view)',
    placeholder: 'user/login'
  },
  {
    command: 'sails.generateModel',
    type: 'model',
    prompt: 'Enter model name (e.g., User or BlogPost)',
    placeholder: 'User'
  },
  {
    command: 'sails.generateHook',
    type: 'hook',
    prompt: 'Enter hook name (e.g., custom-hook)',
    placeholder: 'custom-hook'
  }
]

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

  // Register generator commands for Command Palette
  for (const gen of generators) {
    context.subscriptions.push(
      vscode.commands.registerCommand(gen.command, async (name) => {
        // If name is provided (from quick fix), use it directly
        // Otherwise, prompt the user for input
        if (!name) {
          name = await vscode.window.showInputBox({
            prompt: gen.prompt,
            placeHolder: gen.placeholder,
            validateInput: (value) => {
              if (!value || !value.trim()) {
                return `Please enter a ${gen.type} name`
              }
              return null
            }
          })
        }

        if (!name) return // User cancelled

        // Send command to language server
        await client.sendRequest('workspace/executeCommand', {
          command: gen.command,
          arguments: [name]
        })
      })
    )
  }
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
