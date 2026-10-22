#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 24 LTS 或更高版本。"
  echo "下载地址：https://nodejs.org/"
  read -n 1 -s -r -p "按任意键关闭窗口..."
  echo
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "当前 Node.js 版本为 $(node -v)，需要 24 或更高版本。"
  read -n 1 -s -r -p "按任意键关闭窗口..."
  echo
  exit 1
fi

if [ ! -f public/index.html ]; then
  echo "前端尚未构建，正在构建..."
  npm run build
fi

echo "============================================"
echo "  销售维保系统"
echo "  本机访问： http://localhost:3000"
echo "  按 Ctrl+C 停止服务"
echo "============================================"
echo ""

node server/index.js

echo
read -n 1 -s -r -p "服务已停止，按任意键关闭窗口..."
echo
