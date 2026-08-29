# Generador de la identidad visual

Los SVG y los PNG de marca e iconos **no se editan a mano**: salen de aquí.

```bash
pip install fonttools brotli cairosvg pillow
python tools/identidad/build_all.py
```

Escribe en `public/` (favicon, app icons, manifest, `brand/`, `icons/`), sobrescribiendo.
Revisa el diff antes del `git add`, como todo lo demás.

- `icons.py` — el set de iconos: un `I(nombre, path, extra, nota)` por icono. Rejilla de
  24, trazo 1,6. Añadir un icono es añadir una entrada.
- `build_all.py` — la geometría de la marca, el trazado del logotipo y el rasterizado.
- `fonts/` — Newsreader 600 e IBM Plex Sans 600, solo para vectorizar el logotipo.
  No las sirve la aplicación; esas llegan por `@import` en `src/styles.scss`. Las dos
  son OFL 1.1 y su licencia viaja con ellas (`OFL-Newsreader.txt`,
  `OFL-IBM-Plex-Sans.txt`); también constan en `NOTICE.md`.

El logotipo se vectoriza desde las fuentes en cada pasada, así que no depende de que
estén instaladas en el navegador de nadie.

Reglas de uso en `docs/identidad-visual.md`.
