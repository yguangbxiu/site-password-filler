const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 生成私钥
const privateKeyPath = path.join(__dirname, 'keys', 'private.pem');
const keyDir = path.join(__dirname, 'keys');

if (!fs.existsSync(keyDir)) {
  fs.mkdirSync(keyDir, { recursive: true });
}

// 生成 RSA 私钥（如果不存在）
if (!fs.existsSync(privateKeyPath)) {
  console.log('生成签名密钥...');
  execSync(`openssl genrsa -out "${privateKeyPath}" 2048`, { stdio: 'pipe' });
  console.log(`✓ 私钥已生成: ${privateKeyPath}`);
} else {
  console.log(`✓ 私钥已存在: ${privateKeyPath}`);
}

// 使用 crx3 打包
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const crxPath = path.join(distDir, 'chrome-password-filler.crx');

try {
  console.log('\n打包 CRX 文件...');
  execSync(`npx crx3 pack "${__dirname}" -o "${crxPath}" -p "${privateKeyPath}"`, { stdio: 'inherit' });
  console.log(`\n✓ CRX 文件已生成: ${crxPath}`);
  console.log(`✓ 文件大小: ${(fs.statSync(crxPath).size / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('打包失败:', error.message);
  process.exit(1);
}

// 也生成 ZIP 版本
const zipPath = path.join(distDir, 'chrome-password-filler.zip');
try {
  console.log('\n生成 ZIP 源码包...');
  execSync(`cd "${distDir}" && zip -r chrome-password-filler.zip ../ -x "*/node_modules/*" "*/dist/*" "*/.git/*" "*/.*" "*/*.md"`, { stdio: 'pipe' });
  console.log(`✓ ZIP 包已生成: ${zipPath}`);
} catch (error) {
  console.log('ZIP 生成跳过:', error.message);
}

console.log('\n✅ 打包完成！');
console.log('\n分发信息:');
console.log(`1. CRX 文件: dist/chrome-password-filler.crx (用户可直接安装)`);
console.log(`2. 私钥: keys/private.pem (保管好，用于更新)`);
console.log(`3. ZIP 源码: dist/chrome-password-filler.zip (用于开发)`);
