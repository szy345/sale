#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未找到 Node.js，请先安装 Node.js 24 LTS 或更高版本。"
  echo "https://nodejs.org/"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "[ERROR] 当前 Node.js 版本为 $(node -v)，需要 24 或更高版本。"
  exit 1
fi

if [ ! -f client/index.html ] || [ ! -f vite.config.js ]; then
  echo "[ERROR] 当前目录不是完整项目或离线包，缺少 client/index.html 或 vite.config.js。"
  echo "请重新解压完整压缩包，不要只复制 scripts 目录。"
  exit 1
fi

mkdir -p data

echo "[1/2] 安装依赖..."
npm ci

echo "[2/2] 构建前端..."
npm run build

echo ""
echo "安装完成。"
echo "启动系统： bash scripts/macos/start.sh"
echo "本机访问： http://localhost:3000"
