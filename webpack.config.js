const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');

// 获取目标浏览器
const browser = process.env.BROWSER || 'chrome';

// 读取对应浏览器的manifest文件
const manifestPath = path.join(__dirname, 'manifest', `${browser}.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

module.exports = {
  entry: {
    popup: './src/popup.js',
    background: './src/background.js',
    content: './src/content.js'
  },
  output: {
    path: path.resolve(__dirname, `dist/${browser}`),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'icons/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/popup.html',
          to: 'popup.html',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: 'src/popup.css',
          to: 'popup.css',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: 'icons',
          to: 'icons',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: 'libs',
          to: 'libs',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: 'assets',
          to: 'assets',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: 'src/_locales',
          to: '_locales',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        },
        {
          from: manifestPath,
          to: 'manifest.json',
          globOptions: {
            ignore: ['**/.*', '**/.*/**']
          }
        }
      ]
    })
  ],
  resolve: {
    extensions: ['.js', '.json']
  },
  optimization: {
    minimize: false // 保持代码可读性，便于调试
  }
};
