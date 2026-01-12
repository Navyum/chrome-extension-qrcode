#!/bin/bash

# Chrome 远程调试启动脚本
# 使用方法: ./start-chrome-debug.sh

echo "正在关闭所有 Chrome 实例..."
# 关闭所有 Chrome 进程
pkill -f "Google Chrome"

# 等待 Chrome 完全关闭
sleep 2

echo "正在启动 Chrome 远程调试模式..."
echo "远程调试端口: 9222"
echo "访问 http://localhost:9222/json 查看可用页面"

# 启动 Chrome 并启用远程调试
# --remote-debugging-port=9222: 启用远程调试端口
# --user-data-dir: 使用临时用户数据目录（避免影响正常使用）
# --no-first-run: 跳过首次运行设置
# --no-default-browser-check: 跳过默认浏览器检查

# 根据您的系统，Chrome 安装在 ~/Desktop/App/Google Chrome.app
# 如果 Chrome 在标准位置，请改为: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

~/Desktop/App/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --no-first-run \
  --no-default-browser-check \
  > /dev/null 2>&1 &

echo "Chrome 已启动，PID: $!"
echo ""
echo "验证连接:"
echo "  curl http://localhost:9222/json/version"
echo ""
echo "查看可用页面:"
echo "  curl http://localhost:9222/json"

