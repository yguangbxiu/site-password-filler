#!/bin/bash

# Chrome 密码填充插件 - 快速启动脚本

echo "🚀 Chrome 密码填充插件 - 启动配置"
echo "=================================="
echo ""

# 检查是否已存在 icons 目录和图标
if [ -d "icons" ] && [ -f "icons/icon16.png" ] && [ -f "icons/icon48.png" ] && [ -f "icons/icon128.png" ]; then
  echo "✅ 图标文件已存在"
else
  echo "📦 生成图标..."
  echo ""

  # 尝试使用 Python 生成图标
  if command -v python3 &> /dev/null; then
    echo "使用 Python 生成图标..."
    python3 generate-icons.py
    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ 图标生成成功！"
    else
      echo "❌ 使用 Python 生成图标失败，尝试 Node.js..."
      if command -v node &> /dev/null; then
        node generate-icons.js
      fi
    fi
  elif command -v node &> /dev/null; then
    echo "使用 Node.js 生成图标..."
    if [ ! -d "node_modules" ]; then
      echo "安装依赖..."
      npm install
    fi
    node generate-icons.js
    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ 图标生成成功！"
    fi
  else
    echo "❌ 错误: 未找到 Python 或 Node.js"
    echo ""
    echo "请选择以下任一方式手动生成图标："
    echo ""
    echo "📌 方案 1: 使用 Python（推荐）"
    echo "   1. pip install Pillow"
    echo "   2. python3 generate-icons.py"
    echo ""
    echo "📌 方案 2: 使用 Node.js"
    echo "   1. npm install"
    echo "   2. npm run generate-icons"
    echo ""
    echo "📌 方案 3: 手动创建占位符图标"
    echo "   在 icons/ 目录下放置三个 PNG 文件:"
    echo "   - icon16.png (16x16)"
    echo "   - icon48.png (48x48)"
    echo "   - icon128.png (128x128)"
    exit 1
  fi
fi

echo ""
echo "=================================="
echo "✨ 所有准备就绪！"
echo ""
echo "下一步："
echo "1. 打开 Chrome，访问 chrome://extensions/"
echo "2. 启用右上角的 【开发者模式】"
echo "3. 点击 【加载未打包的扩展程序】"
echo "4. 选择本目录"
echo ""
echo "📚 更多信息请查看 README.md"
