const createGenerator = require('./create-generator')

module.exports = createGenerator({
  type: 'hook',
  diagnosticCode: null, // No diagnostic triggers this - manual command only
  dataKey: null,
  validationRegex: /^[a-zA-Z0-9_-]+$/
})
