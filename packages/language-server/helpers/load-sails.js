const findSails = require('./find-sails')

module.exports = async function loadSails(workspaceUri, operation) {
  let Sails
  let sailsApp

  try {
    const { sailsPath } = await findSails(workspaceUri)
    Sails = require(sailsPath).constructor

    sailsApp = await new Promise((resolve, reject) => {
      new Sails().load(
        {
          hooks: { shipwright: false },
          log: { level: 'silent' }
        },
        (err, sails) => {
          if (err) {
            console.error('Failed to load Sails app:', err)
            return reject(err)
          }
          resolve(sails)
        }
      )
    })

    // Execute the operation with the loaded Sails app
    return await operation(sailsApp)
  } catch (error) {
    console.error('Error loading or working with Sails app:', error)
    throw error
  } finally {
    // Ensure Sails is lowered even if an error occurred
    if (sailsApp && typeof sailsApp.lower === 'function') {
      await new Promise((resolve) => sailsApp.lower(resolve))
    }
  }
}
