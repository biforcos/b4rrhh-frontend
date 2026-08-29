# Identidad visual

La marca, la iconografía y las reglas de uso. Los ficheros viven en `public/brand/`,
`public/icons/` y la raíz de `public/`.

Esta guía **no** introduce colores nuevos: usa los tokens que ya declara
`src/styles.scss`. Si una pieza de marca necesita un color que no está ahí, el color
no debería existir.

---

## De dónde sale

La dirección ya estaba escrita en `src/styles.scss`: *«Documento: papel, tinta y datos,
sin cromo»*. La marca la obedece. Una sola rampa de neutros cálidos, un solo acento —el
azul tinta— y ni un degradado, ni una sombra larga, ni un brillo.

---

## El isotipo

Una **B** construida con dos barras de periodo. No es un adorno: las dos barras son dos
vigencias, el contador de cada una es el tramo abierto, y la inferior es más larga porque
en este producto casi nada empieza y acaba a la vez. Es el producto dibujado con su
propio vocabulario.

| Fichero | Cuándo |
|---|---|
| `brand/isotipo.svg` | Sobre papel. Tinta sólida. |
| `brand/isotipo-mono.svg` | `currentColor`: hereda el color del contexto. El que se inserta en línea. |
| `brand/isotipo-inverso.svg` | Sobre tinta o sobre foto oscura. |
| `brand/isotipo-tile.svg` | Con fondo propio (radio 7/32). Avatares, favicon, app icons. |

Rejilla de 32. La marca ocupa de 4 a 28 en los dos ejes: esos 4 de margen **son parte
del fichero**, no se recortan.

### Zona de respeto

El alto de una barra (11/32 de la caja) alrededor de la marca. Nada entra ahí: ni texto,
ni bordes, ni otra marca.

### Tamaño mínimo

- Isotipo suelto: **20 px**. Por debajo, los contadores se cierran.
- Versión tile: **16 px**, y a ese tamaño el arte es el macizo —sin contadores— que
  lleva el `favicon.ico`.

---

## El logotipo

`brand/logotipo.svg` — isotipo + palabra, alineados por el centro de la altura de
mayúscula.

La palabra está partida a propósito: **B4** en Newsreader 600, tinta, porque es el
nombre; **RRHH** en IBM Plex Sans 600 al 90 % de altura de mayúscula, con prosa abierta
y en `--text-secondary`, porque es la categoría. Es la misma pareja tipográfica que usa
la aplicación —serif para titulares, sans para datos— aplicada a la marca.

Los trazados están **vectorizados**: el logotipo no depende de que las fuentes carguen.

| Fichero | Cuándo |
|---|---|
| `brand/logotipo.svg` | Uso general sobre papel. |
| `brand/logotipo-mono.svg` | `currentColor`. Una sola tinta: sellos, documentos, impresión. |
| `brand/logotipo-inverso.svg` | Sobre tinta. |
| `brand/wordmark.svg` | Solo la palabra, cuando el isotipo ya está en pantalla. |

Nunca: reencuadrar, cambiar la separación, recomponer con fuentes del sistema, meterlo
en una caja de color que no sea `--accent-primary`, ni girarlo.

---

## Iconografía

34 iconos propios en `public/icons/`, más el sprite `public/icons/b4-icons.svg`.

**Construcción:** rejilla de 24, trazo 1,6, cabos y uniones redondeados, `fill: none`,
`stroke: currentColor`. Un icono nunca lleva color propio: lo hereda.

Se dibujan en trazo, no en macizo, por la misma razón que el resto de la interfaz es
plana: a 16-20 px un icono macizo pesa más que el texto que acompaña y se come la línea.

### Dominio

`empleado` · `empresa` · `centro-trabajo` · `centro-coste` · `catalogo` · `convenio` ·
`recibo` · `operacion` · `rule-system` · `alta` · `cese` · `readmision` · `periodo` ·
`nomina` · `jornada` · `foto` · `usuario`

Los tres del ciclo de vida —`alta`, `cese`, `readmision`— comparten la misma persona y
solo cambia el signo. Es deliberado: son el mismo sujeto en tres momentos.

`periodo` es el icono de una vigencia: un calendario con el tramo marcado en macizo. Es
la única excepción a la regla de «solo trazo», y existe porque el tramo **es** el dato.

### Interfaz

`buscar` · `anadir` · `editar` · `cerrar` · `comprobar` · `imprimir` · `copiar` ·
`mas-opciones` · `chevron-abajo` · `flecha-derecha` · `salir` · `grafico` ·
`documento-nuevo` · `aviso` · `informacion` · `error` · `detener`

### Reglas

- **Un icono no sustituye a la etiqueta.** En la navegación y en los botones de acción va
  acompañado de texto. Solo van solos los de la barra de utilidades, y con `title` y
  `aria-label`.
- **Un concepto, un icono.** Si dos secciones comparten icono, o sobra una sección o
  falta un icono.
- **Nada de iconos decorativos.** Si no distingue nada, fuera.
- Tamaños: 16 px en línea de texto, 20 px en navegación y botones, 24 px en cabeceras.
  El trazo no se reescala: a 16 px se usa el mismo SVG, no un trazo más fino.

### En la aplicación

`<b4-icon name="empleado" [size]="20" />` (`src/app/shared/ui/icon/`). El `name` es un
tipo unión generado con el sprite (`icon-names.ts`): un icono que no existe no compila.
Decorativo por defecto; si va solo, `label="…"` y pasa a ser una imagen con nombre.

El sprite se inyecta en el `<body>` al arrancar (`provideIconSprite`) y se referencia con
`<use href="#b4-…">`, no como fichero externo: el `<use>` externo no hereda `currentColor`
en varios navegadores, y heredar el color del contexto es lo que hace útil al set. Nada de
`<img>` por la misma razón.

---

## Marca de aplicación

| Fichero | Qué es |
|---|---|
| `favicon.ico` | 16, 32 y 48. El arte de 16 es la versión maciza. |
| `favicon.svg` | Escalable, el que usan los navegadores modernos. |
| `apple-touch-icon.png` | 180×180. |
| `icon-192.png`, `icon-512.png` | PWA. |
| `icon-maskable-512.png` | Recortable: la marca al 60 % dentro del lienzo, sin esquinas redondeadas —las pone el sistema. |
| `site.webmanifest` | `theme_color` = `--accent-primary`, `background_color` = `--surface-app`. |

---

## Cómo se regeneran

Todos los SVG llevan la cabecera `<!-- B4RRHH — identidad visual. Generado; no editar a
mano. -->`. Se editan en el origen (`tools/identidad/`) y se vuelven a generar; un
retoque suelto en un fichero se pierde en la siguiente pasada y, peor, rompe la
coherencia del conjunto sin que nadie se entere.
