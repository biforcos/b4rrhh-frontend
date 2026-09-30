// Candado de los componentes que nadie monta (issue #117).
//
//   npm run lint:unmounted
//
// Un componente que nadie monta es un cadaver: no lo prueba nadie con la
// aplicacion, se le quitan clases fantasma para contentar a otro candado y
// sigue ahi. Lo vio el #113 con los textos de reserva en ingles de
// `EmptyStateComponent`, y el #114 con las clases de `editable-slot-section`.
//
// ─── Que es «montado» ───────────────────────────────────────────────────────
//
// Se recorre desde las raices hacia dentro, no se cuenta quien nombra a quien.
// Las raices son los ficheros que no son componentes y que la aplicacion si
// carga: `main.ts`, las rutas, la configuracion y los servicios. Un componente
// esta montado si una raiz lo nombra (`bootstrapApplication`, `loadComponent`,
// `component:`, un dialogo que se abre desde un servicio) o si lo nombra un
// componente montado (sus `imports:`).
//
// Por eso un `-demo` no salva a lo que importa: si al demo no lo monta nadie,
// tampoco cuenta lo que el demo importa, que es lo que el issue pide.
//
// Nombrar es aparecer la clase como identificador fuera de comentarios, en un
// .ts que no sea un spec. Un spec no monta nada: prueba lo que otro monta.
//
// El limite, dicho: toda raiz cuenta como cargada. Un servicio que nadie
// inyecta y que nombra un componente lo daria por montado. Seguir tambien a
// los servicios seria otro candado; este es el de los componentes.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Y se comprueban en las dos direcciones: si una excepcion pasa a estar
// montada, o deja de existir, el candado falla pidiendo que se borre de la
// lista. Una lista que nadie limpia deja de ser deuda reconocida y pasa a ser
// un agujero.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const EXCLUDED_DIRS = new Set(['generated']);

/** Clase → por que se guarda aunque nadie la monte. Solo puede encoger. */
const EXCEPCIONES = new Map([]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIRS.has(name)) out.push(...walk(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function sinComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const ficheros = walk(SRC).map((path) => ({
  path,
  rel: relative(join(SRC, '..'), path).split(sep).join('/'),
  source: sinComentarios(readFileSync(path, 'utf8')),
}));

// Clase de componente → fichero que la declara.
const componentes = new Map();
for (const f of ficheros) {
  for (const m of f.source.matchAll(/@Component\s*\([\s\S]*?\)\s*export\s+class\s+(\w+)/g)) {
    componentes.set(m[1], f);
  }
}

const nombra = (fichero, clase) => new RegExp(`\\b${clase}\\b`).test(fichero.source);

const raices = ficheros.filter((f) => ![...componentes.values()].includes(f));
const montados = new Set();
const pendientes = [];
for (const [clase, f] of componentes) {
  if (raices.some((r) => nombra(r, clase))) {
    montados.add(clase);
    pendientes.push(f);
  }
}
while (pendientes.length > 0) {
  const padre = pendientes.pop();
  for (const [clase, f] of componentes) {
    if (!montados.has(clase) && f !== padre && nombra(padre, clase)) {
      montados.add(clase);
      pendientes.push(f);
    }
  }
}

const sinMontar = [...componentes.keys()].filter((c) => !montados.has(c)).sort();
const nuevos = sinMontar.filter((c) => !EXCEPCIONES.has(c));
const sobran = [...EXCEPCIONES.keys()].filter((c) => !sinMontar.includes(c));

let roto = false;

if (nuevos.length > 0) {
  roto = true;
  console.error(
    `Componentes que nadie monta (#117): ${nuevos.length}. Ni una ruta ni un componente ` +
      'montado los nombra:',
  );
  for (const c of nuevos) console.error(`  ${c}  (${componentes.get(c).rel})`);
  console.error(
    '\nUna de dos: se retira con sus specs y sus hojas, o se apunta en EXCEPCIONES de este ' +
      'fichero con el motivo por el que se guarda. No hay tercera.',
  );
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no hacen falta: el componente se monta o ya no ` +
      'existe. Borralas de EXCEPCIONES:',
  );
  for (const c of sobran) console.error(`  ${c}`);
}

if (roto) process.exit(1);

console.log(
  `lint:unmounted: ${componentes.size} componentes, todos montados` +
    (EXCEPCIONES.size > 0 ? ` salvo ${EXCEPCIONES.size} excepcion(es) con motivo` : ''),
);
