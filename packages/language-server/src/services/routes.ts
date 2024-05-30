import * as fs from 'fs'
import * as path from 'path'
import { Position, Range, LocationLink } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

interface RouteMapping {
  [pattern: string]: string
}

function parseRoutesFile(filePath: string): RouteMapping {
  const routes: RouteMapping = {}
  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const routeRegex = /'([^']+)'\s*:\s*'([^']+)'/g
  let match

  while ((match = routeRegex.exec(fileContent)) !== null) {
    const urlPattern = match[1]
    const controllerAction = match[2]
    routes[urlPattern] = controllerAction
  }

  return routes
}

function resolveControllerPath(
  controllerAction: string,
  rootDir: string
): string {
  const [controller, action] = controllerAction.split('/')
  return path.join(rootDir, 'api', 'controllers', controller, `${action}.js`)
}

export function create() {
  return {
    name: 'routes',
    create() {
      return {
        provideDefinition(document: TextDocument, position: Position) {
          console.log(document.uri)
          const routes = parseRoutesFile(document.uri)
          const results: LocationLink[] = []
          const line = document.getText().split('\n')[position.line]
          for (const [pattern, controllerAction] of Object.entries(routes)) {
            if (line.includes(pattern)) {
              const controllerFilePath = resolveControllerPath(
                controllerAction,
                path.dirname(document.uri)
              )
              if (fs.existsSync(controllerFilePath)) {
                const range: Range = {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 0 }
                }
                results.push({
                  targetUri: `file://${controllerFilePath}`,
                  targetRange: range,
                  originSelectionRange: range,
                  targetSelectionRange: range
                })
              }
            }
          }
          return results.length > 0 ? results : null
        }
      }
    }
  }
}
