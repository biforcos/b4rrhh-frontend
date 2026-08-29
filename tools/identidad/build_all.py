# -*- coding: utf-8 -*-
"""Genera la marca, los iconos y los app icons de B4RRHH en public/.

    python tools/identidad/build_all.py

Sobrescribe. Revisa el diff antes del git add.
"""
import os, sys, json, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icons import ICONS, icon_svg
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
import cairosvg
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.abspath(os.path.join(HERE, '..', '..'))
TMP  = tempfile.mkdtemp(prefix='b4rrhh-identidad-')
for d in ['public/brand', 'public/icons']:
    os.makedirs(f'{OUT}/{d}', exist_ok=True)

# Los unicos colores literales del proyecto viven en src/styles.scss y en el
# preset de PrimeNG. Estos son los mismos tokens; si cambian alli, cambian aqui.
INK='#1e3a5f'; SOFT='#6f88a3'; PAPER='#fbfaf8'; TXT2='#5c574f'; BORDE='#c3cfdc'
HDR='<!-- B4RRHH — identidad visual. Generado; no editar a mano. -->'

# ── isotipo: una B de dos barras de periodo ────────────────────────────────
def bowl(x0,y,w,bh,sw,t):
    r=bh/2; ch=bh-2*t; cr=ch/2; xa=x0+w-r; cx=x0+sw
    return (f"M{x0} {y} H{xa} A{r} {r} 0 0 1 {xa} {y+bh} H{x0} Z "
            f"M{cx} {y+t} H{xa} A{cr} {cr} 0 0 1 {xa} {y+t+ch} H{cx} Z")

def B_path(x0=4,y0=4,H=24,sw=4.4,g=2.2,t=3.7,w1=19,w2=24):
    """Las dos barras con su contador. El hueco del centro lo cierra el fuste."""
    bh=(H-g)/2
    return (bowl(x0,y0,w1,bh,sw,t)+" "+bowl(x0,y0+bh+g,w2,bh,sw,t)+
            f" M{x0} {y0+bh} H{x0+sw} V{y0+bh+g} H{x0} Z")

def B_solid(x0=4,y0=4,H=24,sw=4.4,g=2.2,w1=19,w2=24):
    """Version maciza, sin contadores: el arte de 16 px del favicon."""
    bh=(H-g)/2; r=bh/2
    return (f"M{x0} {y0} H{x0+w1-r} A{r} {r} 0 0 1 {x0+w1-r} {y0+bh} H{x0} Z "
            f"M{x0} {y0+bh+g} H{x0+w2-r} A{r} {r} 0 0 1 {x0+w2-r} {y0+H} H{x0} Z "
            f"M{x0} {y0+bh} H{x0+sw} V{y0+bh+g} H{x0} Z")

def iso(fill, tile=None, rx=7, solid=False):
    p = B_solid() if solid else B_path()
    inner = f'<rect width="32" height="32" rx="{rx}" fill="{tile}"/>' if tile else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">{HDR}{inner}'
            f'<path fill="{fill}" fill-rule="evenodd" d="{p}"/></svg>')

W = lambda p, s: open(f'{OUT}/{p}', 'w', encoding='utf-8').write(s)
W('public/brand/isotipo.svg',         iso(INK))
W('public/brand/isotipo-mono.svg',    iso('currentColor'))
W('public/brand/isotipo-inverso.svg', iso(PAPER))
W('public/brand/isotipo-tile.svg',    iso(PAPER, tile=INK))
W('public/favicon.svg',               iso(PAPER, tile=INK))

# ── logotipo: B4 en Newsreader, RRHH en IBM Plex, vectorizados ─────────────
def glyphs(font, text, cap, x0, trk):
    upm=font['head'].unitsPerEm; ch=font['OS/2'].sCapHeight or upm*.7
    s=cap/ch; gs=font.getGlyphSet(); cm=font.getBestCmap(); out=[]; x=x0
    for c in text:
        g=cm[ord(c)]; pen=SVGPathPen(gs); gs[g].draw(pen); d=pen.getCommands()
        if d: out.append((d,x,s))
        x += gs[g].width*s + trk
    return out, x-trk

NEWS = TTFont(os.path.join(HERE,'fonts','newsreader-latin-600-normal.woff'))
PLEX = TTFont(os.path.join(HERE,'fonts','ibm-plex-sans-latin-600-normal.woff'))

def emit(ps, fill):
    return ''.join(f'<path fill="{fill}" transform="translate({x:.3f} 100) '
                   f'scale({s:.6f} -{s:.6f})" d="{d}"/>' for d,x,s in ps)

