#!/usr/bin/env python3
"""Composite both logo variants onto light and dark backgrounds so we can see
which one belongs on which theme."""
from PIL import Image

light = Image.open("assets/logo-light.png")
dark = Image.open("assets/logo-dark.png")

W = 1200


def band(img, bg):
    scale = min((W - 80) / img.width, 120 / img.height)
    r = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    b = Image.new("RGB", (W, r.height + 40), bg)
    b.paste(r, ((W - r.width) // 2, 20), r)
    return b


bands = [
    band(light, (255, 255, 255)),
    band(light, (38, 38, 38)),
    band(dark, (255, 255, 255)),
    band(dark, (38, 38, 38)),
]
H = sum(b.height for b in bands) + 30 * (len(bands) - 1)
sheet = Image.new("RGB", (W, H), (128, 128, 128))
y = 0
for b in bands:
    sheet.paste(b, (0, y))
    y += b.height + 30
sheet.save("/tmp/logo_compare.png")
print("wrote /tmp/logo_compare.png", sheet.size)
print("row order: logo-light/white, logo-light/dark, logo-dark/white, logo-dark/dark")
