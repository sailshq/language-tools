import { create as createTypeScriptServices } from 'volar-service-typescript'
import { create as createRoutesService } from './services/routes'
import {
  createServer,
  createConnection,
  createTypeScriptProjectProvider,
  loadTsdkByPath
} from '@volar/language-server/node'

const connection = createConnection()
const server = createServer(connection)

connection.listen()

connection.onInitialize((params) => {
  const tsdk = loadTsdkByPath(
    params.initializationOptions.typescript.tsdk,
    params.locale
  )
  return server.initialize(
    params,
    [createRoutesService(), ...createTypeScriptServices(tsdk.typescript, {})],
    createTypeScriptProjectProvider(
      tsdk.typescript,
      tsdk.diagnosticMessages,
      () => []
    )
  )
})

connection.onInitialized(server.initialized)

connection.onShutdown(server.shutdown)
