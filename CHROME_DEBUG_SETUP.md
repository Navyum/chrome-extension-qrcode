# Chrome DevTools MCP 远程调试设置指南

## 问题原因

`curl -i 'http://localhost:9222/json/version'` 端口不通的原因是：**Chrome 默认不会启用远程调试端口**。需要以特定的命令行参数启动 Chrome 才能启用 DevTools Protocol。

## 解决方案

### 方法 1: 使用提供的启动脚本（推荐）

```bash
# 运行启动脚本
./start-chrome-debug.sh
```

### 方法 2: 手动启动

1. **关闭所有 Chrome 实例**
   ```bash
   pkill -f "Google Chrome"
   ```

2. **使用远程调试参数启动 Chrome**
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=/tmp/chrome-debug-profile \
     --no-first-run \
     --no-default-browser-check
   ```

### 方法 3: 如果 Chrome 不在标准位置

如果您的 Chrome 安装在其他位置（如 `~/Desktop/App/Google Chrome.app`），请修改路径：

```bash
~/Desktop/App/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --no-first-run \
  --no-default-browser-check
```

## 验证连接

启动后，验证远程调试是否正常工作：

```bash
# 检查版本信息
curl http://localhost:9222/json/version

# 查看所有可用页面
curl http://localhost:9222/json

# 查看页面列表（格式化输出）
curl http://localhost:9222/json | python3 -m json.tool
```

## 参数说明

- `--remote-debugging-port=9222`: 启用远程调试，监听 9222 端口
- `--user-data-dir=/tmp/chrome-debug-profile`: 使用临时用户数据目录，避免影响正常使用的 Chrome
- `--no-first-run`: 跳过首次运行设置
- `--no-default-browser-check`: 跳过默认浏览器检查

## 安全提示

⚠️ **重要**: 启用远程调试后，任何能访问 localhost:9222 的程序都可以控制浏览器。请确保：
- 只在本地开发时使用
- 不要在生产环境启用
- 使用防火墙限制访问（如果需要）

## 常见问题

### Q: 端口被占用怎么办？
```bash
# 检查端口占用
lsof -i :9222

# 如果被占用，可以更换端口
--remote-debugging-port=9223
```

### Q: 如何同时运行正常 Chrome 和调试 Chrome？
使用不同的 `--user-data-dir` 路径即可同时运行：
```bash
# 正常 Chrome（使用默认配置）
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome

# 调试 Chrome（使用临时配置）
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile
```

### Q: 如何关闭调试模式？
```bash
# 关闭所有 Chrome 实例
pkill -f "Google Chrome"

# 或者只关闭调试实例
pkill -f "chrome-debug-profile"
```

## 参考链接

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Remote Debugging](https://developer.chrome.com/docs/devtools/remote-debugging/)


