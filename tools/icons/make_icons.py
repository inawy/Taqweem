#!/usr/bin/env python3
"""Builds Taqweem's icons from the Nawy master mark (D-171).

Same 3x3 mark as every Nawy app, with the date "31" in the middle cell so the calendar is told apart
from the others (the way Google Calendar shows a date). The digits are drawn here as plain shapes, so
no font is needed. Run: python3 tools/icons/make_icons.py  (needs Pillow and Playwright).
"""
import os
import sys

TILE = '#111318'
HERO, CORAL, LAV, SUN, MINT, BLUE = '#29CAC0', '#F5A5A2', '#D4BAF4', '#FCDB81', '#A5EBB8', '#709BD2'

INK = '#E3E3E3'  # the digits: off-white, like the rest of Nawy's dark surfaces
S = 12.0  # stroke
W3 = 32.0  # width of the 3
H = 68.0  # digit height


def digits() -> tuple[str, float, float]:
    """The "31" as blocky bars (sharp corners, like the cells), top-left at (0, 0)."""
    mid = (H - S) / 2
    bars = [
        (0, 0, W3, S),  # top
        (6, mid, W3 - 6, S),  # middle, shorter
        (0, H - S, W3, S),  # bottom
        (W3 - S, 0, S, H),  # the right side
    ]
    gap = 16.0
    bars.append((W3 + gap, 0, S, H))  # the 1: a plain bar, no flag
    frag = ''.join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{INK}"/>' for x, y, w, h in bars
    )
    return frag, W3 + gap + S, H


def mark(size: float, x: float, y: float, cell: float, digit_scale: float) -> str:
    """The nine-cell mark with the "31" in the middle cell."""
    xs = [x, x + cell, x + 2 * cell]
    ys = [y, y + cell, y + 2 * cell]
    cells = [
        (xs[1], ys[0], HERO), (xs[0], ys[1], CORAL), (xs[2], ys[1], LAV),
        (xs[0], ys[2], SUN), (xs[1], ys[2], MINT), (xs[2], ys[2], BLUE),
    ]  # fmt: skip
    out = [
        f'<rect x="{cx:.2f}" y="{cy:.2f}" width="{cell:.2f}" height="{cell:.2f}" fill="{col}"/>'
        for cx, cy, col in cells
    ]
    frag, dw, dh = digits()
    k = cell * digit_scale / dh
    mx = xs[1] + (cell - dw * k) / 2
    my = ys[1] + (cell - dh * k) / 2
    out.append(f'<g transform="translate({mx:.2f} {my:.2f}) scale({k:.4f})">{frag}</g>')
    return ''.join(out)


def svg(body: str, size: int = 512, tile: bool = True, radius: float = 120.87, fill: str = TILE) -> str:
    bg = f'<rect width="{size}" height="{size}" rx="{radius}" fill="{fill}"/>' if tile else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}">{bg}{body}</svg>'
    )


def mark_centered(total: float, scale: float, digit_scale: float) -> str:
    cell = total * scale / 3
    off = (total - 3 * cell) / 2
    return mark(total, off, off, cell, digit_scale)


# The standard icon: mark width T/phi, like the master. The small one is larger and has more room
# for the digits, since the number must still be read at 48 px.
STANDARD = svg(mark(512, 97.78, 97.78, 105.88, 0.72))
SMALL = svg(mark(512, 51.2, 51.2, 136.93, 0.74))
FOREGROUND = svg(mark_centered(432, 0.60, 0.74), 432, tile=False)  # adaptive: inside the 66% safe zone
MASKABLE = svg(mark_centered(512, 0.62, 0.74), 512, tile=True, radius=0)
MONO = svg(
    mark_centered(432, 0.60, 0.74)
    .replace(HERO, '#fff').replace(CORAL, '#fff').replace(LAV, '#fff')
    .replace(SUN, '#fff').replace(MINT, '#fff').replace(BLUE, '#fff'),
    432, tile=False,
)  # fmt: skip

def render_all(root: str) -> None:
    """Writes every size the web app and the Android app need."""
    from io import BytesIO

    from PIL import Image
    from playwright.sync_api import sync_playwright

    def put(path: str, data: bytes) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(data)

    with sync_playwright() as p:
        browser = p.chromium.launch()

        def png(text: str, size: int, transparent: bool = True) -> bytes:
            page = browser.new_page(viewport={'width': size, 'height': size})
            body = text.replace('width="512" height="512"', f'width="{size}" height="{size}"', 1)
            body = body.replace('width="432" height="432"', f'width="{size}" height="{size}"', 1)
            page.set_content(f'<body style="margin:0;background:transparent">{body}</body>')
            data = page.screenshot(omit_background=transparent)
            page.close()
            return data

        web = f'{root}/public/icons'
        full = svg(mark(512, 97.78, 97.78, 105.88, 0.72), radius=0)  # iOS rounds it itself
        put(f'{web}/icon.svg', SMALL.encode())
        put(f'{web}/icon-192.png', png(STANDARD, 192))
        put(f'{web}/icon-512.png', png(STANDARD, 512))
        put(f'{web}/icon-maskable-512.png', png(MASKABLE, 512))
        put(f'{web}/icon-monochrome-512.png', png(MONO, 512))
        put(f'{web}/apple-touch-icon.png', png(full, 180))

        res = f'{root}/tools/android/res'
        legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
        layer = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
        stat = {'mdpi': 24, 'hdpi': 36, 'xhdpi': 48, 'xxhdpi': 72, 'xxxhdpi': 96}
        round_small = svg(mark(512, 51.2, 51.2, 136.93, 0.74), radius=256)
        round_std = svg(mark(512, 97.78, 97.78, 105.88, 0.72), radius=256)
        stat_big = Image.open(BytesIO(png(svg(mark_centered(512, 0.80, 0.0).replace(
            f'fill="{INK}"', 'fill="#fff"'), 512, tile=False)
            .replace(HERO, '#fff').replace(CORAL, '#fff').replace(LAV, '#fff')
            .replace(SUN, '#fff').replace(MINT, '#fff').replace(BLUE, '#fff'), 512)))
        for d, n in legacy.items():
            small = n <= 72
            put(f'{res}/mipmap-{d}/ic_launcher.png', png(SMALL if small else STANDARD, n))
            put(f'{res}/mipmap-{d}/ic_launcher_round.png', png(round_small if small else round_std, n))
        for d, n in layer.items():
            put(f'{res}/mipmap-{d}/ic_launcher_foreground.png', png(FOREGROUND, n))
            put(f'{res}/mipmap-{d}/ic_launcher_monochrome.png', png(MONO, n))
        for d, n in stat.items():
            buf = BytesIO()
            stat_big.resize((n, n), Image.LANCZOS).save(buf, 'PNG')
            put(f'{res}/drawable-{d}/ic_stat_taqweem.png', buf.getvalue())
        put(f'{root}/tools/android/playstore-icon-512.png', png(full, 512, transparent=False))
        browser.close()


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        render_all(sys.argv[2] if len(sys.argv) > 2 else '.')
    else:
        out = sys.argv[1] if len(sys.argv) > 1 else 'icon-preview'
        os.makedirs(out, exist_ok=True)
        for name, text in [('icon', STANDARD), ('small', SMALL), ('fg', FOREGROUND), ('mask', MASKABLE), ('mono', MONO)]:
            open(f'{out}/{name}.svg', 'w').write(text)
