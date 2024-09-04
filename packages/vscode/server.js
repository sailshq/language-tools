try {
  module.exports = require('@sailshq/language-server/bin/server')
} catch {
  module.exports = require('../language-server/bin/server')
}
