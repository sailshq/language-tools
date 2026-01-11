const createGenerator = require('./create-generator')

module.exports = createGenerator({
  type: 'model',
  diagnosticCode: 'model-not-found',
  dataKey: 'modelName',
  validationRegex: /^[A-Za-z0-9_]+$/
})
