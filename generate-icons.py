#!/usr/bin/env python3

"""
生成 Chrome 扩展图标脚本（Python 版本）

使用方式：
1. pip install Pillow
2. python3 generate-icons.py
"""

import os
from PIL import Image, ImageDraw

def generate_icon(size):
    """生成指定大小的图标"""
    # 创建新图像，背景色为紫色渐变
    img = Image.new('RGB', (size, size), color=(102, 126, 234))
    draw = ImageDraw.Draw(img)

    # 绘制渐变背景（简化版 - 使用两种颜色混合）
    for y in range(size):
        r = int(102 + (118 - 102) * (y / size))
        g = int(126 + (75 - 126) * (y / size))
        b = int(234 + (162 - 234) * (y / size))
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # 绘制圆圈背景
    circle_radius = int(size * 0.3)
    center_x, center_y = size // 2, size // 2
    draw.ellipse(
        [center_x - circle_radius, center_y - circle_radius,
         center_x + circle_radius, center_y + circle_radius],
        fill=(255, 255, 255, 77),  # 半透明白色
        outline=None
    )

    # 绘制钥匙图标
    key_offset_x = int(size * 0.08)
    key_head_radius = int(size * 0.18)

    # 钥匙头（圆形）
    draw.ellipse(
        [center_x - key_offset_x - key_head_radius,
         center_y - key_head_radius,
         center_x - key_offset_x + key_head_radius,
         center_y + key_head_radius],
        fill=(255, 255, 255),
        outline=None
    )

    # 钥匙杆（矩形）
    bar_height = int(size * 0.1)
    bar_width = int(size * 0.35)
    draw.rectangle(
        [center_x - key_offset_x, center_y - bar_height // 2,
         center_x - key_offset_x + bar_width, center_y + bar_height // 2],
        fill=(255, 255, 255),
        outline=None
    )

    # 钥匙齿（小圆点）
    tooth_radius = int(size * 0.05)
    tooth_x = center_x - key_offset_x + bar_width
    tooth_y = center_y + int(size * 0.05)
    draw.ellipse(
        [tooth_x - tooth_radius, tooth_y - tooth_radius,
         tooth_x + tooth_radius, tooth_y + tooth_radius],
        fill=(255, 255, 255),
        outline=None
    )

    return img

def main():
    # 创建 icons 目录
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)

    # 生成三种大小的图标
    sizes = [16, 48, 128]

    print('🎨 正在生成图标...\n')

    for size in sizes:
        try:
            img = generate_icon(size)
            filename = os.path.join(icons_dir, f'icon{size}.png')
            img.save(filename, 'PNG')
            print(f'✅ 已生成 icon{size}.png ({size}x{size})')
        except Exception as e:
            print(f'❌ 生成 icon{size}.png 时出错: {e}')

    print('\n✨ 完成！')

if __name__ == '__main__':
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print('❌ 错误: Pillow 库未安装')
        print('请运行: pip install Pillow')
        exit(1)

    main()
