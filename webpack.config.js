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
    popup: './popup.js',
    background: './background.js',
    content: './content.js'
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
          from: 'popup.html',
          to: 'popup.html'
        },
        {
          from: 'popup.css',
          to: 'popup.css'
        },
        {
          from: 'icons',
          to: 'icons'
        },
        {
          from: 'libs',
          to: 'libs'
        },
        {
          from: 'asserts',
          to: 'asserts'
        },
        {
          from: manifestPath,
          to: 'manifest.json'
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
