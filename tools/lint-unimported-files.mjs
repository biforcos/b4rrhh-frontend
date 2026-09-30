// Candado de los ficheros que nadie importa (issue #121).
//
//   npm run lint:unimported
//
// El #117 cubrio los componentes que nadie monta (`lint:unmounted`). Lo que no
// es componente —modelos, utilidades, mappers, textos— tambien se queda sin
// quien lo importe, y es el mismo cadaver: nadie lo prueba con la aplicacion y
// sigue ahi. Lo dejo apuntado el #117 con `section-capabilities.model.ts`.
//
// ─── Que es «importado» ─────────────────────────────────────────────────────
//
// Se recorre desde `src/main.ts`, que es lo unico que carga el navegador, por
// los `import … from` y los `export … from` y por los `import()` de las rutas
// perezosas. Todo `.ts` de `src/app` al que no se llega es un fichero que nadie
// importa. Por eso tambien sale una cadena muerta: si a B solo lo importa A, y
// a A no lo importa nadie, se quedan fuera los dos.
//
// Un spec no importa nada a estos efectos: prueba lo que otro usa. Queda
// fuera el cliente generado de la API (`core/api/generated`), que se
// regenera entero del contrato y no se poda a mano.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Y se comprueban en las dos direcciones: una excepcion que ya se importa, o
// que ya no existe, hace fallar el candado hasta que se borra.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const APP = join(SRC, 'app');
const GENERATED = join(APP, 'core', 'api', 'generated');
const MAIN = join(SRC, 'main.ts');

/** Fichero (relativo a src/app) → por que se guarda aunque nadie lo importe. Solo puede encoger. */
const EXCEPCIONES = new Map([]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full !== GENERATED) out.push(...walk(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function sinComentarios(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Las rutas relativas que importa un fichero, resueltas a su `.ts`. */
function importados(path) {
  const source = sinComentarios(readFileSync(path, 'utf8'));
  const especificadores = [
    ...source.matchAll(/\b(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1]);
  return especificadores
    .filter((spec) => spec.startsWith('.'))
    .map((spec) => resolve(dirname(path), spec))
    .flatMap((base) => [`${base}.ts`, join(base, 'index.ts')])
    .filter((candidate) => existsSync(candidate));
}

const alcanzados = new Set([MAIN]);
const pendientes = [MAIN];
while (pendientes.length > 0) {
  for (const siguiente of importados(pendientes.pop())) {
    if (!alcanzados.has(siguiente)) {
      alcanzados.add(siguiente);
      pendientes.push(siguiente);
    }
  }
}

const rel = (path) => relative(APP, path).split(sep).join('/');
const sinImportar = walk(APP)
  .filter((path) => !alcanzados.has(path))
  .map(rel)
  .sort();
const nuevos = sinImportar.filter((f) => !EXCEPCIONES.has(f));
const sobran = [...EXCEPCIONES.keys()].filter((f) => !sinImportar.includes(f));

let roto = false;

if (nuevos.length > 0) {
  roto = true;
  console.error(
    `Ficheros que nadie importa (#121): ${nuevos.length}. Desde src/main.ts no se llega a ` +
      'ellos por ningun import:',
  );
  for (const f of nuevos) console.error(`  src/app/${f}`);
  console.error(
    '\nUna de dos: se retira, o se apunta en EXCEPCIONES de este fichero con el motivo por el ' +
      'que se guarda. No hay tercera.',
  );
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no hacen falta: el fichero se importa o ya no ` +
      'existe. Borralas de EXCEPCIONES:',
  );
  for (const f of sobran) console.error(`  src/app/${f}`);
}

if (roto) process.exit(1);

console.log(
  `lint:unimported: ${alcanzados.size} ficheros alcanzados desde src/main.ts, ninguno sin importar` +
    (EXCEPCIONES.size > 0 ? ` salvo ${EXCEPCIONES.size} excepcion(es) con motivo` : ''),
);
