@echo off
REM Chrome 密码填充插件 - Windows 快速启动脚本

setlocal enabledelayedexpansion

echo.
echo 🚀 Chrome 密码填充插件 - 启动配置
echo ==================================
echo.

REM 检查是否已存在图标
if exist "icons\icon16.png" if exist "icons\icon48.png" if exist "icons\icon128.png" (
  echo ✅ 图标文件已存在
  goto done
)

echo 📦 生成图标...
echo.

REM 尝试使用 Python 生成图标
where python >nul 2>nul
if !errorlevel! equ 0 (
  echo 使用 Python 生成图标...
  python generate-icons.py
  if !errorlevel! equ 0 (
    echo.
    echo ✅ 图标生成成功！
    goto done
  ) else (
    echo Python 生成失败，尝试 Node.js...
  )
)

REM 尝试使用 Node.js 生成图标
where node >nul 2>nul
if !errorlevel! equ 0 (
  echo 使用 Node.js 生成图标...
  if not exist "node_modules" (
    echo 安装依赖...
    call npm install
  )
  call node generate-icons.js
  if !errorlevel! equ 0 (
    echo.
    echo ✅ 图标生成成功！
    goto done
  )
)

REM 如果都失败了
echo.
echo ❌ 错误: 未找到 Python 或 Node.js
echo.
echo 请选择以下任一方式手动生成图标：
echo.
echo 📌 方案 1: 使用 Python（推荐）
echo    1. pip install Pillow
echo    2. python generate-icons.py
echo.
echo 📌 方案 2: 使用 Node.js
echo    1. npm install
echo    2. npm run generate-icons
echo.
echo 📌 方案 3: 手动创建占位符图标
echo    在 icons\ 目录下放置三个 PNG 文件:
echo    - icon16.png ^(16x16^)
echo    - icon48.png ^(48x48^)
echo    - icon128.png ^(128x128^)
echo.
pause
exit /b 1

:done
echo.
echo ==================================
echo ✨ 所有准备就绪！
echo.
echo 下一步：
echo 1. 打开 Chrome，访问 chrome://extensions/
echo 2. 启用右上角的 【开发者模式】
echo 3. 点击 【加载未打包的扩展程序】
echo 4. 选择本目录
echo.
echo 📚 更多信息请查看 README.md
echo.
pause
