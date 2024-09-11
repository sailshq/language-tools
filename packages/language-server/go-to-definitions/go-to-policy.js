const lsp = require('vscode-languageserver/node')
const path = require('path')
const fs = require('fs').promises

module.exports = async function goToPolicy(document, position) {
  const fileName = path.basename(document.uri)

  if (fileName !== 'policies.js') {
    return null
  }

  const policyInfo = extractPolicyInfo(document, position)

  if (!policyInfo) {
    return null
  }

  const projectRoot = path.dirname(path.dirname(document.uri))
  const fullPolicyPath = resolvePolicyPath(projectRoot, policyInfo.policy)

  if (await fileExists(fullPolicyPath)) {
    return lsp.Location.create(fullPolicyPath, lsp.Range.create(0, 0, 0, 0))
  }

  return null
}

function extractPolicyInfo(document, position) {
  const text = document.getText()
  const offset = document.offsetAt(position)

  // This regex matches policy definitions, including arrays of policies and boolean values
  const regex =
    /(['"])((?:\*|[\w-]+(?:\/\*?)?))?\1\s*:\s*((?:\[?\s*(?:(?:['"][\w-]+['"](?:\s*,\s*)?)+)\s*\]?)|true|false)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, , route, policiesOrBoolean] = match
    const start = match.index
    const end = start + fullMatch.length

    // Check if the cursor is anywhere within the entire match
    if (start <= offset && offset <= end) {
      // If policiesOrBoolean is a boolean, ignore it
      if (policiesOrBoolean === true || policiesOrBoolean === false) {
        continue
      }

      // Remove brackets if present and split into individual policies
      const policies = policiesOrBoolean
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((p) => p.trim().replace(/^['"]|['"]$/g, ''))

      // Find which policy the cursor is on
      let currentStart = start + fullMatch.indexOf(policiesOrBoolean)
      for (const policy of policies) {
        const policyStart = text.indexOf(policy, currentStart)
        const policyEnd = policyStart + policy.length

        if (offset >= policyStart && offset <= policyEnd) {
          return {
            policy,
            range: lsp.Range.create(
              document.positionAt(policyStart),
              document.positionAt(policyEnd)
            )
          }
        }

        currentStart = policyEnd
      }
    }
  }

  return null
}

function resolvePolicyPath(projectRoot, policyPath) {
  return path.join(projectRoot, 'api', 'policies', `${policyPath}.js`)
}

async function fileExists(filePath) {
  try {
    await fs.access(new URL(filePath))
    return true
  } catch {
    return false
  }
}
