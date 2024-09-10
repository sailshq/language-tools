try {
  module.exports = require('@sailshq/language-server/bin/sails-language-server')
} catch {
  module.exports = require('./dist/server')
}
