// Candado de los <select> nativos (issue #128).
//
//   npm run lint:native-selects
//
// El selector de la casa es `ui-select`. Un `<select>` nativo con `[value]` y
// las opciones en un `@for` pinta la primera opcion y no el valor cuando los
// dos llegan en el mismo ciclo: el `[value]` se asigna antes de que el `@for`
// cree las opciones y el navegador no tiene con quien casarlo (#125). La
// pantalla dice una cosa y el store hace otra, que es la peor familia.
//
// Por que hace falta: el #125 lo arreglo en `ui-select`, y cuatro `<select>`
// nativos con el mismo patron se quedaron fuera sin que nadie los viera. Uno,
// el del ambito, lee su valor de localStorage: habria mentido el dia que se
// encendiera.
//
// Mira las plantillas .html y las `template:` en linea de los .ts.
//
// ─── Las excepciones van con nombre y motivo ────────────────────────────────
//
// Y la excepcion no exime del arreglo: su `<select>` tiene que marcar cada
// opcion por su lado (`[selected]`), como hace `ui-select`. Una excepcion que
// ya no tiene `<select>` con el patron hace fallar el candado hasta que se
// borra.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = join(import.meta.dirname, '..', 'src', 'app');
const GENERATED = join(APP, 'core', 'api', 'generated');

/** Fichero (relativo a src/app) → por que lleva un `<select>` nativo. Solo puede encoger. */
const EXCEPCIONES = new Map([
  [
    'shared/ui/select/ui-select.component.ts',
    'Es ui-select: el `<select>` nativo que envuelven todos los demas (#125).',
  ],
  [
    'core/layout/app-shell/app-shell.component.html',
    'El selector del ambito en el cromo: un control compacto de 30 px con su propio estilo bajo ' +
      'la marca, que ui-select no tiene. Marca cada opcion por su lado (#128).',
  ],
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (full !== GENERATED) out.push(...walk(full));
    } else if (name.endsWith('.html') || (name.endsWith('.ts') && !name.endsWith('.spec.ts'))) {
      out.push(full);
    }
  }
  return out;
}

const rel = (path) => relative(APP, path).split(sep).join('/');

/** Los `<select>` con `[value]` en la etiqueta y un `@for` dentro. */
function selectsConElPatron(source) {
  const found = [];
  for (const match of source.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const [, attrs, body] = match;
    if (/\[value\]/.test(attrs) && /@for\b/.test(body)) {
      const line = source.slice(0, match.index).split('\n').length;
      found.push({ line, marcaCadaOpcion: /\[selected\]/.test(body) });
    }
  }
  return found;
}

const conPatron = new Map();
for (const file of walk(APP)) {
  const found = selectsConElPatron(readFileSync(file, 'utf8'));
  if (found.length > 0) conPatron.set(rel(file), found);
}

const nuevos = [...conPatron].filter(([f]) => !EXCEPCIONES.has(f));
const sinMarcar = [...conPatron].filter(
  ([f, found]) => EXCEPCIONES.has(f) && found.some((s) => !s.marcaCadaOpcion),
);
const sobran = [...EXCEPCIONES.keys()].filter((f) => !conPatron.has(f));

let roto = false;

if (nuevos.length > 0) {
  roto = true;
  console.error(
    'Selects nativos con [value] y @for (#128): pintan la primera opcion y no el valor cuando ' +
      'los dos llegan a la vez (#125). El selector es ui-select:',
  );
  for (const [f, found] of nuevos) {
    for (const s of found) console.error(`  src/app/${f}:${s.line}`);
  }
  console.error(
    '\nUna de dos: pasa a <app-ui-select>, o se apunta en EXCEPCIONES de este fichero con el ' +
      'motivo, y entonces marca cada opcion con [selected]. No hay tercera.',
  );
}

if (sinMarcar.length > 0) {
  roto = true;
  console.error('\nExcepciones cuyo <select> no marca cada opcion con [selected] (#125):');
  for (const [f, found] of sinMarcar) {
    for (const s of found.filter((x) => !x.marcaCadaOpcion)) {
      console.error(`  src/app/${f}:${s.line}`);
    }
  }
}

if (sobran.length > 0) {
  roto = true;
  console.error(
    `\n${sobran.length} excepcion(es) que ya no hacen falta: el fichero ya no tiene un <select> ` +
      'con el patron. Borralas de EXCEPCIONES:',
  );
  for (const f of sobran) console.error(`  src/app/${f}`);
}

if (roto) process.exit(1);

console.log(
  'lint:native-selects: ningun <select> nativo con [value] y @for fuera de ui-select' +
    ` (${EXCEPCIONES.size} excepcion(es) con motivo, marcando cada opcion)`,
);
