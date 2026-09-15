// Candado de las cajas propias (issue #21): fuera de `shared/ui` nadie vuelve a
// pintarse su propia tarjeta.
//
//   npm run lint:own-cards
//
// ─── Por que el criterio NO son las cinco palabras ──────────────────────────
//
// El issue pedia fallar cuando un .scss de features/ declarase una clase con
// pinta de contenedor: card, panel, section, box, tile. Eso se midio el 13/09 y
// se descarto con numeros: 155 falsos positivos de 179, y 52 cajas reales que
// se le escapaban porque `.folio` es una tarjeta entera y no lleva ninguna de
// las cinco palabras. Un guardia que se equivoca ocho de cada nueve veces
// ensena a saltarselo.
//
// El segundo intento tampoco vale, y tambien esta medido (15/09): «pinta fondo
// y ademas borde, sombra o radio» da 117 reglas en features/, y la mayoria son
// botones, insignias, campos, chips y avisos. Pintar un fondo con un borde no
// es hacerse una tarjeta.
//
// ─── El criterio que si distingue ───────────────────────────────────────────
//
// Una tarjeta de este sistema es una SUPERFICIE ELEVADA con esquina, y es lo
// que declaran `shared/ui/panel` y `shared/ui/section-card`:
//
//     background + border-radius (de esquina, no de circulo) + box-shadow
//
// Las tres en la misma regla. **La sombra es la que separa**: un boton lleva
// fondo, borde y radio y no se eleva; un campo, igual; una insignia, igual. De
// las 117 reglas de features/ que pintan «fondo y ademas algo», solo un punado
// se elevan, y son justo las tarjetas.
//
// El borde NO se exige, y es una correccion sobre la primera version de este
// fichero: `.backend-unavailable__card` es una tarjeta de pagina entera y no
// lleva borde. Exigirlo habria dejado fuera una caja real por una propiedad
// opcional. (En la primera version el criterio decia cuatro propiedades y el
// codigo comprobaba tres, porque el regexp de `border` casaba tambien con
// `border-radius`. Daba el resultado bueno por el motivo equivocado, que es
// peor que fallar: el dia que alguien lo lea, el comentario le miente.)
//
// Medido sobre el arbol del 15/09: ONCE reglas fuera de shared/ui cumplen las
// tres. Las once son contenedores de verdad —revisadas una a una— y son las
// mismas once que el comentario del 13/09 contaba vivas. Cero falsos positivos.
//
// ─── El radio circular no es una esquina de tarjeta ─────────────────────────
//
// `border-radius: 50%` o `999px` es un circulo o una pastilla: un avatar, un
// punto, un boton redondo. No hay tarjeta redonda en esta aplicacion, asi que
// un radio circular saca la regla del candado. Es el unico falso positivo que
// aparecio al medir, y se quita por lo que es y no por su nombre.
//
// ─── La lista de supervivientes solo puede encoger ──────────────────────────
//
// Las once cajas que quedan estan escritas abajo. El candado va al pipeline
// HOY, en verde, porque su trabajo no es la deuda vieja: es que no entre la
// doce. Sin esto, «dentro de dos meses seran 25» y esta conversacion se
// repite, que es literalmente lo que el issue dice.
//
// Y la lista se comprueba en las dos direcciones: si una de las once deja de
// pintar su caja, el candado FALLA pidiendo que se borre de la lista. Una lista
// de excepciones que nadie limpia deja de ser una deuda reconocida y pasa a ser
// un agujero, que es como se colo el `.pi` suelto en el candado de iconos.
//
// ─── Los estilos dentro de los .ts ─────────────────────────────────────────
//
// El issue avisaba de que un candado que solo mire .scss nace ciego a los
// `styles:` de un .ts. Eso lo cerro el #41 por el otro lado: prohibirlos. Para
// que esa dependencia no sea tacita, aqui se comprueba tambien, y si aparece un
// `styles:` este candado falla senalando al #41 en vez de mirar para otro lado.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'app');
const EXCLUDED_DIRS = new Set(['generated']);

/** Donde SI se puede pintar una tarjeta: es la casa de las piezas. */
const CASA_DE_LAS_PIEZAS = 'src/app/shared/ui/';

/**
 * Las once cajas que la migracion del #13 todavia no ha llevado a shared/ui.
 * Congeladas el 15/09/2026. Esta lista SOLO puede encoger: cada una que se
 * migre se borra de aqui, y el candado avisa si te olvidas de borrarla.
 *
 * Once, y no cuatro, porque este candado mira TODO lo que esta fuera de
 * shared/ui y no solo features/. El issue decia «un .scss de features/», pero
 * su titulo dice «fuera de shared/ui», y las siete de core/ y rulesystem/ son
 * exactamente el mismo defecto: paginas que se pintan su propia tarjeta
 * teniendo la pieza al lado. Dejarlas fuera habria sido elegir el criterio que
 * da menos trabajo.
 */
