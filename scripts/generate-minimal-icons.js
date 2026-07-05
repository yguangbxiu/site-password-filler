#!/usr/bin/env node

/**
 * 生成极简线条风格 Chrome 扩展图标
 * 抽象：钥匙（密码填充），两笔线条，针对 16px 工具栏优化
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'icons');
const assetsDir = path.join(__dirname, '..', 'assets');
const RENDER_SIZE = 128;

function buildSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${RENDER_SIZE}" height="${RENDER_SIZE}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)"/>
  <g stroke="#ffffff" stroke-width="15" stroke-linecap="round" fill="none">
    <!-- 钥匙头：粗线圆环，小尺寸下内孔几乎不可见 -->
    <circle cx="54" cy="64" r="17"/>
    <!-- 钥匙杆 -->
    <line x1="71" y1="64" x2="102" y2="64"/>
  </g>
</svg>`;
}

async function main() {
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const svg = Buffer.from(buildSvg());
  const hiRes = sharp(svg).png();
  const sourcePath = path.join(assetsDir, 'icon128-source.png');

  await hiRes.clone().toFile(sourcePath);

  for (const size of [16, 48, 128]) {
    const out = path.join(iconsDir, `icon${size}.png`);
    await hiRes
      .clone()
      .resize(size, size, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toFile(out);
    console.log(`✅ 已生成 icon${size}.png (${size}x${size})`);
  }

  console.log('\n✨ 完成！');
}

main().catch((err) => {
  console.error('❌ 生成图标失败:', err);
  process.exit(1);
});
