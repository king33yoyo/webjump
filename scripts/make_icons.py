# -*- coding: utf-8 -*-
"""
生成 WebJump 插件图标：紫红渐变圆角底 + 白色骰子 + 黄色星光。
输出 extension/icons/icon16.png / icon48.png / icon128.png

用法: python scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "extension" / "icons"
MASTER = 512

C_TOP = (124, 58, 237)    # violet-600
C_BOT = (236, 72, 153)    # pink-500
C_PIP = (76, 29, 149)     # violet-900
C_STAR = (253, 224, 71)   # yellow-300


def gradient_bg(size: int) -> Image.Image:
    small = Image.new("RGB", (2, 2))
    small.putpixel((0, 0), C_TOP)
    small.putpixel((1, 0), C_TOP)
    small.putpixel((0, 1), C_BOT)
    small.putpixel((1, 1), C_BOT)
    return small.resize((size, size), Image.BILINEAR)


def rounded_mask(size: int, radius_ratio: float = 0.22) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def dice_layer(size: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / MASTER
    box = [90 * s, 130 * s, 400 * s, 440 * s]
    d.rounded_rectangle(box, radius=56 * s, fill=(255, 255, 255, 255))
    r = 34 * s
    cx = [(168, 208), (245, 285), (322, 362)]  # 五点骰子：左上/中/右下 三条对角线
    for i, j in [(0, 0), (1, 1), (2, 2), (0, 2), (2, 0)]:
        x, y = cx[i][0] * s, cx[j][1] * s
        d.ellipse([x - r, y - r, x + r, y + r], fill=C_PIP + (255,))
    return layer.rotate(-12, resample=Image.BICUBIC, center=(245 * s, 285 * s))


def star_layer(size: int) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / MASTER
    cx, cy, r = 408 * s, 104 * s, 62 * s
    w = 0.24 * r
    pts = [
        (cx, cy - r), (cx + w, cy - w), (cx + r, cy), (cx + w, cy + w),
        (cx, cy + r), (cx - w, cy + w), (cx - r, cy), (cx - w, cy - w),
    ]
    d.polygon(pts, fill=C_STAR + (255,))
    return layer


def make_icon(size: int) -> Image.Image:
    icon = gradient_bg(MASTER).convert("RGBA")
    icon.putalpha(rounded_mask(MASTER))
    icon.alpha_composite(dice_layer(MASTER))
    icon.alpha_composite(star_layer(MASTER))
    return icon.resize((size, size), Image.LANCZOS)


def make_store_logo(size: int = 300) -> Image.Image:
    """Edge 商店 Logo：300×300，要求不透明（不加圆角蒙版，铺满画布）。"""
    icon = gradient_bg(MASTER).convert("RGBA")
    icon.alpha_composite(dice_layer(MASTER))
    icon.alpha_composite(star_layer(MASTER))
    icon = icon.resize((size, size), Image.LANCZOS)
    opaque = Image.new("RGB", icon.size, (0, 0, 0))
    opaque.paste(icon, mask=icon.split()[3])
    return opaque


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in (16, 48, 128):
        path = OUT_DIR / f"icon{size}.png"
        make_icon(size).save(path)
        print(f"[ok] {path.relative_to(ROOT)}")
    store_dir = ROOT / "store_assets"
    store_dir.mkdir(exist_ok=True)
    logo = store_dir / "store-logo-300.png"
    make_store_logo(300).save(logo)
    print(f"[ok] {logo.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
