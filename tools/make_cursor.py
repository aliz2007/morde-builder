#!/usr/bin/env python3
"""Turn a weapon render into the site cursor.

    python3 tools/make_cursor.py assets/<the-image-you-uploaded>.png

Mirrors it so the head leads at the top-left, trims transparent margins, scales
it to a size browsers will accept, and writes assets/cursor-mace.png. Prints the
hotspot to use in css/layout.css.
"""
import sys, os
from PIL import Image

SIZE = 44

if len(sys.argv) < 2:
    sys.exit("usage: make_cursor.py <image> [size]")
src = sys.argv[1]
size = int(sys.argv[2]) if len(sys.argv) > 2 else SIZE
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir,
                   "assets", "cursor-mace.png")

im = Image.open(src).convert("RGBA")

# Flat white/near-white backgrounds are common on wiki renders and would make the
# cursor a rectangle following the pointer. Knock them out before anything else.
if im.getextrema()[3][0] == 255:
    px = im.load()
    w, h = im.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if all(c[0] > 235 and c[1] > 235 and c[2] > 235 for c in corners):
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if r > 235 and g > 235 and b > 235:
                    px[x, y] = (r, g, b, 0)

im = im.transpose(Image.FLIP_LEFT_RIGHT)

bbox = im.getbbox()
if bbox:
    im = im.crop(bbox)

im.thumbnail((size, size), Image.LANCZOS)

canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
canvas.paste(im, (0, 0))
canvas.save(out)

# hotspot: first opaque pixel scanning from the top-left corner outwards
px = canvas.load()
spot = (2, 2)
found = False
for d in range(size * 2):
    for x in range(min(d, size - 1), -1, -1):
        y = d - x
        if y < size and px[x, y][3] > 128:
            spot = (x, y)
            found = True
            break
    if found:
        break

print(f"wrote {os.path.normpath(out)}  {canvas.size[0]}x{canvas.size[1]}")
print(f"hotspot: {spot[0]} {spot[1]}")
opaque = sum(1 for p in list(canvas.getdata()) if p[3] > 10)
print(f"opaque pixels: {opaque}/{size * size}")
