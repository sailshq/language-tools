const lsp = require('vscode-languageserver/node')

module.exports = function validatePolicyExist(document, typeMap) {
  const diagnostics = []
  if (!document.uri.endsWith('policies.js')) return diagnostics

  const policyRefs = extractPolicyReferences(document)
  for (const { policy, range } of policyRefs) {
    if (!typeMap.policies?.[policy]) {
      diagnostics.push(
        lsp.Diagnostic.create(
          range,
          `Policy '${policy}' not found. Make sure it exists in api/policies.`,
          lsp.DiagnosticSeverity.Error,
          'sails-lsp'
        )
      )
    }
  }

  return diagnostics
}

function extractPolicyReferences(document) {
  const text = document.getText()
  const policyRegex = /(?::|=)\s*(?:\[\s*)?['"]([^'"]+)['"]/g
  const policies = []

  let match
  while ((match = policyRegex.exec(text)) !== null) {
    const policy = match[1]
    const policyStart = match.index + match[0].indexOf(policy)
    const policyEnd = policyStart + policy.length

    policies.push({
      policy,
      range: lsp.Range.create(
        document.positionAt(policyStart),
        document.positionAt(policyEnd)
      )
    })
  }

  return policies
}
