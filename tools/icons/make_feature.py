#!/usr/bin/env python3
"""The 1024x500 feature graphic Google Play asks for (D-172). Run from the repo root."""
import sys

sys.path.insert(0, 'tools/icons')
from make_icons import TILE, mark  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

html = f"""<!doctype html><meta charset=utf-8>
<style>
@font-face {{ font-family: Cairo; src: url('file://{__import__('os').getcwd()}/public/fonts/cairo-Bold.woff2'); font-weight: 700; }}
body {{ margin:0; width:1024px; height:500px; background:{TILE}; display:flex; align-items:center;
  justify-content:center; gap:56px; direction:rtl; font-family:Cairo, sans-serif; color:#E3E3E3; }}
h1 {{ font-size:120px; margin:0; line-height:1.1; font-weight:700; }}
p {{ font-size:36px; margin:8px 0 0; color:#A3A9B5; font-weight:700; }}
</style>
<svg width="360" height="360" viewBox="0 0 512 512">{mark(512, 51.2, 51.2, 136.93, 0.74)}</svg>
<div><h1>تقويم</h1><p>تقويمك الشخصي، على جهازك</p></div>"""

open('/tmp/feature.html', 'w').write(html)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1024, 'height': 500})
    pg.goto('file:///tmp/feature.html')
    pg.wait_for_timeout(800)
    pg.screenshot(path='tools/android/play/feature-graphic-1024x500.png')
    b.close()
