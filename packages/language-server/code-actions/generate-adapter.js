const createGenerator = require('./create-generator')

module.exports = createGenerator({
  type: 'adapter',
  diagnosticCode: null,
  dataKey: null,
  validationRegex: /^[a-zA-Z0-9_-]+$/
})
