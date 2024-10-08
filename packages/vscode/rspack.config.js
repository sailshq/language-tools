const { RsdoctorRspackPlugin } = require('@rsdoctor/rspack-plugin')

module.exports = {
  target: 'node',
  entry: {
    client: './src/index.js',
    server: '../language-server/index.js'
  },
  output: {
    path: './dist',
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: [
    // Only register the plugin when RSDOCTOR is true, as the plugin will increase the build time.
    process.env.RSDOCTOR &&
      new RsdoctorRspackPlugin({
        // plugin options
      })
  ].filter(Boolean)
}
