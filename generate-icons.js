#!/usr/bin/env node

/**
 * 生成 Chrome 扩展图标脚本
 *
 * 使用方式：
 * 1. npm install canvas
 * 2. node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 canvas
let Canvas, createCanvas;
try {
  ({ Canvas, createCanvas } = require('canvas'));
} catch (e) {
  console.error('❌ 错误: canvas 库未安装');
  console.error('请运行: npm install canvas');
  process.exit(1);
}

const iconsDir = path.join(__dirname, 'icons');

// 创建 icons 目录
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 图标大小
const sizes = [16, 48, 128];

// 为每个大小生成图标
sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景色（渐变色）
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 绘制圆圈（表示密码）
  const circleRadius = size * 0.3;
  const circleX = size / 2;
  const circleY = size / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
  ctx.fill();

  // 在中心绘制钥匙图标（简化版）
  ctx.fillStyle = 'white';

  // 钥匙头（圆形）
  const keyHeadRadius = size * 0.18;
  ctx.beginPath();
  ctx.arc(circleX - size * 0.08, circleY, keyHeadRadius, 0, Math.PI * 2);
  ctx.fill();

  // 钥匙杆（矩形）
  const barHeight = size * 0.1;
  const barWidth = size * 0.35;
  ctx.fillRect(circleX - size * 0.08, circleY - barHeight / 2, barWidth, barHeight);

  // 钥匙齿（小圆点）
  ctx.beginPath();
  ctx.arc(circleX + barWidth - size * 0.08, circleY + size * 0.05, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 保存为 PNG
  const file = fs.createWriteStream(path.join(iconsDir, `icon${size}.png`));
  canvas.createPNGStream().pipe(file);

  file.on('finish', () => {
    console.log(`✅ 已生成 icon${size}.png (${size}x${size})`);
  });

  file.on('error', (err) => {
    console.error(`❌ 生成 icon${size}.png 时出错:`, err);
  });
});

console.log('🎨 正在生成图标...\n');
