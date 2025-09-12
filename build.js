#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const browsers = ['chrome', 'firefox', 'edge'];

console.log('🚀 开始构建浏览器扩展...\n');

// 清理dist目录
if (fs.existsSync('dist')) {
  console.log('🧹 清理旧的构建文件...');
  execSync('rm -rf dist', { stdio: 'inherit' });
}

// 为每个浏览器构建
browsers.forEach(browser => {
  console.log(`\n📦 构建 ${browser} 版本...`);
  
  try {
    execSync(`cross-env BROWSER=${browser} webpack --mode=production`, { 
      stdio: 'inherit' 
    });
    
    // 检查构建结果
    const distPath = path.join('dist', browser);
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      console.log(`✅ ${browser} 构建完成，包含文件: ${files.join(', ')}`);
    } else {
      console.log(`❌ ${browser} 构建失败`);
    }
  } catch (error) {
    console.error(`❌ ${browser} 构建失败:`, error.message);
  }
});

console.log('\n🎉 所有浏览器版本构建完成！');
console.log('\n📁 构建文件位置:');
browsers.forEach(browser => {
  console.log(`   - ${browser}: dist/${browser}/`);
});

console.log('\n📋 安装说明:');
console.log('   Chrome: 打开 chrome://extensions/ 启用开发者模式，加载 dist/chrome 文件夹');
console.log('   Firefox: 打开 about:debugging，点击"临时载入附加组件"，选择 dist/firefox 文件夹');
console.log('   Edge: 打开 edge://extensions/ 启用开发人员模式，加载 dist/edge 文件夹');
