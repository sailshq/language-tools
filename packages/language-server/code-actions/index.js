const handlers = [require('./generate-action')]

module.exports = {
  getCommands() {
    return handlers.map((h) => h.command)
  },

  getCodeActions(params) {
    const actions = []
    for (const diagnostic of params.context.diagnostics) {
      const handler = handlers.find((h) => h.diagnosticCode === diagnostic.code)
      if (handler) {
        const action = handler.createCodeAction(diagnostic)
        if (action) actions.push(action)
      }
    }
    return actions
  },

  async executeCommand(params, context) {
    const handler = handlers.find((h) => h.command === params.command)
    if (handler) {
      await handler.executeCommand(params.arguments, context)
    }
  }
}
