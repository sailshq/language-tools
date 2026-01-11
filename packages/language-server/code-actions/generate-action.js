const createGenerator = require('./create-generator')

module.exports = createGenerator({
  type: 'action',
  diagnosticCode: 'action-not-found',
  dataKey: 'actionName',
  validationRegex: /^[a-zA-Z0-9/_-]+$/
})
