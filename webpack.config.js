const path = require('path');
module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader'
    }]
  },
  resolve: { extensions: ['.ts', '.js'] },
  output: {
    filename: 'main.js',
    path: path.join(__dirname)
  },
  devServer: {
    host: "0.0.0.0",
    useLocalIp: true
  }
};