# Altura de mayuscula comun = 100. RRHH al 90 %, con prosa, porque es la
# categoria y no el nombre.
p1, x1  = glyphs(NEWS, 'B4',   100, 0,      .5)
p2, WMW = glyphs(PLEX, 'RRHH',  90, x1+12,  10)
wordmark = lambda c1,c2: emit(p1,c1)+emit(p2,c2)
wm_svg   = lambda c1,c2: (f'<svg xmlns="http://www.w3.org/2000/svg" '
                          f'viewBox="0 -2 {WMW:.1f} 104">{HDR}{wordmark(c1,c2)}</svg>')
W('public/brand/wordmark.svg',      wm_svg(INK, TXT2))
W('public/brand/wordmark-mono.svg', wm_svg('currentColor','currentColor'))

MARK_H=122.0; k=MARK_H/24.0; GAP=58.0; MARK_W=24*k
def lockup(mfill, c1, c2):
    # la marca ocupa de 4 a 28 en su caja: se centra sobre la altura de mayuscula
    tx = -4*k; ty = 50 - MARK_H/2 - 4*k
    g = (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({k:.4f})">'
         f'<path fill="{mfill}" fill-rule="evenodd" d="{B_path()}"/></g>')
    w = f'<g transform="translate({MARK_W+GAP:.2f} 0)">{wordmark(c1,c2)}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {50-MARK_H/2:.1f} '
            f'{MARK_W+GAP+WMW:.1f} {MARK_H:.1f}">{HDR}{g}{w}</svg>')
W('public/brand/logotipo.svg',         lockup(INK, INK, TXT2))
W('public/brand/logotipo-mono.svg',    lockup('currentColor','currentColor','currentColor'))
W('public/brand/logotipo-inverso.svg', lockup(PAPER, PAPER, BORDE))

# ── iconos sueltos + sprite ───────────────────────────────────────────────
syms=[]
for n,(d,extra,nota) in ICONS.items():
    W(f'public/icons/{n}.svg', icon_svg(n))
    syms.append(f'<symbol id="b4-{n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
                f'<path d="{d}"/>{extra}</symbol>')
W('public/icons/b4-icons.svg',
  '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">'+HDR+''.join(syms)+'</svg>')

# ── rasterizado ───────────────────────────────────────────────────────────
def png(src, dst, w):
    cairosvg.svg2png(url=src, write_to=dst, output_width=w, output_height=w)

tile=f'{OUT}/public/brand/isotipo-tile.svg'
png(tile, f'{OUT}/public/icon-192.png', 192)
png(tile, f'{OUT}/public/icon-512.png', 512)
png(tile, f'{OUT}/public/apple-touch-icon.png', 180)

# maskable: sin esquinas redondeadas (las pone el sistema) y la marca al 60 %,
# que es lo que cabe dentro de la zona segura del 80 %.
mk = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
      f'<rect width="32" height="32" fill="{INK}"/>'
      f'<g transform="translate(6.4 6.4) scale(0.6)">'
      f'<path fill="{PAPER}" fill-rule="evenodd" d="{B_path()}"/></g></svg>')
open(f'{TMP}/maskable.svg','w',encoding='utf-8').write(mk)
png(f'{TMP}/maskable.svg', f'{OUT}/public/icon-maskable-512.png', 512)

# favicon.ico: 16, 32 y 48. El de 16 va con el arte macizo.
open(f'{TMP}/ico16.svg','w',encoding='utf-8').write(iso(PAPER, tile=INK, rx=6, solid=True))
frames={}
for size, src in [(16, f'{TMP}/ico16.svg'), (32, tile), (48, tile)]:
    p=f'{TMP}/ico{size}.png'; png(src, p, size); frames[size]=Image.open(p).convert('RGBA')
frames[48].save(f'{OUT}/public/favicon.ico', format='ICO',
                sizes=[(16,16),(32,32),(48,48)],
                append_images=[frames[16], frames[32]])

# ── manifest ──────────────────────────────────────────────────────────────
W('public/site.webmanifest', json.dumps({
  "name":"B4RRHH", "short_name":"B4RRHH", "description":"Gestión de personas y nómina",
  "start_url":"/", "scope":"/", "display":"standalone",
  "background_color":PAPER, "theme_color":INK,
  "icons":[
    {"src":"/favicon.svg","sizes":"any","type":"image/svg+xml"},
    {"src":"/icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"/icon-512.png","sizes":"512x512","type":"image/png"},
    {"src":"/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}
  ]}, ensure_ascii=False, indent=2)+"\n")

print(f"marca + {len(ICONS)} iconos -> {OUT}/public")
