#!/usr/bin/env python3
"""Build a favicon from the pouch icon in the supplied logo.

The icon sits at the left of the lockup and is separated from the wordmark by a
vertical gap of fully transparent columns, so we detect the gap rather than
guessing a pixel offset.
"""
from PIL import Image

src = Image.open("assets/logo-light.png").convert("RGBA")
w, h = src.size
px = src.load()

# find columns that contain any opaque pixel
occupied = []
for x in range(w):
    for y in range(h):
        if px[x, y][3] > 40:
            occupied.append(x)
            break

# walk the occupied columns and stop at the first real gap (the icon/wordmark split)
gap_run = 0
cut = occupied[-1]
for i in range(1, len(occupied)):
    if occupied[i] - occupied[i - 1] > 1:
        gap_run += 1
        if gap_run >= 1 and occupied[i - 1] > w * 0.06:
            cut = occupied[i - 1] + 1
            break
    else:
        gap_run = 0

icon = src.crop((0, 0, cut, h))
bbox = icon.getbbox()
if bbox:
    icon = icon.crop(bbox)
print(f"icon extracted: {icon.size} (cut at x={cut}px of {w})")

# pad to a square on a transparent canvas, then export sizes
side = max(icon.size) + 8
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)
sq.resize((180, 180), Image.LANCZOS).save("assets/icon-180.png")
sq.resize((64, 64), Image.LANCZOS).save("assets/favicon-64.png")
sq.resize((32, 32), Image.LANCZOS).save("assets/favicon-32.png")
sq.resize((32, 32), Image.LANCZOS).save("favicon.ico", sizes=[(32, 32)])
print("wrote assets/icon-180.png, assets/favicon-64.png, assets/favicon-32.png, favicon.ico")