const SUPERVIVIENTES = new Set([
  'src/app/core/auth/pages/local-dev-login-page.component.scss::.local-dev-login__card',
  'src/app/core/availability/backend-unavailable.component.scss::.backend-unavailable__card',
  'src/app/core/layout/pages/app-home-page.component.scss::.home-page',
  'src/app/core/layout/pages/section-placeholder-page.component.scss::.placeholder-page',
  'src/app/features/employee/organization/components/employee-cost-center-window-display.component.scss::.window-display',
  'src/app/features/employee/shell/pages/employee-page.component.scss::.employee-main__sections',
  'src/app/features/employee/shell/pages/employee-page.component.scss::.employee-timeline__panel',
  'src/app/features/employee/shell/pages/employee-shell-page.component.scss::.employee-directory__table-wrapper',
  'src/app/rulesystem/catalog/ui/catalog-page.component.scss::.catalog-page__panel',
  'src/app/rulesystem/rule-system/ui/rule-system-detail-page.component.scss::.rule-system-detail-page',
  'src/app/rulesystem/rule-system/ui/rule-system-list-page.component.scss::.rule-system-list-page',
]);

const RADIO_CIRCULAR = /^(50%|9{3,}px|9{3,}rem)/;
const INLINE_STYLES = /^\s*styles\s*:/;

function* walk(dir, ext) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(path, ext);
    } else if (path.endsWith(ext)) {
      yield path;
    }
  }
}

const enPosix = (file) => relative(join(import.meta.dirname, '..'), file).split(sep).join('/');

/**
 * Trocea un .scss en reglas, cada una con SUS declaraciones y no las de sus
 * hijas. No es un parser de CSS y no hace falta que lo sea: sobre este arbol
 * cada regla abre y cierra en su propia linea, y lo unico que se pregunta es
 * que propiedades lleva.
 */
function reglas(texto) {
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const salida = [];
  const pila = [];
  sinComentarios.split('\n').forEach((linea, i) => {
    if (linea.includes('{')) {
      const regla = { selector: linea.slice(0, linea.indexOf('{')).trim(), decls: [], line: i + 1 };
      pila.push(regla);
      salida.push(regla);
      return;
    }
    if (linea.includes('}')) {
      pila.pop();
      return;
    }
    const actual = pila[pila.length - 1];
    if (actual && linea.includes(':')) actual.decls.push(linea.trim());
  });
  return salida;
}

/** `background` o `background-color`; `box-shadow` a secas. Nada de `none`. */
function valorDe(decls, prop) {
  const decl = decls.find((d) => new RegExp(`^${prop}\\s*:`).test(d));
  if (!decl) return null;
  const valor = decl.slice(decl.indexOf(':') + 1).trim().replace(/;.*$/, '');
  return /^none\b/.test(valor) ? null : valor;
}

/** Las tres juntas, con una esquina de tarjeta y no un circulo. */
function esUnaTarjeta(decls) {
  const fondo = valorDe(decls, 'background') ?? valorDe(decls, 'background-color');
  if (!fondo) return false;
  if (!valorDe(decls, 'box-shadow')) return false;
  const radio = valorDe(decls, 'border-radius');
  if (!radio || RADIO_CIRCULAR.test(radio)) return false;
  return true;
}

const encontradas = new Set();
const nuevas = [];

for (const file of walk(ROOT, '.scss')) {
  const posix = enPosix(file);
  if (posix.startsWith(CASA_DE_LAS_PIEZAS)) continue;

  for (const regla of reglas(readFileSync(file, 'utf8'))) {
    if (!regla.selector.startsWith('.')) continue;
    if (!esUnaTarjeta(regla.decls)) continue;

    const clave = `${posix}::${regla.selector}`;
    encontradas.add(clave);
    if (!SUPERVIVIENTES.has(clave)) nuevas.push(`${posix}:${regla.line}: ${regla.selector}`);
  }
}

const inline = [];
for (const file of walk(ROOT, '.ts')) {
  if (file.endsWith('.spec.ts')) continue;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((linea, i) => {
      if (INLINE_STYLES.test(linea)) inline.push(`${enPosix(file)}:${i + 1}: ${linea.trim()}`);
    });
}

const yaMigradas = [...SUPERVIVIENTES].filter((clave) => !encontradas.has(clave));

let roto = false;

if (nuevas.length > 0) {
  roto = true;
  console.error(
    `Cajas propias fuera de shared/ui (#21); ${nuevas.length} regla(s) nuevas declaran ` +
      'background + border-radius + box-shadow, que es el chrome de una tarjeta elevada:',
  );
  for (const hit of nuevas) console.error(`  ${hit}`);
  console.error(
    '\nEsa pieza ya existe: <app-panel> o <app-section-card>, en src/app/shared/ui/. ' +
      'Si de verdad hace falta una variante, se anade alli y la usan todos.',
  );
}

if (inline.length > 0) {
  roto = true;
  console.error(
    `\nY ${inline.length} bloque(s) 'styles:' dentro de un .ts, donde este candado no puede ` +
      'mirar el detalle. Eso lo prohibe el #41 (npm run lint:inline-styles): van en un .scss ' +
      'de al lado con styleUrl.',
  );
  for (const hit of inline) console.error(`  ${hit}`);
}

if (yaMigradas.length > 0) {
  roto = true;
  console.error(
    `\n${yaMigradas.length} superviviente(s) de la lista ya NO pintan su caja: la migracion ` +
      'las alcanzo. Borralas de SUPERVIVIENTES en este fichero — una lista de excepciones que ' +
      'nadie limpia deja de ser deuda reconocida y pasa a ser un agujero:',
  );
  for (const clave of yaMigradas) console.error(`  ${clave}`);
}

if (roto) process.exit(1);

console.log(
  `lint:own-cards: ninguna caja propia nueva fuera de shared/ui ` +
    `(${SUPERVIVIENTES.size} superviviente(s) de la migracion del #13, y solo pueden ser menos)`,
);
